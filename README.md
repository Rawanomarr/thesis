# LLM Benchmarking Platform

Bachelor thesis — German International University (September 2026).

Web platform for live human–LLM benchmarking: each participant evaluates **all three** anonymous models (X / Y / Z), with domain/topic choice, per-topic pre/post surveys, turn-limited chat, token accounting, and an admin dashboard.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React SPA (Vercel / Netlify) |
| Backend | Node.js / Express on **Render** (free web service) |
| Database | **MongoDB Atlas** (M0 free cluster) |

## Project structure

```
thesis/
├── render.yaml           # Render Blueprint (backend service)
├── backend/
│   └── src/
│       ├── config/
│       ├── models/       # experiments, sessions, conversations, surveys, admins
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       └── server.js
└── frontend/             # React app (to be added)
```

## Database collections

- `experiments` — domains → topics (each with pre/post surveys), demographics schema, 3 models + X/Y/Z labels, `targetParticipantCount` (default 500), `metricsConfig`, invite token
- `participants` — one human: consent, demographics (once), domain/topic choice, shuffled X/Y/Z → real-model mapping
- `sessions` — one model evaluation (pre → chat → post); stores auto-computed `metrics.psi` on completion
- `conversations` — transcript + token usage for a session
- `surveys` — `demographics` (once) or `pre`/`post` (per session); all answers required
- `admins` — bcrypt credentials scoped by `experimentIds`

## Participant flow

1. Consent + **email** (unique per experiment — completed emails cannot start again; incomplete runs can resume)
2. Demographics survey (**once**) → saved as `surveys` type `demographics`
3. Choose **domain** and **topic** (locked for the rest of the study)
4. Choose an available anonymous model (**X / Y / Z**; already-completed labels disabled)
5. Pre-survey for that topic → conversation (turn limit) → post-survey
6. Back to model selection until all 3 labels are done → thank-you / complete

Admin clients may see real model names; participant clients only ever see X / Y / Z.

### Public study discovery

This is a **public** experiment. Anyone can find and join it — not only people who receive a private invite.

| URL | Purpose |
|---|---|
| `{STUDY_APP_URL}/studies` | Public catalog of open studies |
| `{STUDY_APP_URL}/study/{slug}` | Join a specific study (human-readable, shareable) |

API:

- `GET /api/studies` — list all `active` + `isPublic` experiments  
- `GET /api/study/:slugOrToken` — study info (slug or legacy invite token)  
- `POST /api/study/:slugOrToken/consent` — start with `{ email, consent: true }`

Example local links:

```text
http://localhost:5173/studies
http://localhost:5173/study/thesis-pilot-study
```

Set `isPublic: false` (or `active: false`) on an experiment to hide it from the catalog and block new joins. Admin APIs remain private.

### Participant API

Send header `X-Participant-Token` after consent.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/studies` | Public catalog of open experiments |
| GET | `/api/study/:slugOrToken` | Public study info |
| POST | `/api/study/:slugOrToken/consent` | Consent + email → create participant (blocks repeat email) |
| GET | `/api/participant/me` | Current status |
| POST | `/api/participant/demographics` | Demographics (once, all answers required) |
| POST | `/api/participant/domain-topic` | Lock domain + topic |
| GET | `/api/participant/models` | Available anonymous labels |
| POST | `/api/participant/models/select` | Start a model run `{ "label": "X" }` |
| GET | `/api/participant/sessions/:sessionToken` | Session + transcript + pending survey |
| POST | `/api/participant/sessions/:sessionToken/surveys/pre` | Pre-survey |
| POST | `/api/participant/sessions/:sessionToken/chat` | Send chat turn |
| POST | `/api/participant/sessions/:sessionToken/surveys/post` | Post-survey → back to model select |

### Seed data

```bash
SEED_ADMIN_PASSWORD=your-secure-password npm run seed:admin
npm run seed:experiment
```

## Local backend setup

1. Create a MongoDB Atlas M0 cluster (or use local MongoDB).
2. From `backend`:

```bash
cd backend
npm install
cp .env.example .env
```

3. Set `MONGO_URI` (Atlas connection string) and leave LLM keys empty until adapters are built.
4. Start:

```bash
npm run dev
```

Health check: `http://localhost:5000/health`  
**Swagger UI:** `http://localhost:5000/api-docs` (OpenAPI JSON: `/api-docs.json`)

