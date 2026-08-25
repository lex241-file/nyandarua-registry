-- =====================================================================
-- Nyandarua County Registry System — MySQL schema
-- =====================================================================
-- Run as a privileged user, e.g.:
--   mysql -u root -p < 01_schema.sql
-- Then create the application user (least privilege) — see 03_app_user.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS nyandarua_registry
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE nyandarua_registry;

-- ---------------------------------------------------------------------
-- USERS
-- Every account that can log in or be assigned files: admins, regular
-- staff, and "special" accounts (County Attorney, CPSB) which get a
-- 3-month due date instead of 7 working days.
--
-- Users are never hard-deleted. "Removing" a user only deactivates
-- their login (is_active = 0); their personnel record and history stay
-- intact, mirroring the original system's behaviour.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  file_number        VARCHAR(64) NOT NULL UNIQUE,
  name               VARCHAR(255) NOT NULL,
  designation        VARCHAR(255) NOT NULL DEFAULT '',
  id_number          VARCHAR(64) NULL,
  role               ENUM('admin','user','special') NOT NULL DEFAULT 'user',
  password_hash      VARCHAR(255) NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  is_active          TINYINT(1) NOT NULL DEFAULT 1,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_active (is_active)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- REGISTRY FILES
-- Both general/system files (imported from GENERAL_REGISTRY_FILES.xlsx)
-- and custom files added later. Personal (personnel) files are linked
-- to a user via owner_user_id.
-- ---------------------------------------------------------------------
CREATE TABLE registry_files (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  file_id         VARCHAR(64) NOT NULL UNIQUE,   -- e.g. CGN/CS_HOPS/HR/1  or PERS_<file_number>
  file_name       VARCHAR(255) NOT NULL,
  file_number     VARCHAR(64) NOT NULL,
  category        ENUM('general','personal','custom') NOT NULL DEFAULT 'general',
  owner_user_id   BIGINT UNSIGNED NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_files_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_files_category (category),
  INDEX idx_files_number (file_number)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- REQUESTS
-- A staff/special-user request or admin assignment of one or more
-- registry files. Tracks lifecycle: requested -> assigned -> accepted
-- -> returned, plus overdue status derived from due_date.
-- ---------------------------------------------------------------------
CREATE TABLE requests (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  file_id          BIGINT UNSIGNED NOT NULL,
  requester_id     BIGINT UNSIGNED NULL,
  assigned_to_id   BIGINT UNSIGNED NULL,
  status           ENUM('requested','assigned','accepted','returned','declined') NOT NULL DEFAULT 'requested',
  requested_date   DATETIME NULL,
  assigned_date    DATETIME NULL,
  accepted_date    DATETIME NULL,
  returned_date    DATETIME NULL,
  due_date         DATETIME NULL,
  bring_up_note    TEXT NULL,
  proceed_to       VARCHAR(255) NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_req_file FOREIGN KEY (file_id) REFERENCES registry_files(id) ON DELETE RESTRICT,
  CONSTRAINT fk_req_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_req_assignee FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_req_status (status),
  INDEX idx_req_due (due_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- MOVEMENTS  (append-only audit log)
-- Every state change to a request (assigned, accepted, returned, etc.)
-- is recorded here permanently. No UPDATE or DELETE is permitted on
-- this table — enforced both at the application layer (no such routes
-- exist) and at the database layer via triggers below, so even a
-- database admin using a raw SQL client cannot silently rewrite
-- history through the app's own credentials.
-- ---------------------------------------------------------------------
CREATE TABLE movements (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id      BIGINT UNSIGNED NOT NULL,
  file_id         BIGINT UNSIGNED NOT NULL,
  action          ENUM('requested','assigned','accepted','returned','declined','reassigned') NOT NULL,
  actor_user_id   BIGINT UNSIGNED NULL,          -- who performed the action
  subject_user_id BIGINT UNSIGNED NULL,          -- who the file moved to/from
  notes           TEXT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mov_request FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mov_file FOREIGN KEY (file_id) REFERENCES registry_files(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mov_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_mov_subject FOREIGN KEY (subject_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_mov_request (request_id),
  INDEX idx_mov_created (created_at)
) ENGINE=InnoDB;

DELIMITER $$

DROP TRIGGER IF EXISTS trg_movements_no_update $$
CREATE TRIGGER trg_movements_no_update
BEFORE UPDATE ON movements
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'movements is an append-only audit log: rows cannot be modified';
END $$

DROP TRIGGER IF EXISTS trg_movements_no_delete $$
CREATE TRIGGER trg_movements_no_delete
BEFORE DELETE ON movements
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'movements is an append-only audit log: rows cannot be deleted';
END $$

DELIMITER ;
