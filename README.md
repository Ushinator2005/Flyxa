# Flyxa AI

Flyxa AI is a futures trading workspace for journaling trades, scanning chart screenshots, reviewing performance, tracking goals, and using AI to surface execution patterns.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Zustand |
| Backend | Node.js, Express, TypeScript |
| Database/Auth | Supabase |
| Charts/UI data | Recharts, date-fns, lucide-react |
| AI | Anthropic Claude and Google Gemini |

## Local Setup

Install dependencies in both apps:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Create environment files from the examples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Run every Supabase migration in `supabase/migrations` in numeric order.

Start the apps:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

Frontend: `http://localhost:5173`  
Backend health: `http://localhost:3001/health`

## Required Environment

Backend:

```env
PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key
DEBUG_AI_LOGS=false
FRONTEND_URL=http://localhost:5173
```

Frontend:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:3001
VITE_FINNHUB_KEY=your_finnhub_api_key
VITE_POLYGON_KEY=your_polygon_api_key
VITE_FMP_KEY=your_fmp_api_key
```

## Auth

Email/password auth works through Supabase Auth. Google auth also uses Supabase OAuth and requires setup in both Google Cloud and Supabase:

1. Create a Google OAuth client.
2. Add the Supabase callback URL in Google Cloud.
3. Add the Google client ID and secret in Supabase Auth providers.
4. Add local and production frontend URLs to Supabase redirect URLs.

## Data Model Notes

The app uses:

- `user_store` for the main persisted frontend workspace state.
- `store_entries_backup` as a per-entry recovery mirror.
- Dedicated tables such as `goals`, `trading_accounts`, and legacy journal/trade tables where still needed.

Broker/login credentials are intentionally not stored by Flyxa.

## Scripts

Frontend:

```bash
npm run dev
npm run build
npm run test
```

Backend:

```bash
npm run dev
npm run build
npm start
```

## Security Notes

- Do not commit `.env` files.
- Do not commit `node_modules`, `dist`, local logs, or generated scratch bundles.
- Backend Supabase access uses the service role key, so backend routes must always scope queries by `user_id`.
- Keep `DEBUG_AI_LOGS=false` unless debugging locally; raw AI responses can contain user trading data.
