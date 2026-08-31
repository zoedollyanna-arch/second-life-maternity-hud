# Nestoria — Pregnancy & Family HUD for Second Life

A full-stack pregnancy HUD system: an in-world HUD displays this web dashboard
on its screen via shared media (MOAP), and every button on the dashboard acts
back in-world through a Postgres-backed API and LSL scripts.

## How it works

```
 Second Life                          Server (this app)              Supabase
┌──────────────┐  register/poll   ┌──────────────────────┐        ┌──────────┐
│ Main HUD     │ ───────────────► │ /api/sl/register     │ ◄────► │ Postgres │
│ (MOAP screen)│ ◄─── push ────── │ /api/sl/poll         │        └──────────┘
│ Belly        │                  │ /api/sl/event        │
│ Partner HUD  │                  │ /api/sl/action       │
└──────────────┘                  │ /api/sl/partner-link │
       ▲                          │                      │
       │ browser (MOAP)           │ /api/hud/state       │
       └────────────────────────► │ /api/hud/action      │
                                  └──────────────────────┘
```

1. The wearer attaches the **Main HUD**. Its script registers with the server
   (authenticated by a shared secret + Second Life's `X-SecondLife-*` headers),
   receives a session token, and loads `https://your-server/?token=…` on its
   screen face.
2. Every button on the dashboard calls `/api/hud/action`. The server updates
   the database **and queues an in-world command** (sound, particles,
   animation, chat, IM) which is pushed to the HUD's `llRequestURL()` endpoint
   — or picked up on its 30-second poll as a fallback.
3. The **Belly** grows with the pregnancy week, plays random kicks from week
   16, and reports kicks/touches back to the server.
4. The **Partner HUD** pairs using the code shown in the Partner panel and
   gives the partner support actions that raise the support meter and reach
   the mom in-world.

Meters (hunger, hydration, energy, bladder, …) decay in real time on the
server; pregnancy progression is time-based and configurable (Settings →
pregnancy length in real days).

## Setup

### 1. Environment

Copy `.env.example` to `.env` and set:

| Variable        | Meaning                                                      |
| --------------- | ------------------------------------------------------------ |
| `DATABASE_URL`  | Supabase **Transaction pooler** URI (port 6543). Username must be `postgres.<project-ref>`. |
| `SL_API_SECRET` | Shared secret; must match `API_SECRET` in each `.lsl` script |
| `APP_URL`       | Public URL of this deployment (used to build the MOAP URL)   |
| `DISABLE_DEMO`  | Optional. Set `1` to disable the "Preview a demo" button     |

### 2. Database

```bash
npm install
npm run migrate     # applies db/migrations/*.sql, tracked in schema_migrations
```

### 3. Run

```bash
npm run dev         # development
npm run build       # production build (nitro node-server preset)
npm start           # serves .output/server/index.mjs with .env loaded
```

Deploy anywhere that runs Node (VPS, Railway, Render, Fly.io…). The server
must be reachable **over HTTPS from Second Life** for production use — put it
behind a domain with TLS and set `APP_URL` accordingly.

### 4. Render hosting

This project is meant to be hosted as the MOAP web service for a worn HUD
attachment. It is not a standalone Second Life object; the LSL HUD loads the
Render URL onto its media face with `llSetPrimMediaParams`.

Use the included [`render.yaml`](render.yaml) as a Render Blueprint, or create a
Web Service manually with:

| Render setting    | Value                          |
| ----------------- | ------------------------------ |
| Runtime           | Node                           |
| Node version      | `22`                           |
| Build command     | `npm install --include=dev && npm run build` |
| Start command     | `npm start`                    |
| Health check path | `/`                            |

Set these in the Render dashboard (Environment):

| Variable        | Value |
| --------------- | ----- |
| `NODE_VERSION`  | `22` (not 24/26 — `>=22` would pick latest and break) |
| `DATABASE_URL`  | Supabase → **Connect** → **Transaction pooler** URI (port **6543**). Copy it from the dashboard; `aws-0` vs `aws-1` and the region must match. Unpause the project if it is paused. |
| `SL_API_SECRET` | Same string as `API_SECRET` in the LSL scripts |
| `APP_URL`       | `https://your-service.onrender.com` |
| `DISABLE_DEMO`  | `1` |

`npm start` already runs migrations. If start dies with `tenant/user … not found`, the pooler URI is wrong or the Supabase project is paused — it is not an app build error.

### 5. Second Life

The LSL scripts are in [`lsl/`](lsl/), and the prims/assets you need are
listed in [`lsl/OBJECTS.md`](lsl/OBJECTS.md). In each script, set:

```
string API_BASE   = "https://your-deployment-url";
string API_SECRET = "<same value as SL_API_SECRET in .env>";
```

Notes:

- **Sounds need no uploads** — the dashboard synthesizes chimes, water,
  heartbeat, kicks etc. with Web Audio and plays them through the MOAP media
  screen, so they're heard in-world. In-world sound clips are optional polish.
- The **belly sensor** is an invisible prim worn on the stomach — it works
  inside any mesh belly add-on (Reborn, BORK, …) and never changes shape.
- The **Comfort action rezzes a chair** (`nestoria_chair`, containing
  `nestoria_comfort_chair.lsl`, stored inside the Main HUD). Sitting on it for
  2 minutes grants the comfort boost, then it cleans itself up.

Wearers must have media enabled (Preferences → Sound & Media → Media) to see
the dashboard on the HUD and hear its sounds.

## API summary

| Endpoint                    | Caller              | Purpose                                                |
| --------------------------- | ------------------- | ------------------------------------------------------ |
| `POST /api/sl/register`     | HUD / belly scripts | Register device, get session token + MOAP URL          |
| `GET /api/sl/poll`          | scripts             | Fetch queued in-world commands + current week          |
| `POST /api/sl/event`        | belly               | Kicks, belly touches                                   |
| `POST /api/sl/action`       | partner HUD         | Support actions from in-world menus                    |
| `POST /api/sl/partner-link` | partner HUD         | Redeem pairing code                                    |
| `GET /api/hud/state`        | dashboard           | Full dashboard state (token auth)                      |
| `POST /api/hud/action`      | dashboard           | All web buttons (token auth)                           |
| `POST /api/hud/demo`        | browser             | Throwaway demo session (disable with `DISABLE_DEMO=1`) |

## Production behavior

- First-attach setup wizard stores mom name, week/day, baby count, gender,
  baby names, privacy, and popup frequency.
- The MOAP action console exposes Home, Pregnancy, Health, Baby, Care, Partner,
  Journal, Nutrition, craving, and random RP event actions with short buttons.
- Cravings, wellness logs, random event history, and expanded baby wellness
  meters persist in Postgres.
- Food items are integrated into nutrition and cravings: ham sub, spaghetti,
  chicken bacon burger, lasagna, jam toast, cheeseburger, and french toast.
  Each food has its own hunger, mood, nutrition, sickness, hydration, baby
  wellness, and craving-relief behavior in the server stat engine.
- Baby wellness trends gently from hydration, rest, nutrition, vitamins,
  appointments, mood, stress, and ignored symptoms instead of punishing one
  single RP choice.

## Security notes

- The database is only ever touched by this server; Supabase RLS is enabled on
  every table with no policies, so the anon/authenticated PostgREST roles have
  no access.
- LSL registration requires the shared secret **and** Second Life's
  `X-SecondLife-Owner-Key/Name` headers; web requests require a session token
  issued at registration (90-day expiry).
- Keep `.env` out of git (already ignored) and rotate `SL_API_SECRET` if a
  script leaks — scripts and server must be updated together.
