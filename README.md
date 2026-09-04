# BioFlow Studio

Agentic research workspace prototype for the Biomni reverse-engineering assignment.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The demo uses a deterministic server-side runner. No external API key is required.

## Security

API routes require the `bioflow_session` HttpOnly cookie issued by `/api/auth/login`. Third-party LLM keys belong only in server environment variables; never expose them to the browser.

## Scope

The main demo is a bulk RNA-seq workflow with RAG evidence events, streaming code output, deterministic failure/retry, artifact lineage, responsive layout, and a lightweight 3D structure preview fallback.
