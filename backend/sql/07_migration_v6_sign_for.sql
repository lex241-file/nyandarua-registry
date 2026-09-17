-- =====================================================================
-- Migration v6 — "sign for" another user.
--
-- Lets the person currently holding a pending_accept assignment sign
-- for it on behalf of a different (regular) user — e.g. picking up a
-- file as a courier/colleague. The file then belongs to whoever it was
-- signed for (shows in their My Files, they're responsible for
-- returning it), while signed_by_id keeps a permanent record of who
-- physically signed for it, so admin can see both.
--
-- Run after 06_migration_v5_notes.sql.
-- =====================================================================

USE nyandarua_registry;

ALTER TABLE requests ADD COLUMN signed_by_id BIGINT UNSIGNED NULL AFTER assigned_to_id;
ALTER TABLE requests
  ADD CONSTRAINT fk_req_signed_by FOREIGN KEY (signed_by_id) REFERENCES users(id) ON DELETE SET NULL;
