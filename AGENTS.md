# Repository Guidelines

## Project Structure & Module Organization
- Primary app code lives in `cosmicwatch-app/`; avoid editing root-level `assets/` or `index.html`.
- Core logic sits in `cosmicwatch-app/src/` with `common/` for shared utilities and components, `store/` for Redux Toolkit slices and selectors, and `shared/` for TypeScript types.
- Device firmware sketches reside under `cosmicwatch-app/src/lib/` and should remain Arduino-compatible.
- Static assets go in `cosmicwatch-app/public/`; build artifacts output to `cosmicwatch-app/dist/`.
- Runtime measurement data is created in `cosmicwatch-app/data/` and should never be committed.

## Build, Test, and Development Commands
- `pnpm install`: Install JavaScript dependencies; run after cloning or when `package.json` changes.
- `pnpm dev`: Launch the Vite dev server for rapid web app iteration.
- `pnpm build`: Type-check and produce a production build in `dist/` using the deployed base path.
- `pnpm build:local`: Create a local build with `/` base for quick smoke testing.
- `pnpm preview`: Serve the latest build from `dist/` for manual verification.
- `pnpm tauri:dev` and `pnpm tauri:build`: Develop or package the Tauri desktop app (requires Rust toolchain).
- `pnpm lint`: Run ESLint; ensure a clean pass before opening a PR.

## Coding Style & Naming Conventions
- TypeScript throughout, strict mode enabled; use 2-space indentation and trailing commas where ESLint enforces them.
- Prefer React function components and hooks; name components in PascalCase (e.g., `TimeHistogram.tsx`) and hooks in camelCase (`useSerialConnection`).
- Export named symbols by default; place shared logic in `common/` utilities for reuse.

## Testing Guidelines
- Vitest and React Testing Library are the preferred stack; colocate tests as `*.test.ts` or `*.test.tsx` beside the source file or under `__tests__/`.
- Until automated coverage exists, document manual verification steps (e.g., `pnpm preview`) in PR descriptions.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`, etc.) with imperative, scoped messages.
- Keep diffs focused; update documentation when behavior changes.
- PRs should explain purpose, summarize changes, link relevant issues, and include UI screenshots when visuals shift.

## Security & Configuration Tips
- Web Serial/File APIs and Tauri FS requests must handle permission denials gracefully; surface errors to the UI.
- Avoid editing `src-tauri/tauri.conf.json` capabilities without review.
- Never commit generated data from `cosmicwatch-app/data/` or secrets in configuration files.
