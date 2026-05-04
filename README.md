# Flyxa AI — Professional Futures Trading Journal

A professional-grade futures trading journal built for serious traders. Features AI-powered trade analysis, chart screenshot scanning, risk management, psychology tracking, and deep analytics.

---

## Features

- **Dashboard** — Net P&L, win rate, profit factor, equity curve, session breakdown, monthly heatmap
- **Trade Scanner** — Upload chart screenshots; Claude extracts trade data automatically via vision AI
- **AI Coach** — Individual trade analysis, pattern recognition, weekly reports, psychology reports
- **Risk Manager** — Daily loss limits, position size calculator, real-time daily monitoring
- **Analytics** — Performance by instrument, session, time of day, emotional state, drawdown analysis
- **Psychology Tracker** — Daily mood logs, mindset score, tilt detection, emotional pattern charts
- **Playbook** — Document your setups; AI verifies whether trades followed your rules
- **Journal** — Daily trading journal with auto-save and full-text search

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT) |
| AI | Anthropic Claude API (`claude-sonnet-4-20250514`) |

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier is fine)
- An [Anthropic](https://platform.claude.com) API key

---

## Setup

### 1. Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration file:
   ```
   supabase/migrations/001_initial.sql
   ```
3. From your Supabase project settings, collect:
   - **Project URL** (Settings → API → Project URL)
   - **Anon key** (Settings → API → `anon` `public`)
   - **Service role key** (Settings → API → `service_role` — keep secret)
   - **JWT Secret** (Settings → API → JWT Settings → JWT Secret)

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env`:

```env
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
ANTHROPIC_API_KEY=sk-ant-...
FRONTEND_URL=http://localhost:5173
```

Start the backend:

```bash
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:3001
```

Start the frontend:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | Port for the Express server (default: 3001) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — bypasses RLS for server operations |
| `SUPABASE_JWT_SECRET` | Used to verify user JWTs sent from the frontend |
| `ANTHROPIC_API_KEY` | Your Anthropic API key — **never expose to frontend** |
| `FRONTEND_URL` | CORS allowed origin |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Anon key for client-side auth only |
| `VITE_API_URL` | URL of your backend server |

---

## Deployment

### Frontend → Vercel

1. Push the `frontend/` folder to a GitHub repo (or the full monorepo)
2. Import project in [Vercel](https://vercel.com)
3. Set root directory to `frontend`
4. Add environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`)
5. Deploy

### Backend → Railway / Render / Fly.io

**Railway** (recommended):
1. Connect your GitHub repo
2. Set root directory to `backend`
3. Add all environment variables
4. Railway will auto-detect Node.js and run `npm start`

**Render**:
1. New Web Service → connect repo
2. Root directory: `backend`
3. Build command: `npm install && npm run build`
4. Start command: `node dist/index.js`
5. Add environment variables

Update `VITE_API_URL` in your Vercel deployment to point to your deployed backend URL.

### Supabase CORS

In Supabase → Authentication → URL Configuration:
- Add your Vercel frontend URL to **Redirect URLs**

---

## Project Structure

```
flyxa-ai/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express app entry
│   │   ├── middleware/
│   │   │   ├── auth.ts           # JWT verification
│   │   │   └── errorHandler.ts
│   │   ├── services/
│   │   │   ├── claude.ts         # All Anthropic API calls
│   │   │   └── supabase.ts       # Supabase client (service role)
│   │   ├── routes/
│   │   │   ├── trades.ts         # CRUD for trades
│   │   │   ├── ai.ts             # AI endpoints (chart scan, analysis)
│   │   │   ├── analytics.ts      # All analytics calculations
│   │   │   ├── risk.ts           # Risk settings + daily status
│   │   │   ├── psychology.ts     # Psychology logs
│   │   │   ├── playbook.ts       # Playbook entries
│   │   │   └── journal.ts        # Journal entries
│   │   └── types/index.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/                # One file per page/route
│   │   ├── components/           # Reusable UI components
│   │   ├── services/api.ts       # All fetch calls to backend
│   │   ├── contexts/             # Auth + Risk context providers
│   │   ├── hooks/                # useAuth, useTrades
│   │   ├── types/index.ts        # Shared TypeScript types
│   │   └── utils/calculations.ts # P&L, win rate, etc.
│   └── package.json
└── supabase/
    └── migrations/001_initial.sql
```

---

## API Overview

All endpoints require `Authorization: Bearer <supabase_jwt>` header.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trades` | Get all trades |
| POST | `/api/trades` | Create trade |
| PUT | `/api/trades/:id` | Update trade |
| DELETE | `/api/trades/:id` | Delete trade |
| POST | `/api/ai/scan` | Scan chart image with Claude vision |
| POST | `/api/ai/trade-analysis/:id` | AI analysis of a single trade |
| POST | `/api/ai/patterns` | AI pattern recognition across all trades |
| POST | `/api/ai/weekly-report` | AI weekly performance report |
| POST | `/api/ai/psychology-report` | AI psychology analysis |
| POST | `/api/ai/playbook-check/:id` | Compare trade to playbook |
| GET | `/api/analytics/summary` | Key performance metrics |
| GET | `/api/analytics/daily-pnl` | Daily P&L array |
| GET | `/api/analytics/equity-curve` | Cumulative P&L |
| GET | `/api/analytics/by-session` | Stats by trading session |
| GET | `/api/analytics/by-instrument` | Stats by symbol |
| GET | `/api/analytics/advanced` | R:R dist, drawdown, emotion analysis |
| GET/PUT | `/api/risk/settings` | Risk settings |
| GET | `/api/risk/daily-status` | Today's P&L, trades, limit status |

---

## Security Notes

- The `ANTHROPIC_API_KEY` is **only** used server-side. It is never sent to the browser.
- All database operations use the Supabase service role key server-side with Row Level Security enforced.
- JWTs are verified server-side using the Supabase JWT secret before any authenticated request.
- File uploads are handled in memory and never written to disk.

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push and open a PR
