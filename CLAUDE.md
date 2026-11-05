# Respondent Hub prototype

## Verifying changes

- **Do not verify in the browser preview after implementing.** No `preview_start`, screenshots, page reads or scripted clicks unless the user asks for them explicitly. It costs too many tokens.
- After code changes, run `npm run typecheck` and report the result. That is the default check.
- The user tests the result in the preview themselves.
- After changing `vite.config.ts`, restart the dev server (`preview_stop`, then `preview_start`): in this OneDrive folder Vite can miss the config change and keep serving with the old config.

## Prototype variants

- The dark bar at the top switches between variants. Each variant is its own page with a full, independent copy of the app; a change in one never reaches the others.
- `main` lives in `src/`; every other variant lives in `src/variants/<id>/`. Each one, `main` included, is served at `/variants/<id>/` (page: `variants/<id>/index.html`). The site root `/` has no app: it opens the first tab in `variants.ts`, so the tab order sets which variant the link opens.
- Shared by all variants, through aliases: the sample data (`@data` → `src/data`) and the variant bar and its tab list (`@prototype` → `src/prototype`, tabs in `variants.ts`).
- New variant: `node scripts/new-variant.mjs <id> "<Tab label>" [--from <variant id>]`. It copies the app, gives it its own localStorage keys and adds its page and tab. Then write the tab's description in `src/prototype/variants.ts`.
- When the user names a variant, change only that variant's folder unless they ask otherwise.
