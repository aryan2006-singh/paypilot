# PayPilot — Multi-Agent Payments Operations Assistant

A production-shaped AI agent system for payments support: intent routing, RAG over
policy docs, and specialist LangGraph agents that call payment operations through
an MCP tool server. Built to demonstrate the full stack a payments company actually
runs in production — not just a notebook demo.

## Why this project

Razorpay's "AI Builders" track rewards proof of work over resumes. This project is
scoped to show:
- **Agent orchestration** — LangGraph state graph with a router + 4 specialists
- **RAG** — TF-IDF retrieval over namespaced payments policy docs
- **Tool use via MCP** — payment actions exposed as MCP tools, not hardcoded API calls
- **Production API** — FastAPI with streaming responses, Pydantic v2 request/response
  models, async throughout
- **Deployability** — one-service Docker build (API + UI), health check, eval harness

## Architecture

```
Client → FastAPI (/chat, streaming)
           → LangGraph router (intent classification)
               → Payments agent     ─┐
               → Refunds agent       ├─ each calls RAG store (policy context)
               → Reconciliation agent│  + MCP tool server (live actions)
               → Fraud-flag agent   ─┘
```

## Getting started

```bash
pip install -r requirements.txt
python -m rag.build_index          # required once — populates rag/indexes/
cp .env.example .env               # optional: add Razorpay test keys
uvicorn app.main:app --reload
```

Hit `POST /chat` with `{"message": "Where is my refund for payment pay_XXXX?"}`.

The app runs fully without any API keys — every MCP tool falls back to
deterministic mock data, and `/api/config` reports which mode you're in.

To serve the UI from the same process, build the frontend too:

```bash
cd frontend && npm ci && npm run build   # emits frontend/dist/
```

Without that build the API still boots; `/` just returns a short JSON notice
instead of the SPA.

## Deploying

`render.yaml` defines a single Render web service built from the `Dockerfile`,
which compiles the React frontend and serves it from the same FastAPI process —
so there's no CORS wiring and no second deploy to keep in sync.

```
Render → New → Blueprint → point at this repo
```

Docker runtime is deliberate: `frontend/dist` and `rag/indexes/` are gitignored
build artifacts, so the image has to produce both. It fits the free tier
(~80 MB resident). No environment variables are required to get a working
deploy; `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` only switch it from mock data
to Razorpay's test API.

## What's stubbed vs real

- The MCP tools in `mcp_server/tools.py` call Razorpay's **test-mode** API
  (https://razorpay.com/docs/api/ — get free test keys from the dashboard).
  Swap `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` in `.env` to go live in test mode.
- The RAG corpus in `rag/docs/` is a placeholder — drop in your own Razorpay
  policy/FAQ markdown files and re-run `python -m rag.build_index`.
- Retrieval is TF-IDF (`rag/tfidf.py`), not embeddings. On a corpus of four
  short policy docs it ranks the same passages a MiniLM embedding would, and it
  keeps the service inside a 512 MB instance — the sentence-transformers stack
  held ~490 MB resident on its own. Swap it back in if the corpus grows enough
  that semantic matching starts to matter.
- Fraud-flag agent uses a simple rule-based risk score as a starting point —
  swap in a real model if you want to go further.

## Fixes applied to get this running

The scaffold as generated had a few bugs that would have broken it on first run:

- `agents/graph.py` called MCP tools with `{"query": message}`, but the tools in
  `mcp_server/tools.py` expect a specific `payment_id`/`settlement_id`. Added an
  ID-extraction helper so agents pull `pay_XXXX` / `stl_XXXX` out of the message
  before calling the tool.
- `mcp_server/client.py` never actually opened the MCP connection —
  `client.get_tools()` was awaited (it's synchronous) and the client was never
  entered as an async context manager, so `server_name_to_tools` stayed empty.
  Fixed to open the stdio connection once and reuse it.
- `requirements.txt` pinned `langchain-core==0.3.10` and `mcp==1.0.0`, both of
  which conflict with `langchain-mcp-adapters==0.0.5`'s own requirements
  (`langchain-core>=0.3.36`, `mcp>=1.4.1,<1.5`) — `pip install` failed outright.
  Bumped both.
- `mcp_server/tools.py` didn't catch network-level errors from httpx, so any
  connectivity hiccup calling Razorpay would 500 the whole `/chat` request
  instead of degrading gracefully. Wrapped each call in a try/except.
- Two directories were created with literal (unexpanded) brace syntax —
  `rag/docs/{payments,refunds,reconciliation,general}` and a stray top-level
  `{agents,mcp_server,rag,app}` — so only the `refunds` RAG namespace actually
  had docs. Added placeholder `policy.md` files for the other three namespaces
  and removed the stray directory.
- Added the missing `.env.example` referenced in the setup instructions below.

## Fixes applied to make it deployable

A later pass audited the repo against an actual Render deploy and found it
would not have booted:

- `app/main.py` mounted `StaticFiles(directory=frontend/dist)` unconditionally.
  `frontend/dist` is a gitignored build artifact and the Render build command
  never produced it, so `StaticFiles` raised `RuntimeError` at import — the
  service would have crash-looped on every deploy, not degraded. The mount is
  now conditional, and the Docker build actually produces the directory.
- `render.yaml` used `runtime: python`, which has no Node available to build
  the frontend. Switched to the existing multi-stage `Dockerfile`, which builds
  the SPA and the Python app in one image.
- The dependency stack pulled `torch` transitively via `sentence-transformers`
  and measured **488 MB resident** — Render's free *and* starter tiers are both
  512 MB, so this would have been OOM-killed. On Linux, `pip install torch` also
  drags in ~2.5 GB of CUDA wheels. Replaced FAISS + sentence-transformers with
  the TF-IDF retriever in `rag/tfidf.py` (~80 MB resident, ~50 MB installed).
- `mcp_server/client.py` spawned its stdio subprocess with a bare `"python"`,
  which isn't guaranteed to be on PATH or to be the same interpreter as the
  running venv. Now uses `sys.executable`.
- The `Dockerfile` hardcoded `--port 8000`, ignoring the `$PORT` that Render
  and most PaaS hosts inject. Now honours `$PORT` and runs as a non-root user.
- `anthropic==0.36.0` and `ANTHROPIC_API_KEY` were declared but never imported
  or read anywhere in the codebase. Removed both.

Verified end-to-end: from a clean checkout with no build artifacts, installed
only the pinned requirements, built the index, booted uvicorn, and confirmed
all 5 routing intents (payments, refunds, reconciliation, fraud, general)
return 200 with the correct agent, every `/api/*` endpoint and the SSE stream
respond, and `evals/run_evals.py` passes 5/5.

## Extending for the submission

1. Deploy it (Render/Railway free tier works) so the link is live, not just a repo.
2. Add 3-5 real eval cases in `evals/cases.jsonl` and show pass/fail in the README —
   this is what "proof of work" evaluators actually look for over polish.
3. Record a 60-90s Loom showing a real query hitting a real Razorpay test payment.
