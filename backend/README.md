# PresupuestoYA — Backend

Express + TypeScript. Receives voice notes from a Telegram bot, sends them to Gemini, persists a quote in Supabase, and exposes a JSON API for the web editor.

## Quick start

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your real keys (Supabase, Gemini, Telegram)
npm run dev
```

Server runs on `http://localhost:3001`.

## Endpoints

| Method | Path                              | Purpose                                              |
| ------ | --------------------------------- | ---------------------------------------------------- |
| GET    | `/api/health`                     | Liveness check                                       |
| POST   | `/api/webhooks/telegram`          | Telegram webhook (voice/audio notes)                 |
| POST   | `/api/test/simulate-voice`        | **DEV**: simulate a voice note, no real audio        |
| GET    | `/api/quotes/:id`                 | Load a quote (used by the editor)                    |
| PATCH  | `/api/quotes/:id`                 | Update a quote + replace its items                   |
| GET    | `/api/quotes/slug/:slug`          | Load a quote by slug (used by the public view)       |
| POST   | `/api/quotes/:id/share`           | Mark quote as `shared`, return public URL            |
| GET    | `/api/contractors/:id/profile`    | Load the contractor's business profile               |
| PATCH  | `/api/contractors/:id/profile`    | Upsert the contractor's business profile             |

## Demo without sending a real voice note

```bash
curl -X POST http://localhost:3001/api/test/simulate-voice \
  -H "Content-Type: application/json" \
  -d '{}'
```

Returns `{ quote_id, slug, contractor_id, edit_url, public_url }`. Open `edit_url` in your browser to see the editor.

You can override the mock data:

```bash
curl -X POST http://localhost:3001/api/test/simulate-voice \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_user_id": 1000000001,
    "client_name": "María González",
    "currency": "USD",
    "items": [
      { "description": "Instalación eléctrica", "qty": 1, "unit_price": 450 }
    ]
  }'
```

## Wiring the Telegram bot (local dev)

1. Run ngrok to expose the backend:

   ```bash
   ngrok http 3001
   ```

   Copy the `https://...` URL it prints.

2. Tell Telegram where to send updates:

   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=$NGROK_URL/api/webhooks/telegram"
   ```

   If you set `WEBHOOK_SECRET` in `.env`, also pass it:

   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=$NGROK_URL/api/webhooks/telegram&secret_token=$WEBHOOK_SECRET"
   ```

3. Send a voice note to your bot in Telegram. You should get a reply with the editor link within a few seconds.

## What the Gemini prompt assumes

Spanish neutral for Venezuelan contractors. Tunable in `src/services/gemini.ts`.

## What's NOT here (yet — by design for the MVP)

- Auth on the editor (anyone with `/q/:id` can edit)
- Auth on PATCH (same)
- RLS on the frontend (backend uses service_role which bypasses it)
- Retry / outbox
- Rate limiting
- Tests

Add these once you've validated the flow with real users.
