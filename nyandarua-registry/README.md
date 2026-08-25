# Nyandarua County Registry System

A multi-user file registry and tracking system for Nyandarua County
Government: staff can request registry files, admins assign and track
them, and every movement is recorded in a permanent, tamper-proof audit
log.

This is a full rewrite of the original single-file HTML prototype into
a real client/server application:

- **`backend/`** — Node.js + Express + TypeScript API, MySQL database
- **`frontend/`** — React + TypeScript SPA (Vite), talks to the API over HTTP/JSON

Google Sheets sync has been removed entirely — MySQL is now the single
source of truth for every user, file, request, and movement.

---

## 1. Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+ (or MariaDB 10.5+) running somewhere you can reach — locally,
  on a county server, or a managed host (PlanetScale, RDS, DigitalOcean, etc.)

## 2. Set up the database

```bash
cd backend/sql
mysql -u root -p < 01_schema.sql      # creates the database, tables, and audit-log triggers
mysql -u root -p < 03_app_user.sql    # creates a least-privilege app user (edit the password first!)
```

Open `03_app_user.sql` and change `'change_me'` to a strong password
**before** running it — that password goes into `backend/.env` next.

## 3. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
- `DB_USER` / `DB_PASSWORD` — match what you set in `03_app_user.sql`
- `JWT_SECRET` — generate a real one:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `CORS_ORIGIN` — the URL your frontend will be served from in production

Install dependencies and import your existing personnel/file data:

```bash
npm install
npm run seed     # imports the 2,879 personnel records + 210 general files
                  # and creates the 3 admin + 2 special accounts
```

The seed step takes a few minutes — every account's password is bcrypt-hashed
individually. Every imported account's **default password is their ID
number** (or file number if no ID is on record), and every account is
flagged to require a password change on first login.

Run the API:

```bash
npm run dev       # development, auto-reload
# or for production:
npm run build && npm start
```

The API listens on `http://localhost:4000` by default. Check
`http://localhost:4000/health` to confirm it can reach MySQL.

## 4. Configure and run the frontend

```bash
cd frontend
npm install
npm run dev        # development server on http://localhost:5173, proxies /api to :4000
```

For production:

```bash
npm run build       # outputs static files to frontend/dist
```

Deploy `frontend/dist` to any static host (Nginx, Netlify, S3+CloudFront,
the county's existing web server, etc.), and point it at your deployed
API by setting `CORS_ORIGIN` on the backend to that frontend's URL.

## 5. First login

Log in with any imported file number and the default password (ID
number / file number). Admin accounts:

| File number   | Name           |
|---------------|----------------|
| ADMIN001      | Amos Kihara    |
| 20210525517   | Alex Kariithi  |
| 20210525525   | Edita Wairimu  |

**Change these default passwords immediately after your first login**,
and have every staff member do the same — the seed data is derived
directly from your uploaded spreadsheets and default passwords are
national ID numbers.

---

## Security notes

- **SQL injection**: every database query in `backend/src/routes/*`
  uses `mysql2` parameterized placeholders (`?`) — user input is never
  concatenated into SQL strings.
- **Passwords**: hashed with bcrypt (cost 12 for interactively created
  accounts, cost 10 for the bulk seed import), never stored or logged
  in plaintext.
- **Audit log immutability**: the `movements` table can only be
  inserted into and read from — enforced three ways: (1) no update/delete
  route exists in the API, (2) the app's MySQL user has no UPDATE/DELETE
  grant on that table (`sql/03_app_user.sql`), and (3) MySQL triggers
  (`sql/01_schema.sql`) reject any UPDATE/DELETE on the table outright,
  even from a different, more privileged database connection.
- **User deletion**: there is no hard-delete route for users or personnel
  files. "Removing" a user only sets `is_active = 0`; their record and
  full history are preserved.
- **Secrets**: `.env` is gitignored. Never commit real credentials —
  only `.env.example` (with placeholder values) is tracked.
- **Rate limiting**: login attempts are throttled per IP.

- **Forced password change**: accounts imported with a default
  password (their ID number) are flagged `must_change_password`. The
  frontend enforces this — any authenticated route other than
  `/change-password` redirects there until the user sets their own
  password (`RequireAuth.tsx` + `pages/ChangePassword.tsx`). There's
  also a "Change password" link in the nav bar for voluntary changes
  at any time.

## Before you deploy this to a public/production host

This app now handles real staff national ID numbers. A few things worth
doing before go-live, beyond what's built in already:
1. Put the API behind HTTPS (a reverse proxy like Nginx/Caddy with a
   free Let's Encrypt certificate is the easiest route).
2. Restrict MySQL to only accept connections from the backend server
   (don't expose port 3306 publicly).
3. Take regular database backups (`mysqldump` on a cron job is a fine start).
# nyandarua-registry
