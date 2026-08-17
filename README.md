# Estate Coordinator Student Web

Slice 1 is the controlled-access student web vertical slice for Matter Opening. It implements passwordless access, beta acknowledgement, an authenticated matter home, the canon-defined Matter Opening conversation, confirmation/correction, persistence, and resume. It intentionally stops before Estate Blueprint discovery.

## Architecture

- Next.js App Router and TypeScript
- Supabase Auth, Postgres, and row-level security
- OpenAI Responses API with strict structured output for narrative interpretation
- Deterministic application workflow state and server-side validation

The workflow code is derived from `EC_Matter_Opening_Conversational_Workflow.md@0.1` and the approved `EC_Student_Web_MVP_Brief.md@0.1`. Those canonical documents remain outside this repository and are not modified here.

## Local setup

1. Copy `.env.example` to `.env.local` and provide the Supabase project URL, publishable key, server secret key, and OpenAI API key.
2. Apply `supabase/migrations/20260817190000_slice_1.sql` to a development Supabase project.
3. Invite approved synthetic test users through Supabase Auth. Public self-sign-up is disabled by the application request.
4. Run `npm run dev`.

`EC_SYNTHETIC_TEST_MODE=true` enables the isolated browser-test harness. Never enable it in a deployment. The harness holds synthetic records only and is not a substitute for Supabase persistence or RLS.

## Verification

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Run `supabase/tests/rls_isolation.sql` against the migrated development database to prove that one authenticated user cannot read or mutate another user's matter.

## Scope boundary

This repository does not implement Blueprint stages, document or evidence ingestion, existing-plan review, later estate lifecycle stages, an admin portal, vector search, or multi-agent orchestration. All included examples and automated tests use synthetic data.
