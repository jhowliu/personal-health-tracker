# 每日減脂計畫 (Daily Fat-Loss Plan)

An iPhone/Android app that ties body tracking, meals and workouts into one daily flow.
Spec: `spec.pdf` · Wireframes: `wireframe.pdf` · Domain terms: [`CONTEXT.md`](CONTEXT.md)

- **P1** Accounts, daily targets, body tracking, workouts, daily flow
- **P2** Food catalog, meals, substitution, auto-plan
- **P3** Meal-photo recognition (OpenAI), workout swaps. Without `OPENAI_API_KEY` those endpoints
  answer "not configured"; nothing is made up.

## Architecture

Backend layers, dependencies point inward: `api` → `adapters` → `application` → `domain`.
Rules live in `backend/app/domain/`, pure Python with no framework. In `mobile/src/`, `app/` is
routes only; logic lives in `api/`, `auth/` and `components/`.

## Run

Backend:

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
```

```bash
cd backend && DB_PATH=./dev.sqlite .venv/bin/python -m scripts.migrate
```

```bash
cd backend && DB_PATH=./dev.sqlite .venv/bin/python -m seeds.foods
```

```bash
cd backend && DB_PATH=./dev.sqlite .venv/bin/python -m seeds.exercises
```

```bash
cd backend && DB_PATH=./dev.sqlite .venv/bin/python -m seeds.workout_templates
```

Optional sample meals, so a new account has something to plan:

```bash
cd backend && DB_PATH=./dev.sqlite .venv/bin/python -m seeds.sample_meals
```

```bash
cd backend && DB_PATH=./dev.sqlite JWT_SECRET=$(openssl rand -hex 32) .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8010
```

API docs: http://localhost:8010/docs. `--host 0.0.0.0` is for a real phone; drop it for a simulator.

App:

```bash
cd mobile && npm install
```

```bash
cd mobile && EXPO_PUBLIC_API_URL=http://localhost:8010 npm run ios
```

On a real phone, `localhost` is the phone itself. Use the Mac's LAN IP (`ipconfig getifaddr en0`)
on the same Wi-Fi and scan the QR code with Expo Go:

```bash
cd mobile && EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8010 npx expo start
```

Push notifications and Google/Apple sign-in need a development build. The morning weigh-in reminder
is a local notification and works in Expo Go.

## Test

```bash
cd backend && .venv/bin/python -m pytest
```

```bash
cd backend && .venv/bin/lint-imports
```

```bash
cd mobile && npm run typecheck && npm run lint
```

## After changing the API

Regenerate the mobile types, or the two sides drift apart:

```bash
cd backend && .venv/bin/python -m scripts.export_openapi && cd ../mobile && npm run api:types
```

CI checks that they match:

```bash
cd backend && .venv/bin/python -m scripts.check_openapi
```

## Deploy

`docker compose up` starts the api and minio containers. SQLite has one writer, so Uvicorn runs a
single worker. Back up with `ops/litestream.yml` to a destination off the host.
