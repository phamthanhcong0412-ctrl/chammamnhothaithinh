# CLAUDE.md - Cháo Mầm Nhỏ Thái Thịnh Project Guidelines

Standing project context and operational instructions for Claude Code and AI assistants.

---

## 1. Project Overview & Architecture

Internal F&B timekeeping and payroll management system for **Cháo Mầm Nhỏ Thái Thịnh** (Hà Nội).

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS v4, Lucide Icons, Canvas Confetti.
- **Backend / Dev Host**: Node.js, Express, TSX (`server.ts`).
- **Database & Sync**: Supabase (PostgreSQL 15+, Row Level Security, WebSockets Realtime).
- **Architecture Pattern**: Clean Architecture & SOLID principles.
  - `src/domain/`: Pure business logic (salary math, shift timing, wifi/gps validation, multi-turn merging). Zero dependencies on React/Express.
  - `src/services/`: Application use-cases and coordinators (`api.ts` facade).
  - `src/infrastructure/`: Repository implementations (Supabase & Local Storage).
  - `src/components/`: Modular React components.
  - `src/context/`: Global application state (`AppContext.tsx`).
  - `server/`: Express controllers (OS network scanning, QR token generation, scheduled reports).

---

## 2. Essential Commands

```bash
# Development (starts combined Express backend + Vite SPA)
npm run dev

# Static type analysis (MUST PASS WITH ZERO ERRORS)
npm run lint           # alias for: npx tsc --noEmit

# Production Build
npm run build

# Database Migration
npm run migrate:supabase
```

---

## 3. Strict Coding Conventions

### Language & Clean Code
- **Language**: English for code, functions, types, comments, and commit messages. Vietnamese for user-facing UI labels and chat responses.
- **TypeScript**: Strict typing required. Avoid loose `any`. Define domain interfaces in `src/types/index.ts`.
- **Pure Domain Functions**: Any business rule calculation (salary, hours, late detection, shift windows) MUST reside in `src/domain/` as testable pure functions.

### Database & Supabase Performance (Critical)
- **In-Memory Cache (SWR)**: `src/supabase.ts` implements short-lived in-memory caching for config (30s), users (20s), and attendance (15s). Invalidate cache on mutations.
- **Batch Operations**: NEVER execute sequential `for...await` loops against Supabase. Always use:
  - `batchSaveAttendanceToSupabase(records)` for bulk upserts.
  - `batchDeleteAttendanceFromSupabase(ids)` for bulk deletions.
- **Query Limiting**: Always bound broad historical queries (e.g. `.limit(300)`).
- **Debounced Realtime**: Realtime WebSocket change listeners MUST use debouncing (min 250ms) to prevent event flooding.

### UI / UX & Design Standards (The Anti-Slop Protocol)
- **Palette**: Warm Graphite `#141416`, Card `bg-zinc-900/90`, Border `border-zinc-800`.
  - Primary Accent: Emerald (`#10b981`) - fresh, clean, safe.
  - Secondary Accent: Amber (`#f59e0b`) - broth, afternoon shifts, financial totals.
  - Alert Accent: Rose (`#f43f5e`) - errors, warnings, deletions.
  - **PURPLE BAN**: Never use indigo, purple, or blue-to-purple gradients.
- **Typography & Font**: Font `Be Vietnam Pro` (`font-sans`).
- **Icons**: 100% Lucide SVG vector icons (`lucide-react`). Never use operating system emojis or unicode symbols (`✓`, `✔`, `🏢`, `⚡`) in the UI.
- **Mobile-First Ergonomics**:
  - **No Safari Auto-Zoom**: All `<input>` and `<select>` elements MUST have `text-base` ($\ge 16$px) on mobile with `sm:text-xs` or `sm:text-sm` on desktop.
  - **Card-Based Mobile Lists**: Data tables with $\ge 4$ columns MUST render responsive cards on mobile (`< 640px`) and flat tables on desktop (`>= 640px`).
  - **Bottom-Sheet Modals**: Modals must transition to bottom sheets on mobile with top drag handle and `pb-safe` / `pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]`.
  - **Tactile Feedback**: Action buttons must have `active:scale-95` or `active:scale-[0.98]` with `touch-action: manipulation`.

---

## 4. Git & Workflow Guardrails

1. **NEVER Autonomous Git Commit/Push**:
   - The AI must NEVER execute `git commit` or `git push` without explicit user instruction.
   - Present completed changes and diff summaries, then propose a Conventional Commit message.
2. **Pre-Completion Verification**:
   - Always run `npx tsc --noEmit` before declaring a task complete.
   - Ensure `npm run build` succeeds cleanly.
