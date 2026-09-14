-- =====================================================================
-- Least-privilege application database user.
-- Run this AFTER 01_schema.sql, as a privileged/root MySQL user.
-- Replace 'change_me' with the same password you put in backend/.env
-- =====================================================================

CREATE USER IF NOT EXISTS 'registry_app'@'%' IDENTIFIED BY 'change_me';

-- Full CRUD on everything except movements...
GRANT SELECT, INSERT, UPDATE, DELETE ON nyandarua_registry.users            TO 'registry_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON nyandarua_registry.registry_files   TO 'registry_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON nyandarua_registry.requests         TO 'registry_app'@'%';

-- ...but on movements the app user can only SELECT and INSERT.
-- Combined with the triggers in 01_schema.sql, this means the audit
-- trail cannot be altered or erased even if application code has a bug,
-- and even by whoever holds the app's DB credentials.
GRANT SELECT, INSERT ON nyandarua_registry.movements TO 'registry_app'@'%';

FLUSH PRIVILEGES;
