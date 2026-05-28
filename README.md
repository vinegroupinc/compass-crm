# Compass — Internal Job Board

A lean internal CRM / project board for renovation & maintenance work on
apartments and income properties. React + Vite frontend (Netlify) with
Supabase for auth and database. Internal use only — no client login.

Everything is anchored to **America/Los_Angeles** time.

---

## What's in the box

- **Dashboard** — your assigned open tasks float to the top (high-priority ones
  first), then *Needs Attention*, then *High Priority*, then the rest grouped by
  status. Billed and Closed jobs are hidden here (they live in Properties).
- **Jobs** — address, optional unit, management company, unit manager, job type,
  scheduled dates, main tech, subcontractors, crew-access notes, status, flags,
  tasks, and an append-only notes log.
- **Tasks** — work-coordination items assigned to a user; open ones surface on
  that user's dashboard.
- **Notes** — permanent, timestamped, attributed; never overwritten. Only the
  original author can edit their own note (enforced in the database).
- **Saved Lists** — manage the Management Companies and Techs dropdowns in-app.
- **Properties** — every job at a street address over time (unit ignored for
  matching).
- **Calendar** — 30-day grid + desktop Gantt; on mobile the Gantt becomes a
  vertical scheduled-jobs list.
- **7-day follow-up** — when you open the app, if any active job hasn't had a
  *status change* in 7+ days, you're prompted to update it.

---

## Part 1 — Supabase setup (you're new to this; follow in order)

### 1. Create the project
1. Go to https://supabase.com and sign up / log in.
2. Click **New project**. Pick a name (e.g. `compass`), set a strong database
   password (save it somewhere), choose the region closest to LA
   (e.g. *West US*). Create it and wait ~2 minutes for it to spin up.

### 2. Create the tables (one copy-paste)
1. In the left sidebar open **SQL Editor**.
2. Click **New query**.
3. Open the file `supabase_schema.sql` from this project, copy the **entire**
   contents, paste into the editor, and click **Run**.
4. You should see "Success". This creates all tables, the append-only notes
   rules, and the future-proof roles structure. It's safe to re-run.

### 3. Create your users (3 at launch, up to 6)
Logins are managed entirely in Supabase — nothing is hardcoded.
1. Sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter each person's email and a temporary password. Repeat for all 3 users.
3. (Optional but nice) To give someone a display name, click the user →
   **User Metadata** → add `full_name` = `Their Name`. Otherwise the part of
   their email before the @ is used. A matching profile row is created
   automatically the first time the trigger runs.

> To add/remove/change a login later, you just do it here — no code changes.

### 4. Turn off public sign-ups (internal only)
1. **Authentication** → **Providers** (or **Sign In / Up** settings).
2. Make sure **Email** is enabled (so your users can log in).
3. Disable **Allow new users to sign up** so nobody can self-register.
   You'll keep adding users manually under Authentication → Users.

### 5. Grab your keys
1. Sidebar → **Project Settings** (gear) → **API**.
2. Copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string under "Project API keys")
3. The `anon` key is safe to ship in a frontend — row-level security is what
   protects your data. Never put the **service_role** key in this app.

---

## Part 2 — Netlify deploy

You've launched on Netlify before, so this is familiar.

### 1. Push this folder to a Git repo (GitHub/GitLab/Bitbucket).

### 2. Create the site
- Netlify → **Add new site** → **Import an existing project** → pick your repo.
- Build settings (usually auto-detected from `netlify.toml`):
  - **Build command:** `npm run build`
  - **Publish directory:** `dist`

### 3. Add environment variables (this is how the keys stay out of the code)
- Site → **Site configuration** → **Environment variables** → **Add a variable**.
- Add these two (names must match exactly):

  | Key | Value |
  |-----|-------|
  | `VITE_SUPABASE_URL` | your Project URL from step 5 |
  | `VITE_SUPABASE_ANON_KEY` | your anon public key from step 5 |

- Trigger a deploy (Deploys → **Trigger deploy** → **Deploy site**), since env
  vars are baked in at build time.

### 4. Done
Open the site, log in with one of the users you created. Add your management
companies and techs under **Lists**, then create your first job.

---

## Local development (optional)

```bash
npm install
cp .env.example .env      # then fill in your two Supabase values
npm run dev
```

---

## Adding per-user roles later (no rebuild needed)

The `profiles` table already has a `role` column (everyone is `admin` now).
When you want, say, view-only users:

1. Set their `role` in the `profiles` table (e.g. `viewer`).
2. Edit the relevant policies in `supabase_schema.sql` — for example, change the
   `jobs_all` policy so writes require
   `exists (select 1 from profiles where id = auth.uid() and role = 'admin')`.
3. Re-run that policy block in the SQL editor.

No table changes, no app redeploy required for the data rules. The auth layer is
also isolated in `src/lib/authProvider.js`, so the login provider itself can be
swapped without touching the rest of the app.

---

## Swapping the logo

The header/login show the logo inside a dark "chip" because the supplied mark is
white and the site background is light. To change it, replace
`public/logo.png`. If you later have a dark-colored version, you can remove the
`.logo-chip` background in `src/index.css`.

## Deliberately NOT included

Photo storage (Google Drive), cost/budget/invoicing (QuickBooks), time tracking,
crew hours, messaging/chat, client/owner access, push notifications.
