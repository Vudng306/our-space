# Deploying Our Space

The app is a single Next.js service that needs two things: a PostgreSQL
database and a private bucket for photos. Nothing else. Which providers you use
is decided entirely by environment variables, so you are not locked into any of
them.

The path below is the cheapest one that works well, and every piece has a free
tier that comfortably fits two people.

| Piece | Suggested | Why |
| --- | --- | --- |
| Hosting | **Vercel** | Zero-config for Next.js; free Hobby plan |
| Database | **Neon** | Free Postgres, no card required |
| Photos | **Cloudflare R2** | 10 GB free, and no charge for downloads |

Storage is only carrying profile photos while the daily-moments screens are
switched off, so it will stay nearly empty — but Vercel has a read-only
filesystem, so a bucket is still required for avatars to work at all.

If you would rather keep it to one account, **Supabase** gives you Postgres and
storage together — see [Other providers](#other-providers).

---

## 1. Database

1. Create a project at <https://neon.tech> and pick a region near you
   (Singapore for Vietnam).
2. Copy the **pooled** connection string. It looks like:

   ```
   postgresql://user:password@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

Use the pooled URL, not the direct one — serverless functions open and close
connections constantly, and the pooler is what keeps that from exhausting the
database.

## 2. Photo storage

1. In the Cloudflare dashboard, open **R2** and create a bucket, e.g.
   `our-space-media`.
2. Leave public access **off**. The app serves photos itself; the bucket should
   never be readable from the internet.
3. Create an **R2 API token** with *Object Read & Write* on that bucket, and
   note the access key id, the secret, and your account id.

Your endpoint is `https://<account-id>.r2.cloudflarestorage.com`.

## 3. Deploy

```bash
npm i -g vercel
vercel            # link the project
vercel --prod
```

Or push the repository to GitHub and import it at <https://vercel.com/new>.
Vercel detects Next.js on its own; the build command in `package.json` already
runs `prisma generate && prisma migrate deploy`, so your schema is applied on
every deploy.

### Environment variables

Set these in **Vercel → Settings → Environment Variables** (Production, and
Preview if you use it):

```bash
DATABASE_URL="postgresql://…-pooler…?sslmode=require"

# openssl rand -base64 48
AUTH_SECRET="<48 random bytes, base64>"

NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"

STORAGE_DRIVER="s3"
S3_BUCKET="our-space-media"
S3_REGION="auto"
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_ACCESS_KEY_ID="…"
S3_SECRET_ACCESS_KEY="…"
S3_FORCE_PATH_STYLE="true"

MAX_UPLOAD_MB="12"
MAX_PHOTOS_PER_MOMENT="10"
```

`NEXT_PUBLIC_APP_URL` has to match the address you actually visit — it is what
invite links are built from, and what the CSRF check compares against. If you
attach a custom domain later, update it and redeploy.

> `STORAGE_DRIVER=local` cannot work on Vercel: the filesystem is read-only and
> nothing written during one request survives to the next. Use `s3` there.

## 4. First run

1. Open your deployed URL and **create your account** — the first person to
   sign up creates the space.
2. Name the space, set the day it started, and copy the invite link.
3. Send that link to your partner. It works once, and expires in seven days.
4. Once they have joined, set `DISABLE_REGISTRATION=1` and redeploy. Nobody
   else can then create an account on your instance, which is worth doing since
   the URL is guessable.

## 5. Worth doing afterwards

**Back up.** Neon keeps point-in-time restore on the free plan, but a copy you
hold yourself is better:

```bash
pg_dump "$DATABASE_URL" > ourspace-$(date +%F).sql
```

The Settings page also exports everything — data and photos — as a ZIP with
plain JSON inside. Do that once now, so you know the restore path exists before
you need it (spec §12.2).

**Error tracking.** `npm install @sentry/nextjs && npx @sentry/wizard@latest -i nextjs`.
Captions are never logged, and should stay that way — keep `sendDefaultPii`
off.

**Email.** Password resets are written to the server log unless `SMTP_URL` is
set. For two people that is often enough, but any SMTP URL works:

```bash
SMTP_URL="smtp://user:pass@smtp.resend.com:587"
SMTP_FROM="Our Space <no-reply@yourdomain.com>"
```

---

## Netlify

Netlify's free Starter plan does not ask for a card, and it has its own Next.js
runtime, so the app needs no code changes — [`netlify.toml`](netlify.toml)
carries the whole configuration.

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an
   existing project** → GitHub → pick the repository.
2. Leave the build command and publish directory alone; `netlify.toml` sets
   them, and Netlify detects Next.js on its own.
3. Before the first deploy, open **Site configuration → Environment variables**
   and add:

   ```bash
   DATABASE_URL="postgresql://…-pooler…?sslmode=require"
   AUTH_SECRET="<48 random bytes, base64>"
   ```

4. Deploy, then copy the site address and add it as `NEXT_PUBLIC_APP_URL`, and
   redeploy. Invite links are built from that value, so until it is set they
   will point at `localhost`.

The build runs `prisma migrate deploy`, so `DATABASE_URL` has to be present
before the first build or it stops there — deliberately, rather than starting
an app with no tables.

Profile photos still need an S3-compatible bucket, exactly as above; without
one everything works except uploading an avatar.

## Other providers

### Supabase (one account for both database and storage)

```bash
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
STORAGE_DRIVER="s3"
S3_BUCKET="media"
S3_REGION="ap-southeast-1"
S3_ENDPOINT="https://<project-ref>.supabase.co/storage/v1/s3"
S3_ACCESS_KEY_ID="…"       # Storage → S3 access keys
S3_SECRET_ACCESS_KEY="…"
```

Create the bucket as **private**.

### A VPS with Docker

The one setup where `STORAGE_DRIVER=local` makes sense, because the disk
persists. Mount a volume at `/app/storage`, put Caddy or nginx in front for
TLS, and back up both the database and that directory.

```bash
DATABASE_URL="postgresql://ourspace:…@db:5432/ourspace"
STORAGE_DRIVER="local"
STORAGE_LOCAL_DIR="/app/storage"
NEXT_PUBLIC_APP_URL="https://ourspace.yourdomain.com"
```

### Moving between them

Photos are addressed by an object key stored in the database, so switching
buckets is: copy the objects across (`rclone sync` handles R2, S3 and Supabase),
change the `S3_*` variables, redeploy. No data migration.

---

## Before you call it done

The spec's pre-release checklist (§14), worth walking once:

- [ ] Both of you sign in on your own phones and fill in your sheet.
- [ ] Confirm neither of you can see the other sheet until both are handed in.
- [ ] One of you tries to open the other's moment URL while signed out — you
      should land on the sign-in page.
- [ ] Set a profile photo from an iPhone and from an Android browser.
- [ ] Export, unzip, and open `data.json`.
- [ ] Confirm `AUTH_SECRET` and the S3 keys are only in the host's environment
      settings, never in the repository.

`npm run check` covers the authorisation, invite and flow cases automatically —
point it at the deployed URL with `CHECK_BASE_URL`:

```bash
CHECK_BASE_URL="https://your-app.vercel.app" npm run check
```

It creates and deletes throwaway accounts, so run it before you set
`DISABLE_REGISTRATION=1`.
