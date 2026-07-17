"""Police/fire scanner worker: captures multiple Broadcastify feeds, transcribes, and extracts incidents."""

import json
import logging
import os
import struct
import subprocess
import tempfile
import threading
import time
import wave
from datetime import datetime, timezone
from typing import Optional

import psycopg2
import requests

from workers.db_writer import upsert_incident, get_connection, find_recent_scanner_match
from workers.emoji_mapper import map_scanner_category

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("scanner-worker")

# ---------------------------------------------------------------------------
# Feed configuration
# ---------------------------------------------------------------------------

DEFAULT_FEEDS = json.dumps([
    {"id": "kc_fusion", "name": "KC Wide Digital Fusion", "url": "https://broadcastify.cdnstream1.com/30282"},
    {"id": "kcfd", "name": "KC Fire Dispatch", "url": "https://broadcastify.cdnstream1.com/36219"},
    {"id": "kc_regional", "name": "KC Regional Public Safety", "url": "https://broadcastify.cdnstream1.com/23630"},
])

SCANNER_FEEDS = json.loads(os.environ.get("SCANNER_FEEDS", DEFAULT_FEEDS))

# Legacy single-feed support
SCANNER_STREAM_URL = os.environ.get("SCANNER_STREAM_URL", "")
if SCANNER_STREAM_URL and not os.environ.get("SCANNER_FEEDS"):
    SCANNER_FEEDS = [{"id": "kcpd", "name": "KCPD Scanner", "url": SCANNER_STREAM_URL}]

CAPTURE_DURATION = 30  # seconds per capture chunk
POLL_INTERVAL = 5  # seconds between capture cycles
MIN_SPEECH_ENERGY = 500  # RMS threshold for speech detection
MIN_TRANSCRIPT_LENGTH = 20  # minimum chars for extraction

# Ollama local LLM
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://host.docker.internal:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")

# Nominatim geocoding
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_HEADERS = {"User-Agent": "EOC-Pipeline/1.0"}

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://eoc:eoc@db:5432/eoc")


# ---------------------------------------------------------------------------
# Transcript storage
# ---------------------------------------------------------------------------

def store_transcript(feed_id: str, feed_name: str, transcript: str, audio_rms: float = 0.0):
    """Store a transcript chunk in the scanner_transcripts table."""
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO scanner_transcripts (feed_id, feed_name, transcript, audio_rms)
                   VALUES (%s, %s, %s, %s)""",
                (feed_id, feed_name, transcript, audio_rms),
            )
            conn.commit()
    except psycopg2.Error:
        logger.exception("Failed to store transcript for feed %s", feed_id)
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# Audio capture via ffmpeg
# ---------------------------------------------------------------------------

def capture_audio(stream_url: str, duration: int, output_path: str) -> bool:
    """Capture audio from a stream URL using ffmpeg."""
    cmd = [
        "ffmpeg", "-y",
        "-i", stream_url,
        "-t", str(duration),
        "-ac", "1", "-ar", "16000",
        "-acodec", "pcm_s16le",
        "-f", "wav",
        output_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=duration + 30)
        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace")[-500:]
            logger.warning("ffmpeg exited %d: %s", result.returncode, stderr)
            return False
        return os.path.exists(output_path) and os.path.getsize(output_path) > 1000
    except subprocess.TimeoutExpired:
        logger.warning("ffmpeg capture timed out after %ds", duration + 30)
        return False
    except Exception:
        logger.exception("Audio capture failed")
        return False


# ---------------------------------------------------------------------------
# Energy-based VAD
# ---------------------------------------------------------------------------

def compute_rms(wav_path: str) -> float:
    """Compute RMS energy of a WAV file."""
    try:
        with wave.open(wav_path, "rb") as wf:
            n_frames = wf.getnframes()
            if n_frames == 0:
                return 0.0
            sample_width = wf.getsampwidth()
            raw_data = wf.readframes(n_frames)
            if sample_width == 2:
                fmt = f"<{n_frames}h"
                samples = struct.unpack(fmt, raw_data)
            else:
                return 0.0
            sum_sq = sum(s * s for s in samples)
            return (sum_sq / n_frames) ** 0.5
    except Exception:
        return 0.0


def has_speech(wav_path: str, threshold: float = MIN_SPEECH_ENERGY) -> bool:
    return compute_rms(wav_path) > threshold


# ---------------------------------------------------------------------------
# Whisper transcription (thread-safe lazy init per thread)
# ---------------------------------------------------------------------------

_whisper_lock = threading.Lock()
_whisper_model = None


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        with _whisper_lock:
            if _whisper_model is None:
                from faster_whisper import WhisperModel
                logger.info("Loading faster-whisper base.en model...")
                _whisper_model = WhisperModel("base.en", device="cpu", compute_type="int8")
                logger.info("Whisper model loaded")
    return _whisper_model


# Serialize whisper calls since faster-whisper is not thread-safe
_transcribe_lock = threading.Lock()


def transcribe_audio(wav_path: str) -> str:
    try:
        model = get_whisper_model()
        with _transcribe_lock:
            segments, info = model.transcribe(
                wav_path, beam_size=3, language="en",
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500, speech_pad_ms=200),
            )
            text_parts = [seg.text.strip() for seg in segments]
        transcript = " ".join(text_parts).strip()
        logger.info("Transcribed %d characters from %s", len(transcript), wav_path)
        return transcript
    except Exception:
        logger.exception("Transcription failed for %s", wav_path)
        return ""


# ---------------------------------------------------------------------------
# Local LLM incident extraction via Ollama
# ---------------------------------------------------------------------------

EXTRACTION_PROMPT = """You are analyzing a police/fire scanner transcript from Kansas City, MO.
Extract any distinct emergency incidents mentioned. For each incident, provide:

