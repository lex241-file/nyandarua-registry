-- =====================================================================
-- Migration v7 — Forward and Sign For both become visible to BOTH
-- parties, not just the new holder.
--
-- signed_by_id already exists (migration v6) and already lets the
-- signer be distinguished from the actual holder (assigned_to_id).
-- This adds the equivalent for Forward: forwarded_from_id records who
-- last forwarded the file, so they can still see it (marked as "now
-- with X") even though assigned_to_id has moved on to the new holder.
--
-- Also makes 'forwarded' a real, loggable movement action — Forward
-- now shows up in admin/File Movement, reversing the earlier
-- "off the record" design for that feature.
--
-- Run after 07_migration_v6_sign_for.sql.
-- =====================================================================

USE nyandarua_registry;

ALTER TABLE requests ADD COLUMN forwarded_from_id BIGINT UNSIGNED NULL AFTER signed_by_id;
ALTER TABLE requests
  ADD CONSTRAINT fk_req_forwarded_from FOREIGN KEY (forwarded_from_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE movements
  MODIFY COLUMN action ENUM('pending','pending_accept','accepted','returned','rejected_auto','release','forwarded')
  NOT NULL;
