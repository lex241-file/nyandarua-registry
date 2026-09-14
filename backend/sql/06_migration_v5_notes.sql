-- =====================================================================
-- Migration v5 — notes to admin, with file/photo attachments.
--
-- Attachments are stored as BLOBs directly in the database rather than
-- a separate file-storage service (S3, etc.) — this avoids needing any
-- new third-party account/credentials, and works within your existing
-- TiDB setup. Keep an eye on TiDB Cloud's free-tier storage cap (5 GiB)
-- if staff start attaching large files often; each attachment is capped
-- at 10 MB by the backend to help with that.
--
-- Run after 05_migration_v4.sql.
-- =====================================================================

USE nyandarua_registry;

CREATE TABLE notes (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_id       BIGINT UNSIGNED NOT NULL,
  related_file_id BIGINT UNSIGNED NULL,       -- optional: "this note is about this specific file"
  note_text       TEXT NOT NULL,
  is_read         TINYINT(1) NOT NULL DEFAULT 0,
  read_at         DATETIME NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notes_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_file FOREIGN KEY (related_file_id) REFERENCES registry_files(id) ON DELETE SET NULL,
  INDEX idx_notes_sender (sender_id),
  INDEX idx_notes_read (is_read)
) ENGINE=InnoDB;

CREATE TABLE note_attachments (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  note_id     BIGINT UNSIGNED NOT NULL,
  file_name   VARCHAR(255) NOT NULL,
  mime_type   VARCHAR(100) NOT NULL,
  file_size   INT UNSIGNED NOT NULL,
  file_data   LONGBLOB NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attach_note FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  INDEX idx_attach_note (note_id)
) ENGINE=InnoDB;
