# Estate Coordinator MVP Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the failed repetitive interview with the approved grouped ten-screen intake while preserving Estate Blueprint recommendation, freeze, web preview, and PDF generation behavior.

**Architecture:** Store grouped factual answers in one canonical matter record with explicit answer statuses and derive the legacy Blueprint inputs from that state. Persist factual screens directly through idempotent server operations without OpenAI; use OpenAI only for recommendations and genuine narrative corrections. Present all materially applicable recommendations on one decision surface and keep the existing immutable final-review-to-generation contracts.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod 4, Supabase Postgres/RPC, OpenAI Responses API, Vitest, Playwright.

**Spec:** `Estate Coordinator (EC)/05_TESTING/01_Current/MVP_RESCUE_AUDIT_20260824.md` and `Estate Coordinator (EC)/05_TESTING/01_Current/PRINCIPAL_MVP_ACCEPTANCE_TEST_20260824.md`

## Global Constraints

- Base all work on `c630eef1a75ea3edbda7103ce11bf57a05510fd3` in `agent-mvp-rescue`.
- Preserve Blueprint final review, immutable generation snapshot, web preview, and PDF output behavior.
- Do not merge, deploy, or apply migrations.
- Keep the normal journey at approximately ten visible states with no exact or semantic duplicate questions.
- Factual screens must save without an OpenAI call and without requiring a retry.
- Omitted patch fields must preserve prior canonical answers; explicit `unknown`, `not_decided`, and `not_applicable` remain answered statuses.
- Do not expose accumulated interview transcript or a persistent interview sidebar.

---

### Task 1: Canonical grouped intake domain

**Files:**
- Create: `src/lib/domain/intake.ts`
- Create: `src/lib/domain/intake.test.ts`
- Modify: `src/lib/domain/matter-opening.ts`
- Modify: `src/lib/domain/workflow.ts`
- Modify: `src/lib/domain/progress.ts`

**Interfaces:**
- Produces: `CanonicalIntakeState`, `IntakeSection`, `StructuredIntakeSubmission`, `createCanonicalIntakeState()`, `applyStructuredIntake()`, and `intakeSectionForRecord()`.
- Preserves: `MatterOpeningRecord` as the source supplied to `createInitialBlueprintState()`.

- [ ] **Step 1: Write failing domain tests**

  Cover the four grouped sections (`goals_family`, `planning_context`, `team_continuity`, `financial_range`), explicit field statuses, prior-answer preservation, zero duplicate section progression, and conversion into existing Matter Opening/Blueprint fields.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run: `npx vitest run src/lib/domain/intake.test.ts`

  Expected: FAIL because the canonical intake API does not exist.

- [ ] **Step 3: Implement the minimal canonical intake model**

  Add stable field metadata (`status`, `source`, `confirmed`, `confidence`, `lastUpdatedAt`, `revision`, `decisionSupport`) and deterministic grouped-section transitions. Derive legacy Matter Opening fields and a complete planning-baseline seed without clearing unrelated values.

- [ ] **Step 4: Run focused and existing workflow tests**

  Run: `npx vitest run src/lib/domain/intake.test.ts src/lib/domain/workflow.test.ts`

  Expected: PASS.

### Task 2: Null-safe Blueprint state and canonical seeding

**Files:**
- Modify: `src/lib/domain/blueprint.ts`
- Modify: `src/lib/domain/blueprint.test.ts`
- Modify: `src/lib/server/interpreter.test.ts`

**Interfaces:**
- Produces: null-safe `mergeAnsweredPatch()` semantics and canonical seeding in `createInitialBlueprintState()`.
- Consumes: `MatterOpeningRecord.canonical_intake`.

- [ ] **Step 1: Write failing regression tests**

  Prove that a patch containing null for omitted structured-output keys cannot erase an already answered planning-range value, and that all seven financial fields remain populated when Blueprint state starts.

