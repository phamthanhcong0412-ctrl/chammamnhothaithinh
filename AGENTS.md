# AGENTS.md - Repository Guidelines for AI Coding Agents

> Standardized context and operational instructions for autonomous AI agents (Google DeepMind Antigravity, Cursor, Roo, Cline, Aider, Windsurf).

---

## 1. System Overview & Architecture Map

F&B Timekeeping, Attendance, and Payroll System for **Cháo Mầm Nhỏ Thái Thịnh**. Clean Architecture with strict separation of concerns:

| Directory | Layer / Responsibility | Rule |
| :--- | :--- | :--- |
| `src/domain/` | Domain Pure Functions | Business rules only. No React, no DOM, no fetch. Pure math & logic. |
| `src/services/` | Application Services | Use-cases coordinating domain models and repositories. Exposed via `api.ts`. |
| `src/infrastructure/` | Repositories | Supabase and Local Storage data adapters matching contracts. |
| `src/components/` | Presentation UI | React 19 view components, modals, and tables. Mobile-first ergonomic design. |
| `src/context/` | State Management | `AppContext.tsx` global store, auth listeners, and realtime dispatchers. |
| `server/` | Node/Express Backend | OS hardware WiFi scanning, QR token generation, and scheduled 21:00 cron. |
| `data/` | Local JSON Storage | Local offline store fallback (`store_config.json`, `users.json`, etc.). |
| `supabase/` | Database Schemas | PostgreSQL DDL, RLS policies, Realtime publications (`schema.sql`). |

---

## 2. Essential Commands & Toolchain

Agents must always verify their work using these commands:

```bash
# Start development server
npm run dev

# Static type verification (MANDATORY: 0 errors required)
npm run lint           # Runs: tsc --noEmit

# Production bundle compilation
npm run build

# Push database schema / seed data to Supabase Cloud
npm run migrate:supabase
```

---

## 3. P0 Invariants & Behavioral Guardrails

All agents operating in this repository MUST strictly follow these rules:

### Rule 1: Git Commit & Push Governance (Zero Autonomous Commit)
- **NEVER** run `git commit` or `git push` autonomously.
- Present changes to the user, display `git diff --stat` or `git status`, propose a Conventional Commit message, and WAIT for user confirmation.

### Rule 2: Anti-Slop UI & Color Consistency Lock
- **Forbidden Colors**: Do NOT introduce `indigo-*`, `purple-*`, or purple-to-blue gradients.
- **Allowed Colors**:
  - Background: Warm Graphite `#141416`
  - Cards: `bg-zinc-900/90` with `border-zinc-800`
  - Primary Accent: Emerald (`#10b981`)
  - Secondary Accent: Amber (`#f59e0b`)
  - Error/Destructive: Rose (`#f43f5e`)
- **No System Emojis**: Always use `lucide-react` SVG vector icons. Do not use emoji characters (`⚡`, `✓`, `🏢`, etc.) in the user interface.

### Rule 3: Mobile-First Ergonomics
- **Anti-Zoom on WebKit/Safari**: Every `<input>` and `<select>` must have minimum font size `text-base` ($\ge 16$px) on mobile viewports (`text-base sm:text-xs` or `text-base sm:text-sm`).
- **Responsive Tables**: Tables with multiple columns must render as Card-Based lists on mobile screens (`< 640px`) and desktop tables on large screens (`>= 640px`).
- **Bottom-Sheet Modals**: Modals on mobile must dock to bottom with a top drag indicator and `pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]`.
- **Button Feedback**: Interactive buttons must have tactile scaling (`active:scale-95` or `active:scale-[0.98]`).

### Rule 4: Database & Latency Management
- **In-Memory Cache (SWR)**: `src/supabase.ts` caches config (30s), users (20s), and attendance (15s). Invalidate cache immediately on write operations.
- **Batch Processing**: NEVER use sequential `for...await` loops against Supabase. Always use `batchSaveAttendanceToSupabase` or `batchDeleteAttendanceFromSupabase`.
- **Debounced Realtime**: Realtime change subscribers must debounce callbacks ($\ge 250$ms) to prevent UI freezing during bulk updates.

---

## 4. Agent Personas & Request Routing

| Domain | Recommended Specialist | Trigger Focus |
| :--- | :--- | :--- |
| **UI / Components** | `@frontend-specialist` | Styling, layouts, modals, mobile ergonomics, Tailwind CSS v4. |
| **Business Logic** | `@domain-expert` | Shift math, salary calculations, multi-turn attendance merging. |
| **Database & API** | `@backend-specialist` | Supabase schemas, RLS, Express routes, caching, batching. |
| **Documentation** | `@tech-writer` | README, API guides, markdown docs, changelogs. |

---

## 5. Verification Checklist Before Completion

Before presenting completed work to the user:
1. [ ] **TypeScript Check**: `npx tsc --noEmit` exits with code 0 (zero errors).
2. [ ] **Build Check**: `npm run build` succeeds without bundle errors.
3. [ ] **Cleanliness Audit**: No remaining `indigo-*` or `purple-*` classes; no unescaped emojis.
4. [ ] **Mobile Ergonomics**: All form inputs have $\ge 16$px font on mobile.
5. [ ] **Git Inspection**: Review output of `git diff --stat` and propose a clear commit message.
