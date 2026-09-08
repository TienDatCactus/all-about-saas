# AI Chat — Deployment Checklist

New surface area with real risk vectors a normal feature deploy doesn't have: an external LLM dependency that can cost money per request, a human-in-the-loop (HITL) gate whose entire job is preventing unintended writes, and three new external services (Kimi, OpenAI, Qdrant) that can each fail independently. Run this checklist before pointing real traffic at `/ai/chat`.

Background: `docs/superpowers/specs/2026-09-08-ai-chat-integration-design.md` (design), `docs/superpowers/plans/2026-09-08-ai-chat-integration.md` (implementation plan + final-review fixes).

## 1. Before you deploy

### Secrets & config

- [ ] `KIMI_API_KEY` set to a real Moonshot key in `.env.production.local` (or the `_FILE` secret variant via `docker-compose.prod.yml`, same pattern as `JWT_SECRET`) — not a placeholder.
- [ ] `OPENAI_API_KEY` set (embeddings only, not chat).
- [ ] `QDRANT_URL` / `QDRANT_API_KEY` point at the real production Qdrant Cloud cluster, not a dev/test instance.
- [ ] `QDRANT_COLLECTION` is set deliberately (defaults to `twinfoundry-kb` if unset) and matches whatever the ingestion script actually populated — a mismatch here fails silently (RagService's fail-soft `catch` turns a 404 into "no results found", not an error).
- [ ] Confirm the app refuses to boot if any of the four vars above are missing or malformed (`env.validation.ts` enforces this via zod) — don't just trust the code, actually try booting with one unset in a throwaway environment and confirm it crashes loudly rather than starting in a half-configured state.
- [ ] None of the four keys appear in logs or error responses. Deliberately trigger a Kimi API error (e.g. temporarily wrong key in staging) and check the resulting log line / HTTP error body doesn't echo the key back.

### Database

- [ ] Run `npm run migration:run -w @app/api` against production **before** the new code goes live — creates the `chat_message` table.
- [ ] Confirm the migration is additive-only (new table + indices, no `ALTER` on any existing table) — true as written, worth a second look given how much has changed since it was generated.

### Knowledge base

- [ ] Run the ingestion script once against the real production Qdrant collection, with `NODE_ENV=production` so it loads `.env.production.local` (the script was fixed mid-review to load `.env.<NODE_ENV>.local`, not a bare `.env`):
  ```bash
  cd apps/api && NODE_ENV=production npx ts-node -r tsconfig-paths/register src/ai/scripts/ingest-knowledge-base.ts
  ```
- [ ] Confirm the printed chunk count is sane (currently ~10, matching `docs/badminton-splitter-spec.md`'s heading count) — zero chunks means the file path resolution broke, not that the doc is empty.

### Cost & abuse controls

- [ ] Decide whether `/ai/chat` needs a tighter rate limit than the app-wide default (currently shares the global throttle with every other route — a chat endpoint is the one route where each request has a real dollar cost behind it).
- [ ] Confirm `stopWhen: isStepCount(5)` is still in place in `chat.service.ts` — bounds how many tool-calling round-trips one request can rack up.
- [ ] Confirm chat history is bounded (`take: 40` in `handleMessage`) — an unbounded thread grows request cost linearly per turn, quadratically per thread.
- [ ] Set up a spend alert on the Moonshot and OpenAI dashboards (outside this repo, but do it before real traffic, not after the first surprising bill).

### HITL safety gate — the property this whole feature exists to guarantee

- [ ] Re-verify `buildWriteTools()` (`apps/api/src/ai/tools/write-tools.ts`) only returns draft objects — no repository/service import in that file, no `await` on anything but the trivial async wrapper.
- [ ] Re-verify `confirmAction` (`chat.service.ts`) re-checks ownership (`userId` in the `where` clause), the 15-minute expiry, and runs under `pessimistic_write` — read the actual current code, don't rely on memory of what was reviewed.
- [ ] In staging: draft a mutating action, let it sit past 15 minutes, then hit confirm — expect a rejection, not an execution.
- [ ] In staging: double-click confirm as fast as possible on the same draft — expect exactly one write. (A narrow, documented residual race exists between the drafted-supersession `update` and the row `save` in `onFinish` — not the confirm path itself — see the plan's final-review section if this ever needs revisiting.)

## 2. Smoke test in staging before real users

- [ ] Send a real chat message, get a real streamed response back (proves Kimi auth actually works end to end — this exact path had a real bug where the API key silently never made it into the request).
- [ ] Trigger a mutating action ("create a session on...") — confirm it surfaces a Confirm/Cancel prompt and does **not** write immediately.
- [ ] Click Confirm — verify the real `BadmintonService` write landed (check the database, not just the UI).
- [ ] Draft a different action and click Cancel — verify **no** write happened.
- [ ] Ask a knowledge-base question (e.g. how the cost split works) — verify the answer is grounded in real retrieved content, not an ungrounded model guess.
- [ ] Temporarily block/misconfigure Qdrant — verify chat still answers (degrades gracefully) instead of crashing or hanging.
- [ ] Send a malformed `threadId` directly (`curl` or Postman, not through the UI) — expect 400, not 500.
- [ ] Test with an expired/missing JWT — expect a clean 401, not a hang.

## 3. Right after going live

- [ ] Watch API logs for the first real conversations — this is genuinely new code, worth an eyeball pass in the first hour rather than waiting for someone to report a problem.
- [ ] Watch the Moonshot / OpenAI / Qdrant dashboards for unexpected cost or latency spikes.
- [ ] Confirm no API key value shows up anywhere in production logs from real traffic.
- [ ] Spot-check a handful of real `chat_message` rows — correct `threadId`/`userId` scoping, nothing crossing between users.

## 4. Rollback plan

- [ ] This feature is purely additive (new module, new table, new route, new `/chat` page) — rollback is reverting the deploy or hiding the `/chat` link/route on the frontend. No destructive database rollback needed; an unused table is harmless.
- [ ] If the problem is specifically Kimi-related (bad responses, runaway cost) — unsetting `KIMI_API_KEY` should fail `/ai/chat` closed without affecting the rest of the app. **Confirm this is actually true in staging before relying on it as a kill switch** — don't discover otherwise during an incident.

## 5. Known non-blocking gaps (tracked, not reasons to hold the deploy)

| Gap | Why it's not blocking |
|---|---|
| `BaseEntity` timestamp columns are `timestamp without time zone`; `pg` reads them back in local time, not UTC — affects this feature's 15-minute expiry math on any non-UTC host | The production container defaults to UTC (Debian base image, no `TZ` override), so this doesn't manifest in prod today. It's app-wide pre-existing debt, not specific to AI chat — worth its own ticket regardless. |
| `apps/api/test/app.e2e-spec.ts` fails (`GET /` expects `'Hello World!'`, route doesn't exist) | Predates this branch entirely — verified against the branch's own base commit. Unrelated to AI chat. |
| 3 new shadcn component files import `cn` from a different package than the other 60+ `ui/*.tsx` files | Cosmetic, functionally safe, verified passing build/lint/typecheck. |
| `configuration.ts`'s `ai:` block is dead code (nothing injects it) | No functional impact — the actual code paths all read `process.env` directly instead. |
| Web client's `onFinish` callback has the same unguarded-rejection shape `handleConfirm` was fixed for | Low practical risk today — the only way it fails is a malformed `threadId`, which this client never produces. |
| 7 pre-existing eslint errors in `rag.service.ts` / `tools/*.spec.ts` | Confirmed pre-existing, unrelated to changes in this feature. |
