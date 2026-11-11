# PayPilot: multi-agent payments operations assistant

PayPilot answers the questions a payments support or finance team asks all
day: *why did this payment fail, where is this refund, does this settlement
match our books, is this transaction risky.* A router sends each question to
one of five specialist agents, which call real Razorpay APIs, ground
themselves in policy documents, and (when an Anthropic key is set) have Claude
write the answer, streamed live into the chat.

- **Five specialist agents**: payments, refunds, reconciliation, fraud, general
- **Real data, never faked**: with Razorpay keys every answer comes from the live API, and a missing payment is reported as missing. Without keys the app runs in a clearly labelled demo mode.
- **AI-written answers**: Claude (`claude-opus-5-5` by default) turns the agents' facts into a clear reply, token by token. No key? Deterministic template replies.
- **Conversation memory**: follow-ups like *"and has it been refunded?"* reuse the payment from earlier in the chat. Conversations are stored in SQLite and can be listed, reopened and deleted.
- **Production basics**: API-key auth, per-key/IP rate limits, request ids, JSON logs, consistent error bodies, health/readiness probes, OpenAPI docs at `/api/docs`.
- **Tests and evals**: 49 pytest tests (API, security, tools, LLM writer, router) plus a router eval set.

## Architecture

```
Browser (React SPA, served by the same service)
   │  POST /chat/stream  (SSE: step → meta → token… → done)
   ▼
FastAPI  app/api ──► ChatOrchestrator  app/services/orchestrator.py
                        │ 1. load conversation memory      (SQLite, app/services/store.py)
                        │ 2. route intent + resolve ids     (app/agents/router.py)
                        │ 3. specialist agent               (app/agents/specialists.py)
                        │      ├─ policy passages (TF-IDF RAG, rag/)
                        │      └─ payment tool              (app/agents/tools.py → Razorpay)
                        │ 4. write the answer               (Claude, app/services/llm.py)
                        └ 5. persist the exchange
```

The agents do the deterministic work (routing, tool calls, policy lookup), so
the facts are always the same and auditable. Claude only writes the answer
from those facts, and never sees anything it could act on. If the LLM is off,
declines, or errors, the agent's own draft is streamed instead, so a chat
never fails because of the LLM.

The same tools are also exposed over **MCP** (`python -m mcp_server.tools`),
so Claude Desktop or another agent can use them directly.

```
app/
  main.py              app factory, lifespan, SPA mount
  core/                config, logging, errors, security, middleware
  api/routes/          chat, conversations, payments, system
  agents/              router, specialists, tools
  integrations/        Razorpay client, ledger + reconciliation
  services/            orchestrator, LLM writer, SQLite store
rag/                   policy docs + TF-IDF index
mcp_server/tools.py    MCP server over the same tools
evals/                 router eval set
tests/                 pytest suite
```

## Running locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m rag.build_index            # once: builds rag/indexes/
cp .env.example .env                 # optional: add keys
uvicorn app.main:app --reload --port 8010
```

Open http://localhost:8010/api/docs for the interactive API docs. For the UI,
run `npm ci && npm run dev` in `frontend/` (it proxies to port 8010), or
`npm run build` to have FastAPI serve it from `/`.

```bash
pytest                               # 49 tests, no keys or network needed
python -m evals.run_evals            # router eval, exits non-zero on any miss
```

## Configuration

Everything is optional; see `.env.example` for the full list.

| Variable | Effect |
|---|---|
| `PAYPILOT_API_KEYS` | Comma-separated API keys. Clients send `X-API-Key`. Unset = open API. |
| `PAYPILOT_REQUIRE_AUTH` | `1` refuses to start without keys. Use in production. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Real Razorpay data (test or live keys). Unset = demo mode. |
| `ANTHROPIC_API_KEY` | Claude writes the answers. Unset = template answers. |
| `LLM_MODEL` / `LLM_EFFORT` | Defaults `claude-opus-5-5` / `low`. |
| `LEDGER_PATH` | JSON ledger export for reconciliation. |
| `DATABASE_PATH` | SQLite file for conversations (default `data/paypilot.db`). |
| `TRUST_PROXY_HEADERS` | `1` behind Render so rate limits see the real client IP. |
| `ALLOWED_ORIGINS` | CORS origins, only when the UI is hosted elsewhere. |

## API

| Method & path | Purpose |
|---|---|
| `POST /chat` | One answer as JSON. Body `{message, session_id?}`. |
| `POST /chat/stream` | Same, as server-sent events (`step`, `meta`, `token`, `done`, `error`). |
| `GET /api/conversations` · `GET/DELETE /api/conversations/{id}` | Conversation history (per API key). |
| `GET /api/payments` · `GET /api/settlements` | Recent real Razorpay records (live mode only). |
| `GET /api/stats` · `GET /api/activity` | Dashboard numbers and recent activity. |
| `GET /api/agents` · `GET /api/config` · `GET /api/info` | Agent catalogue, config, version/mode. |
| `GET /api/auth/status` · `GET /api/auth/check` | Whether a key is needed / validate a key. |
| `GET /health` · `GET /api/health` | Liveness / readiness (checks the database). |

Errors always look like `{"detail": "...", "code": "...", "request_id": "..."}`.

## Deploying (Render)

`render.yaml` defines one Docker web service that builds the React frontend and
serves it from the same FastAPI process. Set these in the Render dashboard:

1. `PAYPILOT_API_KEYS` (and then `PAYPILOT_REQUIRE_AUTH=1`) so the API isn't open.
2. `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` for real data.
3. `ANTHROPIC_API_KEY` for AI-written answers.

The free plan has no persistent disk, so stored conversations reset when the
service restarts. Attach a disk (paid plans) and point `DATABASE_PATH` at it to
keep them.
