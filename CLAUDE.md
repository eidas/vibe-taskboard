# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start Next.js dev server (localhost:3000)
- `npm run build` — Production build
- `npm run lint` — Run ESLint (no args needed, uses flat config)
- No test framework is configured

## Architecture

This is a Japanese-language personal task management app (hierarchical taskboard with up to 5 nesting levels) built with Next.js 16 (App Router), React 19, Supabase, and Tailwind CSS 4.

### Data Flow

Server component (`app/page.tsx`) fetches all data via Supabase SSR client, then passes it as props to the client-side `TaskBoard`. All subsequent CRUD operations happen client-side through `@supabase/supabase-js` browser client. There is no API route layer — components talk directly to Supabase.

### Key Files

- **`components/TaskBoard.tsx`** — Central hub (~1400 lines). Owns all task state, handles drag-and-drop (via @dnd-kit), CRUD operations against Supabase, filtering, theme toggle, and keyboard navigation. Most feature work will touch this file.
- **`components/TaskRow.tsx`** — Renders a single task row with inline editing, checkbox, expand/collapse, and drag handle. Uses `React.memo`.
- **`lib/types.ts`** — Core TypeScript types (`Task`, `FlatTask`, `DueType`, `TimeUnit`, `TaskUpdate`).
- **`lib/task-utils.ts`** — Pure business logic: tree operations (building flat task lists, finding siblings), due date label formatting, recurring task reset logic, position calculations.
- **`lib/supabase/client.ts`** / **`server.ts`** — Browser and SSR Supabase client factories.

### Database (Supabase/PostgreSQL)

Three tables with Row-Level Security:
- **`tasks`** — Hierarchical tasks with `parent_id` self-reference, `level` (1-5), `position` for ordering, `due_type` enum, time tracking fields, and completion state.
- **`task_collapsed_states`** — Tracks which parent tasks are collapsed per user (UI state persistence).
- **`user_preferences`** — Theme setting (dark/light) per user.

Migrations live in `supabase/migrations/`. RLS policies restrict all access to `auth.uid()`. Triggers auto-update `updated_at` timestamps.

### Auth

Supabase Auth with email OTP (magic links). Flow: `/login` → email OTP → `/auth/callback` exchanges code for session → cookie-based session. No middleware file exists at project root; auth checks happen in server components via `supabase.auth.getUser()`.

### Styling

Tailwind CSS 4 with CSS custom properties for theming defined in `app/globals.css`. Dark/light themes use CSS variables (e.g., `--color-base`, `--color-surface`, `--color-text-primary`). The `data-theme` attribute on `<html>` switches themes.

### Environment Variables

Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

## Conventions

- UI text is in Japanese.
- Path alias: `@/*` maps to the project root.
- Components use `'use client'` directive for interactive features; `app/page.tsx` is a server component.
- Task ordering uses fractional positioning (midpoint between neighbors) to avoid reindexing.
