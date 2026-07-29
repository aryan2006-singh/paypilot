# PayPilot — Multi-Agent Payments Operations Assistant

A production-shaped AI agent system for payments support: intent routing, RAG over
policy docs, and specialist LangGraph agents that call payment operations through
an MCP tool server. Built to demonstrate the full stack a payments company actually
runs in production — not just a notebook demo.

## Why this project

Razorpay's "AI Builders" track rewards proof of work over resumes. This project is
scoped to show:
- **Agent orchestration** — LangGraph state graph with a router + 4 specialists
- **RAG** — FAISS + sentence-transformers over payments policy docs
- **Tool use via MCP** — payment actions exposed as MCP tools, not hardcoded API calls
- **Production API** — FastAPI with streaming responses, Pydantic v2 request/response
  models, async throughout
- **Deployability** — Dockerfile, structured logging, basic eval harness

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
cp .env.example .env   # add your Anthropic API key + Razorpay test keys
uvicorn app.main:app --reload
```

Hit `POST /chat` with `{"message": "Where is my refund for payment pay_XXXX?"}`.

## What's stubbed vs real

- The MCP tools in `mcp_server/tools.py` call Razorpay's **test-mode** API
  (https://razorpay.com/docs/api/ — get free test keys from the dashboard).
  Swap `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` in `.env` to go live in test mode.
- The RAG corpus in `rag/docs/` is a placeholder — drop in your own Razorpay
  policy/FAQ markdown files and re-run `rag/build_index.py`.
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

Verified end-to-end: installed the full dependency stack, ran the FastAPI app
under uvicorn, and confirmed all 5 routing intents (payments, refunds,
reconciliation, fraud, general) return 200 with the correct agent, and
`evals/run_evals.py` passes 5/5.

## Extending for the submission

1. Deploy it (Render/Railway free tier works) so the link is live, not just a repo.
2. Add 3-5 real eval cases in `evals/cases.jsonl` and show pass/fail in the README —
   this is what "proof of work" evaluators actually look for over polish.
3. Record a 60-90s Loom showing a real query hitting a real Razorpay test payment.
