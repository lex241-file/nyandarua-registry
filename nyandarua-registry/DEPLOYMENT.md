# Deployment Guide

Three ways to put the Nyandarua County Registry System on a real,
public website, from easiest to most hands-on. Pick the one that
matches what you have available — all three end with the same result:
a live URL, HTTPS, and a MySQL database holding your registry data.

You need a domain name for all three (e.g. `registry.nyandarua.go.ke`).
If you don't have one yet, buy one first (any registrar — Namecheap,
Google Domains successor Squarespace Domains, etc.) before starting.

---

## Option A — Managed platforms (Railway or Render)

**Best for:** getting live today with the least effort. No server to
maintain, patch, or secure yourself — the platform handles that.
Costs roughly $5–20/month depending on usage.

### A1. Push your code to GitHub

```bash
cd nyandarua-registry
git init
git add .
git commit -m "Initial commit"
```

Create a new empty repository on [github.com](https://github.com/new),
then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/nyandarua-registry.git
git branch -M main
git push -u origin main
```

### A2. Create the MySQL database

On [Railway](https://railway.app) or [Render](https://render.com):
1. Sign up / log in.
2. New Project → **Add MySQL** (Railway) or **New → MySQL** (Render).
3. Once it's provisioned, copy the connection details (host, port,
   user, password, database name) — you'll need them in step A4.

### A3. Deploy the backend

1. New Service → **Deploy from GitHub repo** → pick `nyandarua-registry`.
2. Set the **root directory** to `backend`.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add environment variables (from your `.env.example`, using the real
   MySQL credentials from step A2):
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `JWT_SECRET` — generate with
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `CORS_ORIGIN` — your future frontend URL, e.g. `https://registry.yourdomain.go.ke`
   - `PORT` — most platforms set this for you; otherwise use `4000`
6. Deploy. Once live, note the backend's public URL
   (e.g. `https://nyandarua-registry-backend.up.railway.app`).

### A4. Run the schema + seed once

Both platforms give you a way to run a one-off command against your
deployed service (Railway: `railway run`; Render: the Shell tab on the
service). From your local machine, you can also just connect directly
using the MySQL credentials from step A2:

```bash
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_USER> -p <DB_NAME> < backend/sql/01_schema.sql
mysql -h <DB_HOST> -P <DB_PORT> -u root -p < backend/sql/03_app_user.sql   # edit the password in this file first
```

Then run the seed once (from the platform's shell, or locally with
your `.env` pointed at the remote DB):

```bash
npm run seed
```

### A5. Deploy the frontend

1. New Static Site (Render) or New Service (Railway) → same GitHub repo.
2. Root directory: `frontend`
3. Build command: `npm install && npm run build`
4. Publish/output directory: `dist`
5. Before building, point the frontend at your live backend: open
   `frontend/vite.config.ts` and remove the local dev proxy, or simpler —
   set an environment variable the app reads at build time. The
   quickest fix: in `frontend/src/api/client.ts`, change the base URL
   from `/api` to your backend's full URL
   (`https://nyandarua-registry-backend.up.railway.app/api`), commit,
   and redeploy.
6. Once live, you'll get a URL like `https://nyandarua-registry.onrender.com`.

> **If your build fails on Render:** the most common cause is that
> Render sets `NODE_ENV=production` during the build step, and npm's
> default behavior in that mode is to skip `devDependencies` — but
> `typescript`/`vite`/`@vitejs/plugin-react` (frontend) and
> `typescript`/`ts-node-dev` (backend) are all devDependencies that the
> build scripts need to run. Both `backend/` and `frontend/` ship a
> `.npmrc` with `production=false`, which forces npm to install
> devDependencies regardless of `NODE_ENV`. If you still see
> `tsc: not found` or `vite: not found` in the build log, confirm that
> `.npmrc` file is actually present in whichever folder you set as
> that service's **root directory** on Render — if it's missing from
> the repo or the wrong folder, this is almost always why.

### A6. Point your domain at it

In your domain registrar's DNS settings, add a CNAME record pointing
your subdomain (e.g. `registry`) at the URL the platform gave you. Both
Railway and Render have a "Custom Domain" section in the service
settings where you add the domain and they issue a free HTTPS
certificate automatically.

### A7. Update CORS

Go back to the backend service's environment variables and set
`CORS_ORIGIN` to your final custom domain (e.g.
`https://registry.nyandarua.go.ke`), then redeploy the backend.

**Done.** Visit your domain, log in with a seeded file number and its
default password, and you'll be prompted to change it immediately.

---

## Option B — A VPS you manage (DigitalOcean, Linode, Hetzner, etc.)

**Best for:** more control over cost and configuration, comfortable
running basic Linux server admin. Costs roughly $6–12/month for a
small droplet/instance.

### B1. Create the server

Spin up an Ubuntu 22.04 droplet/instance (2 GB RAM is plenty to start).
Note its public IP address.

### B2. Point your domain at the server

In your DNS settings, create an **A record** for your subdomain (e.g.
`registry`) pointing to the server's IP address. This can take a few
minutes to an hour to propagate.

### B3. SSH in and install prerequisites

```bash
ssh root@YOUR_SERVER_IP

apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs mysql-server nginx certbot python3-certbot-nginx git
npm install -g pm2
```

### B4. Set up MySQL

```bash
mysql_secure_installation      # follow prompts to set a root password etc.
mysql -u root -p
```

Inside the MySQL prompt, paste the contents of `backend/sql/01_schema.sql`,
then edit and paste `backend/sql/03_app_user.sql` (set a real password
first). Exit with `exit`.

### B5. Get your code onto the server

```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/nyandarua-registry.git
cd nyandarua-registry
```

(If you're not using GitHub, `scp -r` the folder from your machine instead.)

### B6. Configure and build the backend

```bash
cd /var/www/nyandarua-registry/backend
cp .env.example .env
nano .env     # fill in DB_USER, DB_PASSWORD, JWT_SECRET, CORS_ORIGIN=https://registry.yourdomain.go.ke

npm install
npm run seed        # imports your personnel + files data, takes a few minutes
npm run build
```

Run it permanently with pm2:

```bash
pm2 start dist/index.js --name registry-api
pm2 save
pm2 startup          # follow the printed instructions so it survives reboots
```

### B7. Build the frontend

```bash
cd /var/www/nyandarua-registry/frontend
npm install
npm run build         # outputs to dist/
```

### B8. Configure Nginx

```bash
nano /etc/nginx/sites-available/registry
```

Paste:

```nginx
server {
    listen 80;
    server_name registry.yourdomain.go.ke;

    root /var/www/nyandarua-registry/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/registry /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### B9. Add HTTPS

```bash
certbot --nginx -d registry.yourdomain.go.ke
```

Certbot edits the Nginx config to redirect HTTP→HTTPS and auto-renews
the certificate. Your site is now live at
`https://registry.yourdomain.go.ke`.

### B10. Lock down MySQL

By default MySQL only listens on localhost, which is what you want —
confirm the backend and database are on the same server so you never
need to expose port 3306 publicly.

---

## Option C — The county's own server (self-hosted, on-premises)

**Best for:** keeping everything inside county infrastructure with no
external hosting cost. This is essentially the same as Option B, run
on hardware you already control, plus a couple of extra steps because
you don't control a public IP or DNS the same way a cloud provider does.

### C1. Confirm the server can be reached from outside (if needed)

- If this only needs to be accessible **within the county network**
  (LAN/VPN), you can skip public DNS/HTTPS entirely — just give staff
  the server's internal IP or set up an internal DNS entry
  (e.g. `registry.internal`), and follow steps B4–B8 above using that
  internal hostname instead of a public domain.
- If it needs to be reachable from **outside the county network**
  (e.g. staff working remotely), your IT team will need to either open
  a port through the firewall/router to forward to this server, or set
  up a VPN staff connect to first. Either decision should go through
  whoever manages the county's network/firewall — this is a security
  decision, not just a technical one.

### C2. Follow Option B, steps B3–B9

Everything from installing Node/MySQL/Nginx through building the app
and getting HTTPS is identical — just run it on the county's server
instead of a rented VPS. The only difference:
- If you're on an internal-only network without a public domain,
  Certbot's automatic HTTPS (step B9) won't work since it needs to
  verify domain ownership publicly. In that case, either:
  - Use a self-signed certificate for internal HTTPS (ask your IT team;
    browsers will show a warning unless the cert is installed as
    trusted on each staff computer), or
  - Run over plain HTTP if the network itself is already trusted/private
    (acceptable for a closed internal network, not for anything
    internet-facing).

### C3. Backups

Since this is county-owned hardware, set up a scheduled backup that IT
already trusts:

```bash
# Add to root's crontab (crontab -e) — daily backup at 2am
0 2 * * * mysqldump -u root -p'YOUR_ROOT_PASSWORD' nyandarua_registry > /var/backups/registry-$(date +\%F).sql
```

Make sure `/var/backups` is itself backed up somewhere off this
machine (network share, another server, etc.) — a backup that lives
only on the same disk as the database doesn't protect against
hardware failure.

### C4. Handoff to county IT

Give your IT team:
- The server's location/hostname and who has SSH/root access
- The `.env` file's location (never in git, never emailed — hand it
  over directly or via a password manager)
- This document, so they know how to redeploy after code changes
  (`git pull`, `npm run build`, `pm2 restart registry-api`)

---

## After any of the three: verify it's actually working

1. Visit your URL — you should see the login screen with the county logo.
2. Log in with a seeded file number and its default password (the
   staff member's ID number).
3. Confirm you're immediately prompted to change the password.
4. Check `https://yourdomain/api/../health` route isn't publicly
   guessable/exposed beyond what's needed — actually just hit
   `<backend-url>/health` and confirm it returns `{"status":"ok"}`.
5. As an admin, add a test file, request it as a regular user, accept
   it, and return it — then check the Movements page shows all three
   steps and that a fresh page load still shows them (confirming
   they're in MySQL, not just browser memory).
