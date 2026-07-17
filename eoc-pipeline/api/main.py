"""FastAPI application for the EOC incident pipeline."""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import FastAPI, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from db import engine, async_session
from models import (
    Incident, IncidentList, SourceHealth, StatusResponse, WSMessage,
    TranscriptEntry, ScannerFeed, ScannerFeedsResponse, TranscriptListResponse,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("eoc-api")


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket client connected. Total: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info("WebSocket client disconnected. Total: %d", len(self.active_connections))

    async def broadcast(self, message: dict):
        dead = []
        payload = json.dumps(message, default=str)
        for ws in self.active_connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Background: incident broadcaster
# ---------------------------------------------------------------------------

async def incident_broadcaster():
    last_check = datetime.now(timezone.utc)
    logger.info("Incident broadcaster started")

    while True:
        try:
            await asyncio.sleep(2)
            if not manager.active_connections:
                last_check = datetime.now(timezone.utc)
                continue

            async with async_session() as session:
                result = await session.execute(
                    text("""
                        SELECT id, source, category, severity, title, description,
                               emoji, latitude, longitude, address, detected_at,
                               updated_at, resolved_at, raw_data, source_id
                        FROM eoc_incidents
                        WHERE updated_at > :since
                        ORDER BY updated_at ASC
                    """),
                    {"since": last_check},
                )
                rows = result.fetchall()

            if rows:
                logger.info("Broadcasting %d new/updated incidents", len(rows))
                for row in rows:
                    incident = Incident(
                        id=row.id, source=row.source, category=row.category,
                        severity=row.severity, title=row.title, description=row.description,
                        emoji=row.emoji, latitude=row.latitude, longitude=row.longitude,
                        address=row.address, detected_at=row.detected_at,
                        updated_at=row.updated_at, resolved_at=row.resolved_at,
                        raw_data=row.raw_data, source_id=row.source_id,
                    )
                    msg = WSMessage(
                        type="new_incident",
                        data=incident.model_dump(mode="json"),
                        timestamp=datetime.now(timezone.utc),
                    )
                    await manager.broadcast(msg.model_dump(mode="json"))
                last_check = datetime.now(timezone.utc)

        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Error in incident broadcaster")
            await asyncio.sleep(5)


# ---------------------------------------------------------------------------
# Background: transcript broadcaster
# ---------------------------------------------------------------------------

async def transcript_broadcaster():
    last_id = 0
    logger.info("Transcript broadcaster started")

    try:
        async with async_session() as session:
            result = await session.execute(text("SELECT COALESCE(MAX(id), 0) FROM scanner_transcripts"))
            last_id = result.scalar() or 0
    except Exception:
        logger.warning("scanner_transcripts table may not exist yet")

    while True:
        try:
            await asyncio.sleep(2)

            if not manager.active_connections:
                try:
                    async with async_session() as session:
                        result = await session.execute(text("SELECT COALESCE(MAX(id), 0) FROM scanner_transcripts"))
                        last_id = result.scalar() or last_id
                except Exception:
                    pass
                continue

            async with async_session() as session:
                result = await session.execute(
                    text("""
                        SELECT id, feed_id, feed_name, transcript, audio_rms, created_at
                        FROM scanner_transcripts
                        WHERE id > :last_id
                        ORDER BY id ASC
                        LIMIT 20
                    """),
                    {"last_id": last_id},
                )
                rows = result.fetchall()

            if rows:
                for row in rows:
                    msg = {
                        "type": "scanner_transcript",
                        "data": {
                            "id": row.id,
                            "feed_id": row.feed_id,
                            "feed_name": row.feed_name,
                            "transcript": row.transcript,
                            "audio_rms": row.audio_rms,
                            "created_at": row.created_at.isoformat() if row.created_at else None,
                        },
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    await manager.broadcast(msg)
                    last_id = row.id

        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Error in transcript broadcaster")
            await asyncio.sleep(5)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------



# ---------------------------------------------------------------------------
# Signal-driven incident resolution
# ---------------------------------------------------------------------------
# resolved_at is derived from each source's own liveness signal, not a crude
# global TTL:
# - kcpd: historical crime reports, never operationally active
# - citizen: the poller re-upserts (bumping updated_at) while Citizen still
#   lists the incident; once it leaves the feed, resolution follows the
#   incident's own recencyThreshold contract from its last heartbeat
# - scanner: continued radio traffic about the same event bumps updated_at
#   (see find_recent_scanner_match); resolution = last radio activity plus a
#   category-scaled operational window
# New activity reopens: upserts write resolved_at = NULL on conflict.

RESOLVER_SQL = """
UPDATE eoc_incidents SET resolved_at = sub.resolve_ts FROM (
  SELECT id, CASE
    WHEN source = 'kcpd' THEN detected_at
    WHEN source = 'citizen' THEN updated_at
      + make_interval(secs => COALESCE(NULLIF(raw_data->>'recencyThreshold','')::numeric, 7200))
    WHEN category IN ('fire','hazmat') THEN updated_at + interval '4 hours'
    WHEN category IN ('shooting','pursuit','robbery','assault','domestic','missing_person')
      THEN updated_at + interval '3 hours'
    WHEN category IN ('traffic','rescue','disturbance','burglary','theft','suspicious')
      THEN updated_at + interval '2 hours'
    WHEN category = 'medical' THEN updated_at + interval '1 hour'
    ELSE updated_at + interval '90 minutes'
  END AS resolve_ts
  FROM eoc_incidents WHERE resolved_at IS NULL
) sub
WHERE eoc_incidents.id = sub.id AND sub.resolve_ts <= now()
"""


async def incident_resolver():
    """Every 5 minutes, resolve incidents whose liveness signal has lapsed."""
    while True:
        try:
            async with async_session() as session:
                result = await session.execute(text(RESOLVER_SQL))
                await session.commit()
                if result.rowcount:
                    logger.info("Resolver: marked %d incidents resolved", result.rowcount)
        except Exception:
            logger.exception("Incident resolver failed")
        await asyncio.sleep(300)


@asynccontextmanager
async def lifespan(app: FastAPI):
    broadcaster_task = asyncio.create_task(incident_broadcaster())
    transcript_task = asyncio.create_task(transcript_broadcaster())
    resolver_task = asyncio.create_task(incident_resolver())
    logger.info("EOC API started")
    yield
    broadcaster_task.cancel()
    transcript_task.cancel()
    resolver_task.cancel()
    try:
        await resolver_task
    except asyncio.CancelledError:
        pass
    try:
        await broadcaster_task
    except asyncio.CancelledError:
        pass
    try:
        await transcript_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="EOC Incident Pipeline API", version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# REST: Incidents
# ---------------------------------------------------------------------------

@app.get("/api/incidents", response_model=IncidentList)
async def get_incidents(
    since: Optional[datetime] = Query(None),
    active: Optional[bool] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    conditions = []
    params: dict = {"limit": limit}

    if since is not None:
        conditions.append("detected_at > :since")
        params["since"] = since
    if active is True:
        conditions.append("resolved_at IS NULL")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    async with async_session() as session:
        result = await session.execute(text(f"""
            SELECT id, source, category, severity, title, description,
                   emoji, latitude, longitude, address, detected_at,
                   updated_at, resolved_at, raw_data, source_id
            FROM eoc_incidents {where}
            ORDER BY detected_at DESC LIMIT :limit
        """), params)
        rows = result.fetchall()

    incidents = [
        Incident(
            id=r.id, source=r.source, category=r.category, severity=r.severity,
            title=r.title, description=r.description, emoji=r.emoji,
            latitude=r.latitude, longitude=r.longitude, address=r.address,
            detected_at=r.detected_at, updated_at=r.updated_at,
            resolved_at=r.resolved_at, raw_data=r.raw_data, source_id=r.source_id,
        )
        for r in rows
    ]
    return IncidentList(incidents=incidents, count=len(incidents))


@app.get("/api/incidents/{incident_id}", response_model=Incident)
async def get_incident(incident_id: UUID):
    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT id, source, category, severity, title, description,
                       emoji, latitude, longitude, address, detected_at,
                       updated_at, resolved_at, raw_data, source_id
                FROM eoc_incidents WHERE id = :id
            """),
            {"id": incident_id},
        )
        row = result.fetchone()

    if row is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Incident not found")

    return Incident(
        id=row.id, source=row.source, category=row.category, severity=row.severity,
        title=row.title, description=row.description, emoji=row.emoji,
        latitude=row.latitude, longitude=row.longitude, address=row.address,
        detected_at=row.detected_at, updated_at=row.updated_at,
        resolved_at=row.resolved_at, raw_data=row.raw_data, source_id=row.source_id,
    )


@app.get("/api/status", response_model=StatusResponse)
async def get_status():
    async with async_session() as session:
        result = await session.execute(text("""
            SELECT source, MAX(detected_at) AS last_seen,
                   COUNT(*) AS incident_count,
                   COUNT(*) FILTER (WHERE resolved_at IS NULL) AS active_count
            FROM eoc_incidents GROUP BY source ORDER BY source
        """))
        rows = result.fetchall()

        total_result = await session.execute(text("""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE resolved_at IS NULL) AS active
            FROM eoc_incidents
        """))
        totals = total_result.fetchone()

    sources = [
        SourceHealth(source=r.source, last_seen=r.last_seen,
                     incident_count=r.incident_count, active_count=r.active_count)
        for r in rows
    ]
    return StatusResponse(
        sources=sources,
        total_incidents=totals.total if totals else 0,
        total_active=totals.active if totals else 0,
    )


# ---------------------------------------------------------------------------
# REST: Scanner feeds & transcripts
# ---------------------------------------------------------------------------

@app.get("/api/scanner/feeds", response_model=ScannerFeedsResponse)
async def get_scanner_feeds():
    async with async_session() as session:
        result = await session.execute(text("""
            SELECT feed_id, feed_name,
                   MAX(created_at) AS last_transcript_at,
                   COUNT(*) AS transcript_count
            FROM scanner_transcripts
            WHERE created_at > now() - interval '24 hours'
            GROUP BY feed_id, feed_name
            ORDER BY feed_id
        """))
        rows = result.fetchall()

    feeds = []
    for row in rows:
        is_active = False
        if row.last_transcript_at:
            age = (datetime.now(timezone.utc) - row.last_transcript_at.replace(tzinfo=timezone.utc)).total_seconds()
            is_active = age < 120
        feeds.append(ScannerFeed(
            feed_id=row.feed_id, feed_name=row.feed_name,
            last_transcript_at=row.last_transcript_at,
            transcript_count=row.transcript_count, is_active=is_active,
        ))

    return ScannerFeedsResponse(feeds=feeds)


@app.get("/api/scanner/transcripts", response_model=TranscriptListResponse)
async def get_scanner_transcripts(
    feed_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    since_id: Optional[int] = Query(None),
):
    conditions = []
    params: dict = {"limit": limit}

    if feed_id:
        conditions.append("feed_id = :feed_id")
        params["feed_id"] = feed_id
    if since_id is not None:
        conditions.append("id > :since_id")
        params["since_id"] = since_id

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    async with async_session() as session:
        result = await session.execute(text(f"""
            SELECT id, feed_id, feed_name, transcript, audio_rms, created_at
            FROM scanner_transcripts {where}
            ORDER BY created_at DESC LIMIT :limit
        """), params)
        rows = result.fetchall()

    transcripts = [
        TranscriptEntry(
            id=r.id, feed_id=r.feed_id, feed_name=r.feed_name,
            transcript=r.transcript, audio_rms=r.audio_rms, created_at=r.created_at,
        )
        for r in rows
    ]
    return TranscriptListResponse(transcripts=transcripts, count=len(transcripts))


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

@app.websocket("/ws/incidents")
async def websocket_incidents(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                msg = {"type": data}

            if msg.get("type") == "ping":
                pong = WSMessage(type="pong", timestamp=datetime.now(timezone.utc))
                await websocket.send_text(json.dumps(pong.model_dump(mode="json"), default=str))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        logger.exception("WebSocket error")
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# REST: Dashboard state persistence
# ---------------------------------------------------------------------------

@app.get("/api/dashboard/state")
async def get_dashboard_state(id: str = Query("default")):
    async with async_session() as session:
        result = await session.execute(
            text("SELECT state_json, updated_at FROM dashboard_state WHERE id = :id"),
            {"id": id},
        )
        row = result.fetchone()

    if row is None:
        return {"state": None, "updated_at": None}

    return {"state": row.state_json, "updated_at": row.updated_at}


@app.put("/api/dashboard/state")
async def put_dashboard_state(request: Request):
    body = await request.json()
    state = body.get("state", {})
    state_id = body.get("id", "default")

    async with async_session() as session:
        await session.execute(
            text("""
                INSERT INTO dashboard_state (id, state_json, updated_at)
                VALUES (:id, :state, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    state_json = :state,
                    updated_at = NOW()
            """),
            {"id": state_id, "state": json.dumps(state)},
        )
        await session.commit()

    return {"ok": True}
