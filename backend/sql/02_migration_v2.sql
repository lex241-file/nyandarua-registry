-- =====================================================================
-- Migration v2 — restores original prototype's full feature set:
-- approval workflow, auto-reject, file sub-categories, rich movement
-- tracking fields, confidential file category, notification counts.
--
-- Safe to run against your already-seeded database — this ALTERs
-- existing tables and migrates existing status values rather than
-- dropping anything. Run AFTER 01_schema.sql and 03_app_user.sql.
-- In TiDB's web SQL Editor, run one statement at a time as before.
-- =====================================================================

USE nyandarua_registry;

-- ---------------------------------------------------------------------
-- 1. registry_files: 'confidential' category + per-file sub-category
--    (Personal / Interns / Semi-Active with 8 sub-types) — this is what
--    files.routes.ts and stats.routes.ts actually filter/group on.
-- ---------------------------------------------------------------------
ALTER TABLE registry_files
  MODIFY COLUMN category ENUM('general','personal','custom','confidential') NOT NULL DEFAULT 'general';

ALTER TABLE registry_files
  ADD COLUMN sub_category ENUM(
    'personal','interns','retired','deceased','transferred',
    'dismissed','end_contract','resigned','gov_appointee','olkalau'
  ) NULL AFTER category;

-- ---------------------------------------------------------------------
-- 2. users: file_category — the category shown/set on the Add/Edit User
--    form (users.routes.ts reads/writes this exact column name).
-- ---------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN file_category ENUM(
    'personal','interns','retired','deceased','transferred',
    'dismissed','end_contract','resigned','gov_appointee','olkalau'
  ) NOT NULL DEFAULT 'personal' AFTER role;

-- ---------------------------------------------------------------------
-- 3. requests: restore the original 5-state lifecycle.
--    pending         = requester asked, awaiting admin approval
--    pending_accept  = admin approved/assigned, awaiting recipient accept
--    accepted        = recipient confirmed receipt
--    returned        = file returned to registry
--    rejected_auto   = not accepted within 12 hours (special users exempt)
--    Two-step ALTER so existing test rows migrate safely.
-- ---------------------------------------------------------------------
ALTER TABLE requests
  MODIFY COLUMN status ENUM(
    'requested','assigned','accepted','returned','declined',
    'pending','pending_accept','rejected_auto'
  ) NOT NULL DEFAULT 'pending';

UPDATE requests SET status = 'pending' WHERE status = 'requested';
UPDATE requests SET status = 'pending_accept' WHERE status = 'assigned';
UPDATE requests SET status = 'rejected_auto' WHERE status = 'declined';

ALTER TABLE requests
  MODIFY COLUMN status ENUM('pending','pending_accept','accepted','returned','rejected_auto')
  NOT NULL DEFAULT 'pending';

-- ---------------------------------------------------------------------
-- 4. requests: rich per-assignment tracking fields (Registry Code,
--    Action Folio, Last Folio, Reason, Actioned/Not Actioned/Proceed-To
--    status + destination, who returned it). bring_up_note already
--    existed in the original schema and is reused as-is.
-- ---------------------------------------------------------------------
ALTER TABLE requests ADD COLUMN registry_code VARCHAR(64) NULL AFTER file_id;
ALTER TABLE requests ADD COLUMN action_folio VARCHAR(64) NULL AFTER registry_code;
ALTER TABLE requests ADD COLUMN last_folio VARCHAR(64) NULL AFTER action_folio;
ALTER TABLE requests ADD COLUMN reason TEXT NULL AFTER last_folio;
ALTER TABLE requests ADD COLUMN file_status ENUM('actioned','not_actioned','proceed_to') NULL AFTER reason;
ALTER TABLE requests ADD COLUMN proceed_to_dest ENUM(
    'chief_public_service','cs','dhrm','ddhrm','hro','payroll','fleet_manager'
  ) NULL AFTER file_status;
ALTER TABLE requests ADD COLUMN returned_by_id BIGINT UNSIGNED NULL AFTER returned_date;
ALTER TABLE requests
  ADD CONSTRAINT fk_req_returned_by FOREIGN KEY (returned_by_id) REFERENCES users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 5. movements: mirror the same status vocabulary AND the same rich
--    tracking fields, since every request update writes a matching
--    movement row carrying this detail into the permanent audit log.
-- ---------------------------------------------------------------------
ALTER TABLE movements
  MODIFY COLUMN action ENUM(
    'requested','assigned','accepted','returned','declined','reassigned',
    'pending','pending_accept','rejected_auto'
  ) NOT NULL;

UPDATE movements SET action = 'pending' WHERE action = 'requested';
UPDATE movements SET action = 'pending_accept' WHERE action = 'assigned';
UPDATE movements SET action = 'rejected_auto' WHERE action = 'declined';

ALTER TABLE movements
  MODIFY COLUMN action ENUM('pending','pending_accept','accepted','returned','rejected_auto')
  NOT NULL;

ALTER TABLE movements ADD COLUMN registry_code VARCHAR(64) NULL AFTER file_id;
ALTER TABLE movements ADD COLUMN action_folio VARCHAR(64) NULL AFTER notes;
ALTER TABLE movements ADD COLUMN last_folio VARCHAR(64) NULL AFTER action_folio;
ALTER TABLE movements ADD COLUMN reason TEXT NULL AFTER last_folio;
ALTER TABLE movements ADD COLUMN file_status ENUM('actioned','not_actioned','proceed_to') NULL AFTER reason;
ALTER TABLE movements ADD COLUMN proceed_to_dest ENUM(
    'chief_public_service','cs','dhrm','ddhrm','hro','payroll','fleet_manager'
  ) NULL AFTER file_status;
ALTER TABLE movements ADD COLUMN bring_up_note TEXT NULL AFTER proceed_to_dest;

-- ---------------------------------------------------------------------
-- Done. Verify with:
--   SHOW COLUMNS FROM requests;
--   SHOW COLUMNS FROM movements;
--   SHOW COLUMNS FROM users;
--   SHOW COLUMNS FROM registry_files;
-- ---------------------------------------------------------------------
