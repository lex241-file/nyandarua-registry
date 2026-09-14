-- =====================================================================
-- Migration v4 — urgent requests and "please collect this" release flag.
--
-- Run after 02_migration_v2.sql. Safe against an already-live database;
-- only adds columns and one enum value.
-- =====================================================================

USE nyandarua_registry;

-- A user can mark a request urgent when submitting it. Urgent requests
-- are shown first (and flagged) in the admin's pending-approval queue.
ALTER TABLE requests ADD COLUMN is_urgent TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

-- A user holding an accepted file can ping admin that it should be
-- collected/returned, without changing the file's actual status.
ALTER TABLE requests ADD COLUMN release_requested TINYINT(1) NOT NULL DEFAULT 0 AFTER is_urgent;

-- Add 'release' as a loggable movement action, for the audit trail entry
-- created when a user presses the Release button.
ALTER TABLE movements
  MODIFY COLUMN action ENUM('pending','pending_accept','accepted','returned','rejected_auto','release')
  NOT NULL;
