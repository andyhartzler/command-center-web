"""Citizen app incident poller for the Kansas City metro area."""

import logging
import time
from datetime import datetime, timezone

import requests

from workers.db_writer import upsert_incident
from workers.emoji_mapper import map_citizen_category

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("citizen-poller")

# Kansas City metro bounding box
CITIZEN_API_URL = "https://citizen.com/api/incident/trending"
CITIZEN_PARAMS = {
    "lowerLatitude": 38.85,
    "lowerLongitude": -94.75,
    "upperLatitude": 39.35,
    "upperLongitude": -94.35,
    "fullResponse": "true",
    "limit": 100,
}

POLL_INTERVAL = 60  # seconds

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json",
}


def parse_citizen_incident(incident: dict) -> dict | None:
    """Parse a single Citizen API incident into our schema."""
    try:
        key = incident.get("key") or incident.get("id")
        if not key:
            return None

        title = incident.get("title", "").strip()
        if not title:
            return None

        # Location
        lat = incident.get("latitude")
        lng = incident.get("longitude")
        if lat is None or lng is None:
            # Try nested location object
            location = incident.get("location", {})
            lat = location.get("latitude")
            lng = location.get("longitude")
        if lat is None or lng is None:
            return None

        # Category
        raw_category = incident.get("categories", ["other"])
        if isinstance(raw_category, list):
            raw_category = raw_category[0] if raw_category else "other"
        category, emoji, severity = map_citizen_category(str(raw_category))

        # Timestamp
        created_at = incident.get("createdAt") or incident.get("ts")
        if created_at:
            if isinstance(created_at, (int, float)):
                # Citizen uses millisecond timestamps
                if created_at > 1e12:
                    created_at = created_at / 1000
                detected_at = datetime.fromtimestamp(created_at, tz=timezone.utc)
            else:
                detected_at = datetime.now(timezone.utc)
        else:
            detected_at = datetime.now(timezone.utc)

        # Description from updates (can be a dict keyed by ID or a list)
        raw_updates = incident.get("updates", {})
        if isinstance(raw_updates, dict):
            updates = raw_updates.values()
        elif isinstance(raw_updates, list):
            updates = raw_updates
        else:
            updates = []
        description_parts = []
        for update in updates:
            if isinstance(update, str):
                text = update.strip()
            elif isinstance(update, dict):
                text = update.get("text", "").strip()
            else:
                continue
            if text and text != title:
                description_parts.append(text)
        description = " | ".join(description_parts) if description_parts else None

        # Address
        address = incident.get("address") or incident.get("location", {}).get("address")

        return {
            "source": "citizen",
            "source_id": str(key),
            "category": category,
            "severity": severity,
            "title": title,
            "description": description,
            "emoji": emoji,
            "latitude": float(lat),
            "longitude": float(lng),
            "address": address,
            "detected_at": detected_at,
            "raw_data": incident,
        }
    except Exception:
        logger.exception("Failed to parse Citizen incident: %s", incident.get("key", "unknown"))
        return None


def poll_citizen():
    """Fetch and process trending incidents from Citizen."""
    try:
        resp = requests.get(
            CITIZEN_API_URL,
            params=CITIZEN_PARAMS,
            headers=HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        # Response can be a dict with "results" key or a bare list
        if isinstance(data, dict):
            incidents = data.get("results", [])
        elif isinstance(data, list):
            incidents = data
        else:
            logger.warning("Unexpected Citizen API response type: %s", type(data))
            return 0

        count = 0
        for raw_incident in incidents:
            parsed = parse_citizen_incident(raw_incident)
            if parsed is None:
                continue

            result = upsert_incident(**parsed)
            if result:
                count += 1

        logger.info("Citizen poll complete: %d incidents upserted from %d raw", count, len(incidents))
        return count

    except requests.RequestException:
        logger.exception("Citizen API request failed")
        return 0
    except Exception:
        logger.exception("Citizen poll error")
        return 0


def main():
    """Run the Citizen poller loop."""
    logger.info("Citizen poller starting (interval=%ds)", POLL_INTERVAL)

    while True:
        poll_citizen()
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
