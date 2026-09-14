-- =====================================================================
-- Least-privilege application database user.
-- Run this AFTER 01_schema.sql, as a privileged/root MySQL user.
-- Replace 'change_me' with the same password you put in backend/.env
--
-- TiDB Cloud ONLY: every username on TiDB Cloud must include your
-- cluster's unique prefix, not just the root user — a plain
-- 'registry_app' will fail to connect with "Missing user name prefix".
-- Find your prefix in the TiDB Cloud Connect panel (it's the part
-- before ".root" in the username shown there, e.g. if your root user
-- is "3xAbC123.root", your prefix is "3xAbC123"). Replace every
-- occurrence of registry_app below with <your-prefix>.registry_app
-- (keep the quotes). On real MySQL/MariaDB (not TiDB), leave it as
-- plain 'registry_app' — no prefix needed there.
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
