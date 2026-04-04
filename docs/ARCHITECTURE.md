# Architecture Overview

## 1. System Purpose

MzansiBuilds is a community platform for sharing projects in public. Users can register, publish projects, post updates, comment, like, follow builders, and request collaboration while seeing activity in near real time.

## 2. High-Level Topology

```text
[ Browser / React SPA ]
          |
          |  REST (`/api/*`) + cookie auth
          |  WebSocket (`/ws`)
          v
[ FastAPI application ]
          |
          |  Motor / MongoDB client
          v
[ MongoDB Atlas ]
```

Local development can replace MongoDB Atlas with a persisted mock database in `memory/mock_db.json`.

## 3. Frontend Architecture

The frontend lives in `frontend/src/` and is organized by responsibility.

### Main pieces

- `App.js` defines public and protected routes.
- `contexts/AuthContext.js` manages session state through `GET /api/auth/me` and cookie-based login/logout flows.
- `contexts/WebSocketContext.js` manages the `/ws` connection, reconnect logic, and last broadcast message.
- `pages/` contains user-facing screens such as `Dashboard`, `ProjectDetail`, `CreateProject`, `EditProject`, `Profile`, and `CelebrationWall`.
- `components/` contains reusable UI like `Navbar`, `ProjectCard`, `CommentSection`, and `UpdateFeed`.
- `lib/api.js` normalizes `API_URL` and `WS_URL` from environment variables or the current browser host.

### Frontend behavior

- Axios is used for REST requests.
- Authenticated requests send cookies using `withCredentials: true`.
- The dashboard can switch between a feed view and a project grid.
- The project detail screen pulls project info, updates, comments, and collaboration requests in parallel.
- WebSocket broadcasts update the feed and detail views without a full refresh.

## 4. Backend Architecture

The backend entrypoint is `backend.server:app`, which imports the FastAPI app from `backend/app/main.py`.

```text
backend/app/
├── core/
│   ├── config.py      environment settings, CORS, cookie policy, Cloudinary config
│   └── database.py    MongoDB/mock DB setup, indexes, admin seeding, persistence
├── models/
│   └── schemas.py     strict Pydantic request models
├── routes/
│   ├── auth.py
│   ├── users.py
│   ├── projects.py
│   ├── collaborations.py
│   ├── community.py
│   └── system.py
├── services/
│   ├── auth.py        bcrypt hashing, JWT generation, current-user resolution
│   ├── email.py       notification email facade and logging
│   └── realtime.py    WebSocket presence and broadcast manager
└── utils/
    └── common.py      shared helpers such as timestamps and text cleanup
```

### Backend responsibilities

- `main.py` initializes the database, seeds the local admin user, mounts routers under `/api`, and exposes the `/ws` WebSocket endpoint.
- `config.py` centralizes environment-aware security decisions such as `SameSite`, secure cookies, and CORS rules.
- `database.py` creates indexes and supports a persisted mock database for development and tests.
- `schemas.py` uses `extra="forbid"` and field length constraints to tighten request validation.
- `realtime.py` tracks active sockets, online users, and broadcast events like new projects, comments, likes, and presence changes.

## 5. Data Layer

The application primarily works with these MongoDB collections:

| Collection | Purpose |
| --- | --- |
| `users` | Accounts, bios, profile links, skills, online state |
| `projects` | Project metadata, stage, owner, support needs |
| `updates` | Project progress posts |
| `comments` | Threaded discussion on projects |
| `collaboration_requests` | Requests to join or help with a project |
| `follows` | User-to-user following relationships |
| `likes` | Reactions to projects, updates, or comments |
| `login_attempts` | Basic login throttling and lockout tracking |
| `email_logs` | Mock notification history |

## 6. Core Runtime Flows

### Authentication flow

1. A user registers or logs in through `/api/auth/register` or `/api/auth/login`.
2. The backend issues an `access_token` and `refresh_token` as `httpOnly` cookies.
3. The frontend checks session state with `/api/auth/me` on startup.
4. Protected screens rely on `AuthContext` and redirect anonymous users to `/login`.

### Project interaction flow

1. A builder creates a project via `POST /api/projects`.
2. Other users can view the project, comment, like content, or send collaboration requests.
3. The owner can edit or delete the project and review incoming collaboration requests.
4. Community activity is surfaced through `/api/feed` and `/api/celebration-wall`.

### Realtime flow

1. The browser opens a WebSocket connection to `/ws`.
2. If an auth cookie is present, the socket is associated with the current user.
3. Backend events call `manager.broadcast(...)` to fan out updates such as `new_project`, `new_update`, `new_comment`, `new_like`, `user_online`, and `user_offline`.
4. The dashboard and detail pages update local state when new messages arrive.

## 7. Deployment Architecture

- **Frontend:** Vercel serves the React single-page application.
- **Backend:** Render runs `uvicorn backend.server:app`.
- **Database:** MongoDB Atlas is the expected production data store.
- **Routing:** `frontend/vercel.json` rewrites `/api/*` and `/ws` traffic to the Render backend.
- **Health checks:** Render uses `/api/health`.

## 8. Local Development and Testing

- `USE_MOCK_DB=true` allows the app to run without a live MongoDB instance.
- Mock data can persist across restarts in `memory/mock_db.json`.
- `tests/test_api_smoke.py` covers health, auth, login/logout, and basic project CRUD flows.

## 9. Practical Strengths and Gaps

### Strengths

- Clear separation between UI, API routes, shared services, and data bootstrap logic
- Reasonable local developer experience with mock persistence
- Realtime presence and feed broadcasts already integrated
- Validation and cookie security are centralized

### Gaps worth considering next

- Add role-based authorization rules beyond project ownership
- Replace mock email logging with a real provider when moving to production scale
- Add pagination for feed, comments, and project listing endpoints
- Add richer observability and structured audit logging
