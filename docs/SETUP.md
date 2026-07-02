# Connecting Ledgerline to a database (making it save)

By default the app runs in **demo mode** — everything works, but nothing saves
between reloads. To make your imports, groupings, and journal entries **stick**,
connect it to a free Supabase project. This is a one-time setup.

You do this on a computer where you can run the app (see `app/README.md`).

---

## 1. Create a free Supabase project

1. Go to **https://supabase.com** and sign up (free tier is plenty to start).
2. Click **New project**. Give it a name (e.g. `ledgerline`), set a database
   password (save it somewhere), pick a region near you, and create it.
3. Wait ~2 minutes for it to finish provisioning.

## 2. Create the database tables

1. In your Supabase project, open the **SQL Editor** (left sidebar).
2. Open each file in this repo's `supabase/migrations/` folder **in order** and
   run them one at a time (copy the file's contents, paste into a new SQL query,
   click **Run**):
   - `20260702000001_foundation.sql`
   - `20260702000002_rls.sql`
   - `20260702000003_bootstrap.sql`
3. Each should report success. This creates all the tables and the security
   rules that keep each firm's data private.

## 3. Get your project keys

1. In Supabase, go to **Project Settings → API**.
2. Copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string — the *public* one, **not** the
     `service_role` secret)

## 4. Point the app at your project

1. In the `app/` folder, make a copy of `.env.example` named **`.env.local`**.
2. Fill it in:
   ```
   VITE_SUPABASE_URL=https://abcd1234.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
3. Save the file.

## 5. Run it

```bash
npm install
npm run dev
```

Open the address it prints. Instead of demo mode, you'll now see a **Sign in**
screen.

## 6. First-time use

1. Click **Create one**, sign up with your email and a password.
   - By default Supabase emails a confirmation link. To skip that while testing,
     go to **Supabase → Authentication → Providers → Email** and turn **off**
     "Confirm email", then sign up again.
2. After signing in the first time, you'll be asked to **name your firm** — this
   creates your workspace and seeds the standard leadsheet groups.
3. Create an **engagement** (client name + fiscal year), open it, and you're in
   the same workspace as demo mode — but now with a **Save** button in the top
   bar. Import your GL, fix up the Chart of Accounts, book entries, and click
   **Save**. Reload the page and it's all still there.

---

## Notes

- **Only the anon/public key** goes in `.env.local`. Never put the
  `service_role` secret in the app — it bypasses security.
- Row-Level Security means each firm only ever sees its own data, enforced by
  the database itself.
- Inviting teammates and finer-grained roles are a later phase; for now the
  first user becomes the firm admin.