- [ ] **Step 2: Run and verify RED**

  Run: `npx vitest run src/lib/domain/blueprint.test.ts src/lib/server/interpreter.test.ts`

  Expected: FAIL on null clobbering/canonical seeding.

- [ ] **Step 3: Implement minimal null-safe merge and seed logic**

  Treat null in a partial provider patch as omitted for existing answered values. Preserve explicit answer status in canonical intake and keep compatibility with old persisted state.

- [ ] **Step 4: Run focused tests**

  Run: `npx vitest run src/lib/domain/blueprint.test.ts src/lib/server/interpreter.test.ts`

  Expected: PASS.

### Task 3: Direct idempotent factual persistence

**Files:**
- Create: `src/app/api/matters/[id]/intake/route.ts`
- Modify: `src/app/api/matters/route.ts`
- Modify: `src/lib/server/data.ts`
- Create: `src/lib/server/intake-data.test.ts`
- Create: `supabase/migrations/20260824200000_mvp_rescue_structured_intake.sql`
- Modify: `supabase/tests/persistence_rpc.sql`
- Modify: `supabase/tests/rls_isolation.sql`

**Interfaces:**
- Produces: `submitStructuredIntake({ userId, matterId, operationId, section, values })` returning an authoritative `MatterView` and commit receipt.
- Preserves: existing ownership checks, RLS, `confirm_matter_opening`, and Blueprint persistence RPCs.

- [ ] **Step 1: Write failing server tests**

  Prove one operation ID is idempotent, the first call returns success, direct factual saves never invoke the interpreter, and the returned matter reflects the committed revision without a transcript reload.

- [ ] **Step 2: Run and verify RED**

  Run: `npx vitest run src/lib/server/intake-data.test.ts`

  Expected: FAIL because the structured operation is absent.

- [ ] **Step 3: Implement atomic persistence**

  Add one service-role-only RPC that locks the owned matter, accepts the expected revision and operation ID, persists record/workflow state, records an audit receipt, and returns the committed revision. Do not add client-visible table access.

- [ ] **Step 4: Remove normal-view transcript loading**

  Keep message history as an audit record but stop selecting it in normal `getMatter()` responses. Return typed operation/correlation information for expected save failures.

- [ ] **Step 5: Run focused server tests**

  Run: `npx vitest run src/lib/server/intake-data.test.ts src/lib/server/blueprint-idempotency.test.ts`

  Expected: PASS.

### Task 4: Synthesized Planning Summary

**Files:**
- Modify: `src/lib/domain/planning-summary.ts`
- Modify: `src/components/opening-summary.tsx`
- Modify: `src/lib/domain/workflow.test.ts`

**Interfaces:**
- Produces: one projection with ranked goals, beneficiary intent, current plan/context, financial range and governing constraints, team/continuity, and material uncertainties.

- [ ] **Step 1: Write failing synthesis tests**

  Assert each material canonical fact appears in exactly one summary section and contradictory contacts/participants output is impossible.

- [ ] **Step 2: Run and verify RED**

  Run: `npx vitest run src/lib/domain/workflow.test.ts`

  Expected: FAIL on duplicate/repetitive summary behavior.

- [ ] **Step 3: Implement the shortest-complete projection and component**

  Remove separate desired-outcomes, top-priorities, priority-context, success-definition, and duplicate helper sections. Keep corrections local and confirmation direct.

- [ ] **Step 4: Run focused tests**

  Run: `npx vitest run src/lib/domain/workflow.test.ts`

  Expected: PASS.

### Task 5: Consolidated Blueprint decisions

**Files:**
- Modify: `src/lib/domain/blueprint.ts`
- Modify: `src/lib/server/data.ts`
- Create: `src/app/api/matters/[id]/blueprint/decisions/route.ts`
- Modify: `src/lib/domain/blueprint-finalization.test.ts`
- Modify: `src/lib/server/blueprint-finalization-data.test.ts`

