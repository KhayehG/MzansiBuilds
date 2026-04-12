# Architecture Overview

## 1. Purpose

MzansiBuilds is a platform for developers to share what they’re building, track progress, and interact with others. It supports project updates, discussions, and collaboration, with some realtime features layered in.

---

## 2. High-Level Flow

```text
React (frontend)
      |
      | REST (/api) + cookies
      | WebSocket (/ws)
      v
FastAPI (backend)
      |
      v
MongoDB
```

For local development, MongoDB can be replaced with a persisted mock database (`memory/mock_db.json`).

---

## 3. Frontend

Located in `frontend/src/`.

### Key parts

* `App.js` handles routing
* `AuthContext` manages session state
* `WebSocketContext` handles realtime connection
* `pages/` contains main screens (dashboard, project, profile, etc.)
* `components/` contains reusable UI elements
* `lib/api.js` centralizes API and WebSocket URLs

### Behaviour

* Axios handles API requests
* Cookies are used for authentication
* WebSocket messages update UI without reload
* Feed and project views fetch data in parallel

---

## 4. Backend

Entry point: `backend.server:app`

```text
app/
  core/        config and database setup
  models/      request schemas
  routes/      API endpoints
  services/    business logic
  utils/       shared helpers
```

### Responsibilities

* `main.py` wires everything together and mounts routes
* `config.py` handles environment config and security settings
* `database.py` sets up MongoDB or mock DB
* `schemas.py` validates incoming requests
* `realtime.py` manages WebSocket connections and broadcasts

---

## 5. Data Model

Main collections:

* `users`
* `projects`
* `updates`
* `comments`
* `collaboration_requests`
* `follows`
* `likes`

---

## 6. Core Flows

### Authentication

* User logs in → receives JWT cookies
* Frontend checks session with `/api/auth/me`
* Protected routes rely on that session

---

### Project Flow

* User creates a project
* Others can view, comment, like, or request collaboration
* Activity appears in the feed

---

### Realtime

* Client connects to `/ws`
* Server tracks active users
* Events are broadcast to update UI (projects, comments, likes, presence)

---

## 7. Deployment

* Frontend: Vercel
* Backend: Render
* Database: MongoDB Atlas

---

## 8. Local Development

* `USE_MOCK_DB=true` allows running without MongoDB
* Mock data persists in `memory/mock_db.json`
* Tests cover basic API functionality

---

## 9. Notes

The structure is intentionally split between routes, services, and core setup to keep responsibilities clear. The goal was to keep things simple but still close to how a real-world app is organized.
