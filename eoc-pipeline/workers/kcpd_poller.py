"""KCPD crime data poller using the Kansas City Open Data (Socrata) API."""

import logging
import time
from datetime import datetime, timezone, timedelta

import requests

from workers.db_writer import upsert_incident
from workers.emoji_mapper import map_kcpd_offense

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("kcpd-poller")

KCPD_API_URL = "https://data.kcmo.org/resource/f7wj-ckmw.json"
POLL_INTERVAL = 300  # seconds (5 minutes)

# Socrata app token is optional but avoids throttling
HEADERS = {
    "Accept": "application/json",
}


def build_soql_query() -> dict:
    """Build SoQL query parameters for the last 24 hours of KCPD data."""
    # KCPD data has ~7 day lag, so query a wider window
    since = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S")
    return {
        "$where": f"report_date > '{since}'",
        "$order": "report_date DESC",
        "$limit": 1000,
    }


def parse_kcpd_record(record: dict) -> dict | None:
    """Parse a single KCPD Socrata record into our incident schema."""
    try:
        # Source ID: use report_no or ibrs field
        source_id = record.get("report") or record.get("report_no") or record.get("ibrs")
        if not source_id:
            return None

        # Offense description for categorization
        offense = record.get("offense", record.get("description", "Unknown Offense"))
        category, emoji, severity = map_kcpd_offense(offense)

        # Title
        title = offense.strip().title()
        if not title:
            title = "KCPD Reported Incident"

        # Coordinates: location.coordinates is [longitude, latitude] (GeoJSON order)
        location = record.get("location")
        lat = None
        lng = None

        if location and isinstance(location, dict):
            coords = location.get("coordinates")
            if coords and len(coords) >= 2:
                lng = float(coords[0])
                lat = float(coords[1])

        # Fallback to separate lat/lng fields
        if lat is None or lng is None:
            lat_str = record.get("latitude")
            lng_str = record.get("longitude")
            if lat_str and lng_str:
                lat = float(lat_str)
                lng = float(lng_str)

        if lat is None or lng is None:
            return None

        # Validate coordinates are in KC metro area (rough check)
        if not (38.5 < lat < 39.5 and -95.0 < lng < -94.0):
            return None

        # Timestamp
        date_str = record.get("report_date") or record.get("date_time")
        if date_str:
            try:
                detected_at = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                if detected_at.tzinfo is None:
                    detected_at = detected_at.replace(tzinfo=timezone.utc)
            except ValueError:
                detected_at = datetime.now(timezone.utc)
        else:
            detected_at = datetime.now(timezone.utc)

        # Address
        address_parts = []
        if record.get("address"):
            address_parts.append(record["address"])
        if record.get("city"):
            address_parts.append(record["city"])
        address = ", ".join(address_parts) if address_parts else None

        # Description from additional fields
        desc_parts = []
        if record.get("involvement"):
            desc_parts.append(f"Involvement: {record['involvement']}")
        if record.get("area"):
            desc_parts.append(f"Area: {record['area']}")
        dvflag = record.get("dvflag")
        if dvflag is True or (isinstance(dvflag, str) and dvflag.upper() == "Y"):
            desc_parts.append("Domestic violence flagged")
        description = "; ".join(desc_parts) if desc_parts else None

        return {
            "source": "kcpd",
            "source_id": str(source_id),
            "category": category,
            "severity": severity,
            "title": title,
            "description": description,
            "emoji": emoji,
            "latitude": lat,
            "longitude": lng,
            "address": address,
            "detected_at": detected_at,
            "raw_data": record,
        }
    except Exception:
        logger.exception(
            "Failed to parse KCPD record: %s",
            record.get("report_no", "unknown"),
        )
        return None


def poll_kcpd():
    """Fetch and process recent KCPD crime data."""
    try:
        params = build_soql_query()
        resp = requests.get(
            KCPD_API_URL,
            params=params,
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        records = resp.json()

        if not isinstance(records, list):
            logger.warning("Unexpected KCPD API response type: %s", type(records))
            return 0

        count = 0
        for record in records:
            parsed = parse_kcpd_record(record)
            if parsed is None:
                continue

            result = upsert_incident(**parsed)
            if result:
                count += 1

        logger.info(
            "KCPD poll complete: %d incidents upserted from %d raw records",
            count, len(records),
        )
        return count

    except requests.RequestException:
        logger.exception("KCPD API request failed")
        return 0
    except Exception:
        logger.exception("KCPD poll error")
        return 0


def main():
    """Run the KCPD poller loop."""
    logger.info("KCPD poller starting (interval=%ds)", POLL_INTERVAL)

    while True:
        poll_kcpd()
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