**Interfaces:**
- Produces: `recommendations` interaction containing every materially applicable unresolved recommendation, and one structured batch decision submission.
- Preserves: `DecisionRecord`, `buildFinalReviewProfile()`, `freezeBlueprintGeneration()`, `buildBlueprintDocument()`, and PDF generation.

- [ ] **Step 1: Write failing recommendation tests**

  Prove applicability is deduplicated, all normal-case cards appear together, and one batch disposition advances to Final Review with the same decision records expected by Blueprint generation.

- [ ] **Step 2: Run and verify RED**

  Run: `npx vitest run src/lib/domain/blueprint-finalization.test.ts src/lib/server/blueprint-finalization-data.test.ts`

  Expected: FAIL because only one recommendation can be active.

- [ ] **Step 3: Implement consolidated generation and direct dispositions**

  Generate applicable recommendations from one fixed state, persist them, accept structured `accept`, `modify`, `alternative_requested`, or `defer` values, and construct the existing decision records without reinterpreting unambiguous controls.

- [ ] **Step 4: Run focused tests**

  Run: `npx vitest run src/lib/domain/blueprint-finalization.test.ts src/lib/server/blueprint-finalization-data.test.ts`

  Expected: PASS.

### Task 6: Ten-screen client journey and Page 1-27 UX corrections

**Files:**
- Modify: `src/components/login-experience.tsx`
- Modify: `src/components/home-experience.tsx`
- Replace: `src/components/matter-experience.tsx`
- Create: `src/components/intake-sections.tsx`
- Modify: `src/app/globals.css`
- Create: `tests/e2e/mvp-rescue.spec.ts`
- Modify: existing E2E specifications whose old interview assertions are superseded.

**Interfaces:**
- Consumes: grouped intake and consolidated decision route contracts.
- Preserves: evidence, final review correction, finalization, Blueprint preview, and PDF download controls.

- [ ] **Step 1: Write the failing Playwright rescue journey**

  Count the ten expected visible states, submit each grouped screen once, assert progress is always visible, assert no complementary interview sidebar/transcript exists, assert the Planning Summary fact uniqueness, and complete Blueprint generation.

- [ ] **Step 2: Run and verify RED**

  Run: `npx playwright test tests/e2e/mvp-rescue.spec.ts --project=chromium`

  Expected: FAIL on the old interview surfaces.

- [ ] **Step 3: Implement grouped controls and copy**

  Merge acknowledgment/orientation/start; implement priorities/people, planning context, team/continuity, and financial-range forms; keep text only for material explanation; keep local form state until an authoritative save receipt arrives.

- [ ] **Step 4: Implement persistent progress and active-surface layout**

  Use a sticky progress region with `n of 7`, one primary action, larger active-prompt hierarchy, no persistent sidebar, and no transcript. Put sign-in success text immediately above the email field and use the principal-approved human opening direction.

- [ ] **Step 5: Run desktop and mobile rescue tests**

  Run: `npx playwright test tests/e2e/mvp-rescue.spec.ts`

  Expected: PASS on Desktop Chrome and Pixel 7.

### Task 7: Full exact-HEAD verification

**Files:**
- Verify all changed files and no unrelated scope.

- [ ] **Step 1: Run lint**

  Run: `npm run lint`

- [ ] **Step 2: Run typecheck**

  Run: `npm run typecheck`

- [ ] **Step 3: Run all unit tests**

  Run: `npm test`

- [ ] **Step 4: Run production build**

  Run: `npm run build`

- [ ] **Step 5: Run full Playwright**

  Run: `npm run test:e2e`

- [ ] **Step 6: Verify Git scope and commit exact rescue HEAD**

  Run: `git diff --check`, inspect `git status --short`, inspect `git diff --stat`, commit only rescue files, and rerun `git status --short --branch` plus `git rev-parse HEAD`.
