# Our Space

> Một không gian riêng để hai người lưu những điều nhỏ bé mỗi ngày.

A private web app for exactly two people. It starts small — each of you fills
in one introduction sheet, and finishing yours is what unlocks theirs — with
the rest of the spec built and waiting behind a switch.

No feed, no followers, no public profile.

Built to the *Our Space — Product Requirements & Development Specification*
(v1.0, MVP).

---

## Quick start

You need **Node 20+** and **Docker** (for the local Postgres).

```bash
npm install
docker compose up -d
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open <http://localhost:3000> and sign in with the seeded accounts:

| Account | Password |
| --- | --- |
| `mai@example.com` | `ourspace-dev-2026` |
| `linh@example.com` | `ourspace-dev-2026` |

`npm install` writes a `.env` for you from `.env.example` if you copy it; the
repo already ships a working `.env` for local development with a generated
`AUTH_SECRET`. To start empty instead of seeded, skip `npm run db:seed` and
register your own account — the first person to sign up creates the space and
invites the other.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Generate the Prisma client, run migrations, build |
| `npm start` | Serve the production build |
| `npm run db:up` / `db:down` | Start / stop the local Postgres container |
| `npm run db:migrate` | Create and apply a migration after a schema change |
| `npm run db:studio` | Prisma Studio, to poke at the data |
| `npm run db:seed` | Two accounts with filled-in sheets (plus data for the switched-off screens) |
| `npm run check` | Authorisation, invite and end-to-end flow checks (including the sheet gate) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |

`npm run check` needs the dev server running; it drives the real HTTP API.

## What is in here

The app does one thing: it holds the introduction sheet each of you fills in.

**The sheet.** A single page modelled on the printed "Giới thiệu bản thân tớ"
worksheet — where you live, your nickname, birthday (the zodiac sign is worked
out for you), seven favourites, how you feel right now, your personality, your
special hobby, your idol, your favourite hour of the day, your dream, and a
0–100 mark you give yourself.

**The exchange.** You cannot read your partner's sheet until you have handed in
your own. That gate lives on the server, not in the interface: until both
sheets are in, the API simply does not return the other one. A nearly-empty
sheet is refused, so "xong rồi" costs something.

**Settings.** Space name and start date, the invite link, your account,
password, export, and the ways out.

The interface is in Vietnamese and dates read as dd/MM/yyyy.

### Everything else is built, and switched off

The full spec is implemented — daily moments with photos, the timeline, the
calendar, memories, important dates, the bucket list, search, and the older
free-form preferences list — but hidden behind flags in
[`src/lib/features.ts`](src/lib/features.ts), because a page you never use is
just noise.

```ts
export const features = {
  sheets: true,
  preferences: false, // the sheet covers the same ground with fixed slots
  moments: false,     // flip to true when you want the daily loop
  timeline: false,
  ...
};
```

Flip one to `true` and its screen, its navigation entry and its route come
back. The database and the API are untouched by these flags, so nothing you
have saved is affected by turning something off again.

Two things to know if you do: those screens are still written in English, and
`moments` is the one the others build on — `timeline` and `calendar` have
nothing to show without it.

### Architecture

```
Browser ──HTTPS──► Next.js (App Router)
                    ├── pages + REST API under /api/v1
                    ├── session cookie auth
                    └── space-membership authorisation
                            │
                            ├──► PostgreSQL (Prisma)
                            └──► private object storage (local disk or S3)
```

- `src/lib/` — the primitives: env, db, session, storage, media, validation.
- `src/server/` — one module per domain. Every read and write takes a
  `SpaceContext` and derives its `spaceId` from it, never from the URL. Route
  handlers and server components share these, so there is one copy of the rules.
- `src/app/api/v1/` — thin route handlers: authorise, validate, call a service.
- `src/components/` — the UI, plus `useAsyncData` for the fetch-and-render loop.

### The security model

The couple space is the boundary, and it is enforced in one place:
`requireSpace()` resolves the caller's membership, and every query filters on
the `spaceId` it returns. Guessing an id gets you a 404, not somebody else's
photograph.

- Sessions are rows in the database referenced by a signed cookie, so a logout
  or password change revokes access immediately.
- Invite tokens are stored only as a SHA-256 hash, expire in seven days, and
  work once.
- Photos are never publicly readable. They are re-encoded on upload (which
  drops EXIF and GPS), stored privately, and served either through an
  authenticated proxy or a 5-minute signed URL.
- Mutating requests check the `Origin` header, on top of `SameSite=Lax`.
- Deleting a moment is reversible for 30 days. Deleting a space asks you to
  retype its name and writes an audit event.
- When someone closes their account while their partner is still in the space,
  their login is closed and their details scrubbed, but the moments they wrote
  stay — they are their partner's memories too.

- Your partner's sheet is withheld by the query itself until both of you have
  handed yours in — the interface never receives it, so there is nothing to
  peek at in the network tab.

`npm run check` asserts all of this against a running server.

## Deploying

See [DEPLOY.md](DEPLOY.md). The short version: Netlify or Vercel + a managed
Postgres (Neon) + optionally an S3-compatible bucket, all on free tiers,
configured entirely through environment variables. Nothing in the code is tied
to a host.

## Notes on the spec

Two places where the implementation deliberately differs:

- **Uploads are direct, not presigned.** §7 sketches `POST /media/presign`.
  Taking the bytes server-side is what makes it possible to verify the file
  really is an image and re-encode it before anything reaches the bucket —
  a check a presigned PUT cannot do. Downloads still use signed URLs.
- **Media is one generic table**, not `moment_media` alone, because avatars and
  memory covers need the same upload, authorisation and cleanup path. The join
  table `moment_media` from §6.2 still exists, pointing at it.

Out of MVP scope by design (§2.2): realtime chat, public sharing, AI, face
recognition, cloud photo import, native apps.
