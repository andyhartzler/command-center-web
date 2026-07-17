CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE eoc_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    description TEXT,
    emoji TEXT NOT NULL DEFAULT '⚠️',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    raw_data JSONB,
    source_id TEXT,
    UNIQUE(source, source_id)
);

CREATE INDEX idx_eoc_incidents_detected ON eoc_incidents(detected_at DESC);
CREATE INDEX idx_eoc_incidents_active ON eoc_incidents(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_eoc_incidents_source ON eoc_incidents(source, source_id);

-- Scanner transcripts for live radio feeds
CREATE TABLE IF NOT EXISTS scanner_transcripts (
    id SERIAL PRIMARY KEY,
    feed_id TEXT NOT NULL,
    feed_name TEXT NOT NULL,
    transcript TEXT NOT NULL,
    audio_rms REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scanner_transcripts_feed ON scanner_transcripts(feed_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_transcripts_created ON scanner_transcripts(created_at DESC);

CREATE OR REPLACE FUNCTION purge_old_transcripts() RETURNS trigger AS $$
BEGIN
    DELETE FROM scanner_transcripts WHERE created_at < now() - interval '24 hours';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purge_transcripts ON scanner_transcripts;
CREATE TRIGGER trg_purge_transcripts
    AFTER INSERT ON scanner_transcripts
    FOR EACH STATEMENT
    EXECUTE FUNCTION purge_old_transcripts();
