# EOC Incident Pipeline

The KC Emergency Operations Center backend that powers the dashboard's EOC
mode and persists dashboard state. Runs on lenovo-worker via Docker Compose
(project `eoc-pipeline`, pinned) at `/opt/command-center-web/eoc-pipeline`.

## Services
- **db**: Postgres 16 on :5433, named volume `eoc-pipeline_pgdata`
- **api**: FastAPI on :8080 (incidents, scanner transcripts, dashboard state,
  WebSocket broadcasters, and the 5-minute signal-driven incident resolver)
- **citizen-poller**: Citizen live feed, 60s cadence (upserts are the
  liveness heartbeat)
- **kcpd-poller**: KCMO open data (f7wj-ckmw), 5-minute cadence; the upstream
  dataset publishes with a multi-day lag, records are historical reports and
  never count as active
- **scanner**: Broadcastify capture -> Whisper transcription -> Ollama
  (gemma3:4b on the host) incident extraction; repeated radio traffic about
  the same geocoded location and category updates one incident

## Active-incident semantics
`resolved_at` is signal-driven per source (see `api/main.py` RESOLVER_SQL):
Citizen follows each incident's own recencyThreshold from its last heartbeat;
scanner incidents resolve after a category-scaled quiet period since the last
radio activity; new activity reopens. KCPD reports resolve at insert.

## Deploying
`.env` (DB_PASSWORD) lives only on the box, never in git.

    cd /opt/command-center-web/eoc-pipeline
    docker compose build && docker compose up -d