1. category: The type of incident (e.g., shooting, fire, accident, medical, robbery, assault, pursuit, etc.)
2. title: A brief descriptive title (under 80 characters)
3. description: A 1-2 sentence summary of what was reported
4. address: The street address or intersection mentioned, if any (return null if none)
5. severity: One of "info", "low", "medium", "high", "critical"

Return a JSON array of incidents. If no clear incidents are found, return an empty array [].
Only include incidents where you can identify a specific event, not routine radio checks or status updates.

Transcript:
{transcript}

Respond with ONLY valid JSON, no markdown formatting."""

_ollama_lock = threading.Lock()


def extract_incidents_from_transcript(transcript: str) -> list[dict]:
    if len(transcript.strip()) < MIN_TRANSCRIPT_LENGTH:
        return []

    prompt = EXTRACTION_PROMPT.format(transcript=transcript)

    try:
        with _ollama_lock:
            resp = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 1024},
                },
                timeout=120,
            )
        resp.raise_for_status()
        raw_text = resp.json().get("response", "").strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

        incidents = json.loads(raw_text)
        if not isinstance(incidents, list):
            return []

        for inc in incidents:
            if "severity" in inc:
                inc["severity"] = inc["severity"].strip().lower()

        logger.info("Extracted %d incidents from transcript (model=%s)", len(incidents), OLLAMA_MODEL)
        return incidents

    except json.JSONDecodeError:
        logger.warning("Failed to parse LLM JSON: %s", raw_text[:200] if 'raw_text' in dir() else "(empty)")
        return []
    except requests.ConnectionError:
        logger.error("Cannot reach Ollama at %s", OLLAMA_URL)
        return []
    except Exception:
        logger.exception("LLM extraction failed")
        return []


# ---------------------------------------------------------------------------
# Nominatim geocoding
# ---------------------------------------------------------------------------

def geocode_address(address: str) -> Optional[tuple[float, float]]:
    if not address:
        return None
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": f"{address}, Kansas City, MO", "format": "json", "limit": 1, "countrycodes": "us"},
            headers=NOMINATIM_HEADERS, timeout=10,
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            return (float(results[0]["lat"]), float(results[0]["lon"]))
        return None
    except Exception:
        logger.exception("Geocoding failed for: %s", address)
        return None


# ---------------------------------------------------------------------------
# Per-feed processing loop
# ---------------------------------------------------------------------------

KC_CENTER_LAT = 39.0997
KC_CENTER_LNG = -94.5786


def feed_loop(feed: dict):
    """Capture, transcribe, and extract incidents for a single feed. Runs in its own thread."""
    feed_id = feed["id"]
    feed_name = feed["name"]
    stream_url = feed["url"]
    incident_counter = 0

    logger.info("[%s] Feed loop starting: %s (%s)", feed_id, feed_name, stream_url)

    while True:
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                wav_path = tmp.name

            success = capture_audio(stream_url, CAPTURE_DURATION, wav_path)

            if success:
                rms = compute_rms(wav_path)

                if rms > MIN_SPEECH_ENERGY:
                    transcript = transcribe_audio(wav_path)

                    if transcript:
                        # Store transcript for live display
                        store_transcript(feed_id, feed_name, transcript, rms)

                        # Extract incidents
                        extracted = extract_incidents_from_transcript(transcript)
                        for incident_data in extracted:
                            title = incident_data.get("title", "Scanner Incident")
                            raw_category = incident_data.get("category", "other")
                            description = incident_data.get("description")
                            address = incident_data.get("address")
                            raw_severity = incident_data.get("severity", "info")

                            category, emoji, mapped_severity = map_scanner_category(raw_category)
                            severity_order = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
                            severity = raw_severity if severity_order.get(raw_severity, 0) > severity_order.get(mapped_severity, 0) else mapped_severity

                            lat, lng = KC_CENTER_LAT, KC_CENTER_LNG
                            geocoded = False
                            if address:
                                coords = geocode_address(address)
                                if coords:
                                    lat, lng = coords
                                    geocoded = True

                            # Continued radio traffic about the same event
                            # updates the existing incident (an activity
                            # heartbeat) instead of duplicating it. Geocoded
                            # locations only: the center fallback point would
                            # merge unrelated events.
                            matched_id = find_recent_scanner_match(category, lat, lng) if geocoded else None
                            if matched_id:
                                source_id = matched_id
                            else:
                                incident_counter += 1
                                ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
                                source_id = f"scanner_{feed_id}_{ts}_{incident_counter}"

                            upsert_incident(
                                source="scanner",
                                source_id=source_id,
                                category=category,
                                severity=severity,
                                title=title,
                                description=description,
                                emoji=emoji,
                                latitude=lat,
                                longitude=lng,
                                address=address,
                                raw_data={
                                    "transcript": transcript,
                                    "extracted": incident_data,
                                    "stream_url": stream_url,
                                    "feed_id": feed_id,
                                    "feed_name": feed_name,
                                },
                            )
                else:
                    logger.debug("[%s] No speech detected (RMS=%.0f)", feed_id, rms)

            try:
                os.unlink(wav_path)
            except OSError:
                pass

        except Exception:
            logger.exception("[%s] Feed processing cycle failed", feed_id)

        time.sleep(POLL_INTERVAL)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    logger.info("Scanner worker starting with %d feeds (model=%s)", len(SCANNER_FEEDS), OLLAMA_MODEL)
    for feed in SCANNER_FEEDS:
        logger.info("  Feed: %s (%s) -> %s", feed["id"], feed["name"], feed["url"])

    # Pre-load Whisper model
    try:
        get_whisper_model()
    except Exception:
        logger.error("Cannot load Whisper model, scanner will not transcribe")

    # Verify Ollama connectivity
    try:
        resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        models = [m["name"] for m in resp.json().get("models", [])]
        logger.info("Ollama connected: %s (models: %s)", OLLAMA_URL, models)
    except Exception:
        logger.warning("Cannot reach Ollama at %s", OLLAMA_URL)

    # Launch a thread per feed
    threads = []
    for feed in SCANNER_FEEDS:
        t = threading.Thread(target=feed_loop, args=(feed,), daemon=True, name=f"feed-{feed['id']}")
        t.start()
        threads.append(t)
        logger.info("Started thread for feed: %s", feed["id"])

    # Keep main thread alive
    try:
        while True:
            time.sleep(60)
            alive = sum(1 for t in threads if t.is_alive())
            logger.info("Feed threads alive: %d/%d", alive, len(threads))
    except KeyboardInterrupt:
        logger.info("Scanner worker shutting down")


if __name__ == "__main__":
    main()
