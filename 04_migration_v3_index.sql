-- =====================================================================
-- Migration v3 — performance index.
--
-- The "is this file currently out?" check (used every time the Files
-- browser loads, and every time a request is created) runs a correlated
-- subquery against `requests` filtered by file_id + status for every row
-- of the current file list. Without a composite index covering both
-- columns together, this can get slow once `requests` has a meaningful
-- number of rows — especially on TiDB Cloud's shared serverless tier.
--
-- Safe to run any time; adding an index doesn't change any data.
-- =====================================================================

USE nyandarua_registry;

CREATE INDEX idx_requests_file_status ON requests (file_id, status);
