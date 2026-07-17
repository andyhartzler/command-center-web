"""Pydantic models for the EOC API."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class Incident(BaseModel):
    """An EOC incident record."""

    id: UUID
    source: str
    category: str
    severity: str = "info"
    title: str
    description: Optional[str] = None
    emoji: str = "\u26a0\ufe0f"
    latitude: float
    longitude: float
    address: Optional[str] = None
    detected_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    raw_data: Optional[dict[str, Any]] = None
    source_id: Optional[str] = None

    model_config = {"from_attributes": True}


class IncidentList(BaseModel):
    """Response wrapper for a list of incidents."""

    incidents: list[Incident]
    count: int


class SourceHealth(BaseModel):
    """Health status for a single data source."""

    source: str
    last_seen: Optional[datetime] = None
    incident_count: int = 0
    active_count: int = 0


class StatusResponse(BaseModel):
    """Overall system status."""

    sources: list[SourceHealth]
    total_incidents: int
    total_active: int


class WSMessage(BaseModel):
    """WebSocket message envelope."""

    type: str = Field(description="Message type: new_incident, ping, pong, status")
    data: Optional[dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class TranscriptEntry(BaseModel):
    """A single scanner transcript entry."""
    id: int
    feed_id: str
    feed_name: str
    transcript: str
    audio_rms: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScannerFeed(BaseModel):
    """A scanner feed with status info."""
    feed_id: str
    feed_name: str
    last_transcript_at: Optional[datetime] = None
    transcript_count: int = 0
    is_active: bool = False


class ScannerFeedsResponse(BaseModel):
    """Response for scanner feeds listing."""
    feeds: list[ScannerFeed]


class TranscriptListResponse(BaseModel):
    """Response for transcript listing."""
    transcripts: list[TranscriptEntry]
    count: int
