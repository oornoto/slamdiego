-- =============================================================================
-- Persistent daily cache for the Padres "fact of the day".
--
-- Why: GET /api/padres-fact triggers up to two paid Anthropic (web-search) calls.
--   Without a shared cache, anyone can loop the unauthenticated endpoint and run
--   up the bill. The fact is global per calendar day, so one row per day is all
--   we need. The API writes/reads this table with the service-role client
--   (dashboard schema), so no RLS policy for anon/authenticated is required —
--   the table is only ever touched server-side.
--
-- Safe to run repeatedly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS dashboard.padres_fact_cache (
    fact_date  date        PRIMARY KEY,   -- YYYY-MM-DD in US/Eastern
    fact       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on, with no policies: blocks anon/authenticated entirely. The service role
-- bypasses RLS, so the API keeps working while the browser can never read/write it.
ALTER TABLE dashboard.padres_fact_cache ENABLE ROW LEVEL SECURITY;
