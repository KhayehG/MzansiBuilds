# MzansiBuilds — Commit Plan

> Generated: 2026-04-12  
> Branch: **main** (pre-commit state)  
> Convention: [Conventional Commits](https://www.conventionalcommits.org/) — `<type>(<scope>): <subject>`

---

## Commit 1 — `chore: initialize project scaffolding and tooling`

**Purpose:** Establishes the monorepo skeleton, environment pinning, deployment configs, and CI pipeline before any feature code lands.

| File | Reason |
|------|--------|
| `pytest.ini` | Test runner config — marks, asyncio mode, test paths |
| `runtime.txt` | Pins Python version for Render |
| `render.yaml` | Render deployment service definition |
| `memory/.gitkeep` | Keeps empty `memory/` directory tracked |
| `frontend/.gitignore` | Frontend-scoped git ignore rules |
| `frontend/.npmrc` | npm engine/registry options |
| `frontend/components.json` | shadcn/ui CLI config (alias paths, base colour) |
| `frontend/postcss.config.js` | PostCSS + Tailwind pipeline config |
| `frontend/vercel.json` | Vercel SPA routing rewrite rules |
| `.github/workflows/ci.yml` | GitHub Actions CI — lint, test, build on PR |

```
git add pytest.ini runtime.txt render.yaml memory/.gitkeep \
        frontend/.gitignore frontend/.npmrc frontend/components.json \
        frontend/postcss.config.js frontend/vercel.json \
        .github/workflows/ci.yml
git commit -m "chore: initialize project scaffolding and tooling"
```

---

## Commit 2 — `feat(backend): add package init files, system health, and users routes`

**Purpose:** Completes the Python package structure and introduces the system health endpoint plus the full users route (public profiles, user directory search, follow/unfollow).

| File | Reason |
|------|--------|
| `backend/__init__.py` | Top-level package marker |
| `backend/app/models/__init__.py` | Models sub-package marker |
| `backend/app/routes/__init__.py` | Routes sub-package marker |
| `backend/app/services/__init__.py` | Services sub-package marker |
| `backend/app/routes/system.py` | `GET /api/health` liveness probe |
| `backend/app/routes/users.py` | Public profiles, user search, follow/unfollow, privacy enforcement (no email leak) |

```
git add backend/__init__.py backend/app/models/__init__.py \
        backend/app/routes/__init__.py backend/app/services/__init__.py \
        backend/app/routes/system.py backend/app/routes/users.py
git commit -m "feat(backend): add package init files, system health, and users routes"
```

---

## Commit 3 — `fix(backend): tighten database seeding and extend project routes`

**Purpose:** Hardens the database layer (seeding guard, admin user bootstrap) and adds search, collaboration-state fields, and Cloudinary signature support to the projects route.

| File | Changes |
|------|---------|
| `backend/app/core/database.py` | Admin seed guard, mock-db persistence, index creation |
| `backend/app/routes/projects.py` | `q` query-string search; `has_requested_collab` + `collaboration_status` on project detail; Cloudinary signature endpoint wired |

```
git add backend/app/core/database.py backend/app/routes/projects.py
git commit -m "fix(backend): tighten database seeding and extend project routes"
```

---

## Commit 4 — `feat(frontend): add shadcn/ui component library`

**Purpose:** Installs the full set of accessible, composable shadcn/ui primitives that all pages consume.

| Path | Components |
|------|-----------|
| `frontend/src/components/ui/` | `accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `carousel`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input`, `input-otp`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toaster`, `toggle`, `toggle-group`, `tooltip` |

```
git add frontend/src/components/ui/
git commit -m "feat(frontend): add shadcn/ui component library"
```

---

## Commit 5 — `feat(frontend): add core utilities, websocket context, hooks, and health plugin`

**Purpose:** Wires up the API client, shared utilities, live WebSocket context, toast hook, and webpack health-check plugin.

| File | Reason |
|------|--------|
| `frontend/src/lib/api.js` | Centralised Axios API client with cookie-based auth and interceptors |
| `frontend/src/lib/utils.js` | `cn()` Tailwind class merger utility (clsx + tailwind-merge) |
| `frontend/src/contexts/WebSocketContext.js` | Global WebSocket provider (reconnect, event bus) |
| `frontend/src/hooks/use-toast.js` | Toast state reducer hook consumed by `<Toaster />` |
| `frontend/src/components/UpdateFeed.js` | Realtime project-update feed card list |
| `frontend/public/index.html` | CRA HTML template with SEO meta tags |
| `frontend/jsconfig.json` | Path aliases (`@/`) for JS IDE resolution |
| `frontend/plugins/health-check/health-endpoints.js` | In-browser health endpoint definitions |
| `frontend/plugins/health-check/webpack-health-plugin.js` | Webpack plugin that injects health endpoints into dev server |

```
git add frontend/src/lib/ frontend/src/contexts/WebSocketContext.js \
        frontend/src/hooks/use-toast.js \
        frontend/src/components/UpdateFeed.js \
        frontend/public/index.html frontend/jsconfig.json \
        frontend/plugins/
git commit -m "feat(frontend): add core utilities, websocket context, hooks, and health plugin"
```

---

## Commit 6 — `feat(frontend): implement search, collaboration state, profile image upload, and comment sync`

**Purpose:** Delivers the four highest-priority product features: project/user search on Dashboard, correct collaboration state on ProjectDetail, Cloudinary avatar upload on Profile, and stable realtime comment nesting in CommentSection.

| File | Changes |
|------|---------|
| `frontend/src/pages/Dashboard.js` | Debounced project + builder search UI with result cards |
| `frontend/src/pages/ProjectDetail.js` | Shows pending/accepted/rejected collab state; fixes nested reply insertion from WebSocket `new_comment` events |
| `frontend/src/pages/Profile.js` | Cloudinary signed upload on avatar change; falls back to local preview when Cloudinary is not configured |
| `frontend/src/components/CommentSection.js` | Syncs local state with updated `comments` prop to prevent UI drift on realtime updates |

```
git add frontend/src/pages/Dashboard.js frontend/src/pages/ProjectDetail.js \
        frontend/src/pages/Profile.js \
        frontend/src/components/CommentSection.js
git commit -m "feat(frontend): implement search, collaboration state, profile image upload, and comment sync"
```

---

## Commit 7 — `docs: update API summary and architecture; add deployment guide`

**Purpose:** Keeps documentation in sync with the new routes (users, system, Cloudinary), revised architecture, and step-by-step deployment instructions for Render + Vercel.

| File | Reason |
|------|--------|
| `docs/API_SUMMARY.md` | Updated with users search, system health, Cloudinary signature endpoints |
| `docs/ARCHITECTURE.md` | Revised diagram and description reflecting realtime, plugin, and DB layers |
| `docs/DEPLOYMENT.md` | New file: Render (backend) + Vercel (frontend) deploy walkthrough with env-var table |

```
git add docs/API_SUMMARY.md docs/ARCHITECTURE.md docs/DEPLOYMENT.md
git commit -m "docs: update API summary and architecture; add deployment guide"
```

---

## Commit 8 — `test: add smoke tests and regression coverage for privacy and collaboration state`

**Purpose:** Adds a full pytest suite: smoke tests covering every live endpoint and regression tests for the two highest-priority bug fixes (email privacy, collaboration status visibility).

| File | Reason |
|------|--------|
| `tests/__init__.py` | Test package marker |
| `tests/conftest.py` | `pytest` fixtures — app client, seeded test DB, auth tokens |
| `tests/test_api_smoke.py` | Smoke tests: auth, projects CRUD, updates, comments, follows, system health |
| `tests/test_remaining_work.py` | Regression: public profile never leaks email; `has_requested_collab` + `collaboration_status` correct for each requester state |

```
git add tests/
git commit -m "test: add smoke tests and regression coverage for privacy and collaboration state"
```

---

## Summary

| # | Commit | Files |
|---|--------|-------|
| 1 | `chore: initialize project scaffolding and tooling` | 10 |
| 2 | `feat(backend): add package init files, system health, and users routes` | 6 |
| 3 | `fix(backend): tighten database seeding and extend project routes` | 2 |
| 4 | `feat(frontend): add shadcn/ui component library` | 44 |
| 5 | `feat(frontend): add core utilities, websocket context, hooks, and health plugin` | 9 |
| 6 | `feat(frontend): implement search, collaboration state, profile image upload, and comment sync` | 4 |
| 7 | `docs: update API summary and architecture; add deployment guide` | 3 |
| 8 | `test: add smoke tests and regression coverage for privacy and collaboration state` | 4 |
| | **Total** | **82** |

> **Files not committed:** `memory/mock_db.json` (gitignored — generated runtime data, never commit)
