# Ops Runbook

## Environment Profiles

The backend reads environment settings from `backend/config.py`.

Profiles:

- `APP_ENV=development`
- `APP_ENV=production`

Default behavior by profile:

- Development:
  - `LOG_LEVEL=DEBUG`
  - `SCHEDULER_MODE=test`
  - `INTERNAL_DEBUG_ENABLED=true`
  - `INTERNAL_DEBUG_REQUIRE_ADMIN=false`
  - `COOKIE_SECURE=false`
- Production:
  - `LOG_LEVEL=INFO`
  - `SCHEDULER_MODE=cron`
  - `INTERNAL_DEBUG_ENABLED=false`
  - `INTERNAL_DEBUG_REQUIRE_ADMIN=true`
  - `COOKIE_SECURE=true`

## Core Environment Variables

Required:

- `MONGO_URL`

Recommended:

- `APP_ENV=production`
- `ALLOWED_ORIGINS=https://your-frontend-domain.com`
- `COOKIE_SECURE=true`
- `LOG_LEVEL=INFO`
- `SCHEDULER_MODE=cron` (`cron`, `test`, `off`)
- `SCHEDULER_TEST_DELAY_MINUTES=2`
- `TARGET_REMINDER_HOURS=24`
- `INTERNAL_DEBUG_ENABLED=false`
- `INTERNAL_DEBUG_REQUIRE_ADMIN=true`

## Startup Guard

On startup, the app validates critical settings and refuses to start if invalid.

Guarded rules:

- `MONGO_URL` must be present.
- `LOG_LEVEL` must be valid (`TRACE`, `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`).
- `SCHEDULER_MODE` must be one of `cron`, `test`, `off`.
- In production:
  - `COOKIE_SECURE` must be `true`.
  - `ALLOWED_ORIGINS` must not contain `*`.
  - `ALLOWED_ORIGINS` must not be empty.

## Health Checks

Live check:

- `GET /health/live`
- Confirms API process is running.

Ready check:

- `GET /health/ready`
- Verifies:
  - MongoDB ping succeeds.
  - Scheduler state is valid (`running=true` unless mode is `off`).
- Returns `503` when not ready.

Smoke script:

- `python scripts/health_smoke.py`
- Optional base URL: `python scripts/health_smoke.py http://localhost:8000`
- Exit code is `0` on success, non-zero on failure.

## Scheduler Modes

Configured by `SCHEDULER_MODE`:

- `cron`: Runs production schedule (09:00, 21:00 scrape + Monday 10:00 summary).
- `test`: Runs one delayed scrape (`SCHEDULER_TEST_DELAY_MINUTES`).
- `off`: Scheduler disabled.

## Internal Debug Endpoints

Available when enabled:

- `POST /api/internal/debug/scrape-now`
- `POST /api/internal/debug/notify-test`

Security:

- Requires authenticated user.
- Optional admin-only gate controlled by `INTERNAL_DEBUG_REQUIRE_ADMIN`.

## Payments (Stripe + Iyzico)

Payment endpoints:

- `GET /api/payments/config`
- `GET /api/payments/subscription`
- `POST /api/payments/checkout/start`
- `POST /api/payments/webhook/stripe`
- `POST /api/payments/webhook/iyzico`

Required envs for Stripe:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_PRO_MONTHLY`
- `STRIPE_PRICE_ID_PRO_YEARLY`

Iyzico note:

- You can complete the provider adapter directly, or set `IYZICO_CHECKOUT_URL_TEMPLATE` as a temporary hosted checkout redirect template.

## Production Checklist

1. Set `APP_ENV=production`.
2. Set strict `ALLOWED_ORIGINS` (no wildcard).
3. Ensure `COOKIE_SECURE=true`.
4. Set `LOG_LEVEL=INFO` or stricter.
5. Set `INTERNAL_DEBUG_ENABLED=false`.
6. Verify `GET /health/live` and `GET /health/ready`.
