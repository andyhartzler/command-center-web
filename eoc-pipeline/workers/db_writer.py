"""Database writer for upserting EOC incidents."""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

import psycopg2
import psycopg2.extras

logger = logging.getLogger("eoc-db-writer")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://eoc:eoc_secure_2026_pipeline@localhost:5433/eoc",
)


def get_connection():
    """Create a new database connection."""
    return psycopg2.connect(DATABASE_URL)


def upsert_incident(
    source: str,
    source_id: str,
    category: str,
    severity: str,
    title: str,
    emoji: str,
    latitude: float,
    longitude: float,
    description: Optional[str] = None,
    address: Optional[str] = None,
    detected_at: Optional[datetime] = None,
    resolved_at: Optional[datetime] = None,
    raw_data: Optional[dict[str, Any]] = None,
) -> Optional[str]:
    """Upsert an incident into the database.

    Uses ON CONFLICT (source, source_id) to update existing records.
    Returns the incident UUID as a string, or None on failure.
    """
    if detected_at is None:
        detected_at = datetime.now(timezone.utc)

    raw_json = json.dumps(raw_data) if raw_data else None

    sql = """
        INSERT INTO eoc_incidents (
            source, source_id, category, severity, title, description,
            emoji, latitude, longitude, address, detected_at, updated_at,
            resolved_at, raw_data
        ) VALUES (
            %(source)s, %(source_id)s, %(category)s, %(severity)s, %(title)s,
            %(description)s, %(emoji)s, %(latitude)s, %(longitude)s,
            %(address)s, %(detected_at)s, now(), %(resolved_at)s, %(raw_data)s
        )
        ON CONFLICT (source, source_id) DO UPDATE SET
            category = EXCLUDED.category,
            severity = EXCLUDED.severity,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            emoji = EXCLUDED.emoji,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            address = EXCLUDED.address,
            updated_at = now(),
            resolved_at = EXCLUDED.resolved_at,
            raw_data = EXCLUDED.raw_data
        RETURNING id
    """

    params = {
        "source": source,
        "source_id": source_id,
        "category": category,
        "severity": severity,
        "title": title,
        "description": description,
        "emoji": emoji,
        "latitude": latitude,
        "longitude": longitude,
        "address": address,
        "detected_at": detected_at,
        "resolved_at": resolved_at,
        "raw_data": raw_json,
    }

    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            conn.commit()
            incident_id = str(row[0]) if row else None
            logger.info(
                "Upserted incident %s [%s/%s]: %s",
                incident_id, source, source_id, title,
            )
            return incident_id
    except psycopg2.Error:
        logger.exception("Failed to upsert incident [%s/%s]", source, source_id)
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()


def find_recent_scanner_match(category, latitude, longitude, window_minutes=120, radius_deg=0.003):
    """Return the source_id of a recent unresolved scanner incident of the
    same category within ~300m, so continued radio traffic about the same
    event bumps one incident (an activity heartbeat) instead of creating a
    duplicate. Callers must only pass genuinely geocoded coordinates: the
    KC-center fallback point would merge unrelated events."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT source_id FROM eoc_incidents
            WHERE source = %s AND category = %s AND resolved_at IS NULL
              AND updated_at > now() - make_interval(mins => %s)
              AND latitude BETWEEN %s AND %s
              AND longitude BETWEEN %s AND %s
            ORDER BY updated_at DESC LIMIT 1
            """,
            ("scanner", category, window_minutes,
             latitude - radius_deg, latitude + radius_deg,
             longitude - radius_deg, longitude + radius_deg),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row[0] if row else None
    except Exception:
        logger.exception("Scanner match lookup failed")
        return None
