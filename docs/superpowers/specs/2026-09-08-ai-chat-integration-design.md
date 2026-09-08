# TwinFoundry AI Chat Integration Design

**Date:** 2026-09-08
**Scope:** `apps/api` (new `src/ai/` module), `apps/web` (chat widget). External: Kimi K2 API (Moonshot, OpenAI-compatible), Qdrant Cloud (managed vector store).

## Goal

Give TwinFoundry a customer-facing AI chat that can call into `BadmintonService` (create/list sessions, mark a participant paid) on the user's behalf, with a human-approval gate before anything gets written.

## Constraints

- VPS: 2 CPU / 4 GB RAM / 80 GB SSD. Already runs `postgres`, `backup`, `minio`, `minio-init`, `api`, `web`, `caddy` in prod (`docker-compose.prod.yml`) — no RAM budget for another self-hosted heavy service.
- Chat generation and tool-calling reasoning run against the **Kimi K2 API** (hosted, pay-per-token) — self-hosting a model of comparable quality is infeasible on this hardware.
- Vector search runs on **Qdrant Cloud** (free tier: 0.5 vCPU / 1 GB RAM / 4 GB disk, permanent) instead of adding a `pgvector` load to the existing Postgres container, to keep the VPS's Postgres footprint unchanged.
- Tool-calling is **agentic-in-chat**: the agent decides which tool to call during the conversation turn. This is a synchronous request/response flow, not a background job — no queue tier is added for this feature. (Roadmap's planned Redis/BullMQ, `docs/ROADMAP-backend-nestjs.md:171-245`, remains scoped to mail and is unaffected.)

## Non-Goals

- **Mastra AI** — not used for this iteration. Confirmed production-viable (see `Seta-International/agent-platform`, which embeds Mastra agents per business module at enterprise/multi-tenant scale), but that scope — multiple specialist agents, a supervisor, workflow branching — doesn't exist here yet. One agent, a handful of tools: AI SDK Core covers it with less code. Revisit if TwinFoundry grows multiple agents or cross-module workflows.
- **Dedicated async worker tier** (e.g. graphile-worker, as used by the same reference repo for embeddings/agent-steps) — knowledge-base content changes infrequently at this stage; ingestion runs as a one-off admin action, not a queue.
- **MCP tool protocol** — tools are plain in-process functions. Worth adopting if tools ever need to be shared across more than one agent runtime (seen in `arcahyadi/odysseus`'s `mcp_servers/`), not before.
- Multi-agent / supervisor orchestration, load/perf testing.

## Architecture

```
apps/web (TanStack Start)
  ChatWidget ── SSE stream ──> POST /ai/chat
        │
        ▼ HTTPS
apps/api (NestJS) — new module src/ai/
  ┌──────────────────────────────────────────────┐
  │ AiController                                    │
  │   POST /ai/chat          (stream response)        │
  │   POST /ai/chat/confirm  (execute a pending write)  │
  │                                                  │
  │ ChatService                                       │
  │   - load/persist chat_message rows                 │
  │   - streamText({ model: kimiModel, messages, tools }) │
  │                                                  │
  │ kimiModel = createOpenAICompatible({                │
  │   baseURL: Moonshot, apiKey, maxRetries: N })         │
  │   .chatModel('kimi-k2.6')          — one const, not a class │
  │                                                  │
  │ tools = { createBadmintonSession, setParticipantPaid,    │
  │   searchKnowledgeBase } — plain object, passed straight    │
  │   into streamText. (No session-listing tool — session      │
  │   search/listing already exists elsewhere in the product.)  │
  │                                                  │
  │ RagService                                          │
  │   - embed query → qdrant.search(collection)            │
  └──────────────────────────────────────────────┘
        │ read/write tools call BadmintonService    │ vector query
        ▼                                          ▼
  badminton/ (BadmintonService)              Qdrant Cloud (free tier)
        │                                    collection: knowledge-base
        ▼
  Postgres (existing) + new chat_message table
        │
        ▼
  Kimi K2 API (Moonshot, OpenAI-compatible)
```

## Components

| Component | Responsibility |
|---|---|
| `AiController` | HTTP surface: `POST /ai/chat` (streams the assistant's reply), `POST /ai/chat/confirm` (executes a previously-proposed write) |
| `ChatService` | Loads/persists `chat_message` rows, drives `streamText` with history + tools |
| `kimiModel` | A single exported const from `createOpenAICompatible(...)` — not a provider class/service; swapping models later means editing this one value |
| `tools` | A plain object literal (`{ createBadmintonSession, setParticipantPaid, searchKnowledgeBase }`) passed directly into `streamText`'s `tools` option — no registry abstraction |
| `RagService` | Thin wrapper: embed the query, call `qdrant.search`, return top-k chunks. The one piece that genuinely wraps an external dependency, so it earns its own file |

## Data Model

New table, via TypeORM migration:

```
chat_message
  id            uuid pk
  threadId      uuid          -- groups a conversation
  userId        uuid fk       -- existing users table
  role          enum('user','assistant','tool')
  content       text
  toolCall      jsonb null    -- { name, args } when role='assistant' proposed a write
  toolCallState enum('none','pending','confirmed','rejected','executed') default 'none'
  createdAt     timestamptz
```

No separate confirmation table. A pending write **is** the last `assistant` row in the thread with `toolCallState = 'pending'` — the confirm endpoint reads it from `chat_message`, not from a side table.

## Data Flow

1. `ChatWidget` sends `POST /ai/chat { message, threadId? }`, authenticated via the existing JWT guard.
2. `AiController` validates the DTO, hands off to `ChatService`.
3. `ChatService` loads prior `chat_message` rows for `threadId` (or creates a new thread).
4. `streamText({ model: kimiModel, messages, tools })` runs. The read-only tool (`searchKnowledgeBase`) executes immediately inside the AI SDK's tool loop.
5. If the model calls a **mutating** tool (`createBadmintonSession`, `setParticipantPaid`), that tool does not perform the write. It returns a draft description of the action, which the model surfaces to the user as a natural-language confirmation ask. `ChatService`'s `onFinish` callback (a `streamText` option) inspects the resolved tool results, and when one is a draft, persists this turn with `toolCallState = 'pending'` and `toolCall = { name, args }`.
6. The stream is written back to the client (`pipeUIMessageStreamToResponse`); `ChatWidget` (via `@ai-sdk/react`'s `useChat`) renders tokens as they arrive. Once `status` returns to `'ready'`, it calls `GET /ai/chat/:threadId/pending-action` and shows a Confirm/Reject affordance if one is pending.
7. On stream completion, the assistant message is persisted (already covered by step 5 for the pending case; for a plain answer, just the final text).
8. User confirms → `POST /ai/chat/confirm { threadId }`. `ChatService` reads the thread's last `pending` row, re-validates it hasn't expired (15 minutes from `createdAt`, checked inline — no separate TTL job), re-runs the same ownership check the tool would have used, executes the real mutating call (e.g. `BadmintonService.createSession`), and appends the result as a new `tool` message. `toolCallState` flips to `executed` (or `rejected` if the user declined).
9. RAG: `searchKnowledgeBase` embeds the query, queries Qdrant, returns chunks the model folds into its answer — no persistence beyond the normal chat turn.

## HITL — Mutating Tool Safety

Any tool capable of a write:

- Never executes inline during the model's tool loop. It only returns a draft.
- The **confirm** endpoint re-runs the same ownership check the equivalent REST endpoint already does (`where: { id, ownerId }`, per `docs/casl-removal-plan.md` — CASL was removed in favor of this plus a coarse `@Roles()` check), keyed off the authenticated user — the model's decision to call the tool is never treated as authorization by itself.
- A `pending` row past its expiry window is rejected on confirm; the user has to ask again (regenerates a fresh draft, avoiding stale-state writes).

## Error Handling

- Kimi API error/timeout/429 → rely on the AI SDK provider's built-in `maxRetries`; on exhaustion, return a fallback message and log via the existing interceptor — never crash the request.
- Tool throws → caught and fed back into the model as a structured tool error (AI SDK's tool-error path) so the model can respond sensibly, instead of aborting the stream.
- Qdrant unreachable → `searchKnowledgeBase` fails soft; the model answers without retrieved context, a warning is logged.
- Client disconnects mid-stream → abort the underlying LLM call server-side to avoid paying for unread tokens.

## Testing

- Unit tests per tool function, domain services mocked — same `@nestjs/testing` pattern already used in the repo.
- One end-to-end test (`supertest`, matching the existing `apps/api/test/` pattern) against `POST /ai/chat` and `POST /ai/chat/confirm`, with the LLM provider replaced by a fixture returning a canned tool-call sequence. This is the only layer that exercises the HITL gate + confirm flow — a separate service-level integration test would just duplicate it, so it isn't added.
- One manual golden-path run against the real Kimi API in dev before shipping (tool-calling quality isn't something a fixture can validate).
- No load/perf testing at this stage — traffic and hardware don't warrant it yet.

## Cost & Ops

- Kimi K2.6: $0.95 / $4.00 per million input/output tokens (cache-hit input $0.15/M). At ~3,000 chat requests/month (~2K input + 500 output tokens each), roughly $11-12/month.
- Qdrant Cloud free tier covers the knowledge-base collection at this scale; upgrade only if the KB or query volume outgrows 1 GB RAM / 4 GB disk.
- No new self-hosted service added to the VPS for this feature.

## Future Upgrade Path

- **Mastra**, if a second agent or a cross-module workflow shows up — it ships a Postgres-backed memory adapter and a first-class Qdrant adapter, so the migration path from this design is additive, not a rewrite.
- A worker tier (Redis/BullMQ, reusing the roadmap's Phase 3 plan, or a Postgres-backed queue like graphile-worker) if knowledge-base ingestion needs to become continuous rather than an admin action.
- MCP for tools, if they need to be consumed by more than this one chat agent.
