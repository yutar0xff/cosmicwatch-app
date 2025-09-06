# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React + TypeScript app. Key areas:
  - `src/common/` components, hooks, services, utilities.
  - `src/store/` Redux Toolkit slices, selectors, and typed hooks.
  - `src/shared/` shared types.
  - `src/lib/` device-related sketches (e.g., `OLED_*.ino`).
- `src-tauri/`: Tauri (Rust) desktop wrapper (`main.rs`, `tauri.conf.json`).
- `public/`: static assets; `dist/`: production build output.
- `data/`: runtime measurement data (created on demand).
- Docs: `README.md`, `ARCHITECTURE.md`, `DEPLOY.md`.

## Build, Test, and Development Commands
- `pnpm dev`: Start Vite dev server for the web app.
- `pnpm preview`: Serve the built app locally.
- `pnpm build`: Type-check and build production assets to `dist/`.
- `pnpm lint`: Run ESLint over the repo.
- `pnpm tauri:dev`: Run desktop app (Vite + Tauri).
- `pnpm tauri:build`: Build desktop binaries (requires Rust toolchain).

## Coding Style & Naming Conventions
- Language: TypeScript (strict mode). Indentation: 2 spaces.
- Components: PascalCase files (e.g., `TimeHistogram.tsx`). Hooks: `useX` camelCase.
- Redux: Slices in `src/store/slices/*Slice.ts`; selectors in `src/store/selectors/`.
- Prefer function components + hooks; avoid class components.
- Linting: ESLint (`eslint.config.js`) with React Hooks rules. Run `pnpm lint` before PRs.

## Testing Guidelines
- Current: No formal test suite checked in. Prefer Vitest + React Testing Library.
- Suggested naming: colocate `*.test.ts(x)` next to source or under `__tests__/`.
- Add minimal tests for reducers, selectors, and critical components.

## Commit & Pull Request Guidelines
- Commits: Prefer Conventional Commits (e.g., `feat:`, `fix:`, `docs:`). Keep messages imperative and scoped.
- PRs: Include purpose, summary of changes, screenshots for UI tweaks, and any linked issues.
- Scope PRs narrowly; ensure `pnpm build` and `pnpm lint` pass.

## Security & Configuration Tips
- Web Serial/Tauri FS usage: validate inputs and handle permission errors gracefully.
- Desktop: Review `src-tauri/tauri.conf.json` capability changes in PRs.
- Data: `data/` may contain user measurements—avoid committing it.