### Test with Swagger

1. Start MongoDB / Atlas, then:
   ```bash
   cd backend
   npm run seed:admin
   npm run seed:experiment
   npm run dev
   ```
2. Open `http://localhost:5000/api-docs`
3. **Participant flow:** `GET /api/studies` → `POST .../consent` → Authorize **ParticipantToken** → continue the tagged Participant endpoints
4. **Admin flow:** `POST /api/auth/login` → Authorize **AdminJWT** → try Dashboard / Analytics / Metrics

### Create the first admin

Either:

```bash
# Option A — seed script (needs MongoDB running)
SEED_ADMIN_PASSWORD=your-secure-password npm run seed:admin
```

or:

```bash
# Option B — one-time bootstrap (only works when zero admins exist)
POST /api/auth/bootstrap
{ "username": "admin", "password": "your-secure-password" }
```

### Auth endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/bootstrap` | none (first admin only) | Create first admin |
| POST | `/api/auth/login` | none | Get JWT |
| GET | `/api/auth/me` | Bearer JWT | Current admin |
| GET | `/api/admin/*` | **Admin JWT only** — participants/users always get 401/403 |
| GET | `/api/admin/experiments/:experimentId/analytics` | Bearer JWT | Full analytics: progress, funnel, demographics, PSI, usage |
| GET | `/api/admin/experiments/:experimentId/metrics` | Bearer JWT | Same as analytics (automated PSI) |
| GET | `/api/admin/experiments/:experimentId/sessions` | Bearer JWT | Session list (includes stored `metrics.psi`) |
| GET | `/api/admin/question-types` | Bearer JWT | Supported question types |
| POST | `/api/admin/experiments` | Bearer JWT | Create experiment + surveys |
| GET | `/api/admin/experiments/:id/surveys` | Bearer JWT | View demographics + topic pre/post |
| PUT | `/api/admin/experiments/:id/surveys/demographics` | Bearer JWT | Replace demographics survey |
| PUT | `/api/admin/experiments/:id/domains/:domainId/topics/:topicId/surveys` | Bearer JWT | Replace pre or post survey |
| POST | `/api/admin/experiments/:id/surveys/:target/questions` | Bearer JWT | Add one question |
| POST | `/api/admin/metrics/*` | Bearer JWT | Manual equation compute (jsd, cfr, ece, …) |

### LLM proxy

Server-side only: `generateReply(provider, messages, config)` in `src/services/llm/`  
Providers: `claude`, `gpt`, `gemini` — usage normalized to `inputTokens` / `outputTokens`.

## Deploy backend on Render

1. Push the repo to GitHub.
2. In Render: **New** → **Blueprint** and select the repo (uses root `render.yaml`),  
   **or** **New Web Service** with:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
3. Set environment variables in the Render dashboard:

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Atlas connection string |
| `FRONTEND_URL` | Deployed frontend origin(s), comma-separated |
| `JWT_SECRET` | Strong random secret |
| `ANTHROPIC_API_KEY` | Claude |
| `OPENAI_API_KEY` | GPT |
| `GOOGLE_API_KEY` | Gemini |

Render injects `PORT` automatically. Free tier spins down after idle — cold starts are expected; ping `/health` before opening the chat screen so the first turn is not delayed.

## Deploy notes

- Frontend → Vercel or Netlify (static React build)
- Database → MongoDB Atlas M0
- Never commit `.env`; secrets live only in host dashboards
