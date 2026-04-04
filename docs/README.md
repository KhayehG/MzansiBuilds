# MzansiBuilds

MzansiBuilds is a full-stack platform designed for developers who want to build in public. It provides a space to share projects, track progress, and connect with other developers.

The goal is to make development more visible and collaborative by turning projects into ongoing, interactive experiences rather than isolated work.

---

## Overview

The platform focuses on making development visible and collaborative by allowing developers to share progress, get feedback, and build alongside others. Users can create projects, post updates, interact with other developers, and follow work they find interesting.

---

## Core Features

* User authentication (register, login, logout, token refresh)
* Project creation, editing, deletion, and stage tracking
* Progress updates with comments
* Likes, follows, and collaboration requests
* Global and following-based feeds
* Celebration wall for completed projects
* Realtime activity and presence using WebSockets

---

## Architecture

```text
React (frontend) ---> FastAPI (backend) ---> MongoDB
        |                    |
        |---- HTTP API ------|
        |---- WebSocket -----|
```

### Stack

**Frontend**

* React
* React Router
* TailwindCSS
* Axios

**Backend**

* FastAPI
* Pydantic
* Motor (MongoDB async driver)

**Other**

* WebSockets for realtime updates
* MongoDB Atlas (production)
* Render (backend deployment)
* Vercel (frontend deployment)

---

## System Diagrams

### Entity Class Diagram

> Left-to-right layout is used to keep the connectors as straight as Mermaid allows.

```mermaid
classDiagram
    direction LR

    class User {
        +id: string
        +email: string
        +username: string
        +bio: string
        +role: string
        +is_online: bool
        +created_at: datetime
    }

    class Project {
        +id: string
        +user_id: string
        +title: string
        +description: string
        +stage: idea|in_progress|completed
        +support_needed: string
        +like_count: int
        +created_at: datetime
    }

    class Update {
        +id: string
        +project_id: string
        +user_id: string
        +content: string
        +like_count: int
        +created_at: datetime
    }

    class Comment {
        +id: string
        +project_id: string
        +user_id: string
        +parent_id: string
        +content: string
        +like_count: int
        +created_at: datetime
    }

    class CollaborationRequest {
        +id: string
        +project_id: string
        +requester_id: string
        +message: string
        +status: pending|accepted|rejected
        +created_at: datetime
    }

    class Like {
        +id: string
        +user_id: string
        +project_id: string?
        +update_id: string?
        +comment_id: string?
        +created_at: datetime
    }

    class Follow {
        +id: string
        +follower_id: string
        +following_id: string
        +created_at: datetime
    }

    class LoginAttempt {
        +identifier: string
        +count: int
        +last_attempt: datetime
    }

    class EmailLog {
        +id: string
        +to: string
        +subject: string
        +email_type: string
        +status: mocked|sent
        +sent_at: datetime
    }

    User "1" --> "0..*" Project : owns
    User "1" --> "0..*" Update : posts
    User "1" --> "0..*" Comment : writes
    User "1" --> "0..*" CollaborationRequest : sends
    User "1" --> "0..*" Like : creates
    User "1" --> "0..*" Follow : starts
    User "1" --> "0..*" EmailLog : receives

    Project "1" --> "0..*" Update : contains
    Project "1" --> "0..*" Comment : receives
    Project "1" --> "0..*" CollaborationRequest : accepts

    Comment "1" --> "0..*" Comment : replies

    Follow "0..*" --> "1" User : follows
    Like "0..*" --> "0..1" Project : targets
    Like "0..*" --> "0..1" Update : targets
    Like "0..*" --> "0..1" Comment : targets
    LoginAttempt --> User : protects auth
```

### Sequence Diagram

```mermaid
sequenceDiagram
    actor Builder
    participant UI as React Frontend
    participant API as FastAPI API
    participant DB as MongoDB
    participant WS as WebSocket Manager
    actor Community as Other User / Client

    Builder->>UI: Sign in and open dashboard
    UI->>API: POST /api/auth/login
    API->>DB: Verify user and login state
    DB-->>API: User record
    API-->>UI: Auth cookies + user payload

    Builder->>UI: Create project
    UI->>API: POST /api/projects
    API->>DB: Insert project document
    DB-->>API: Project saved
    API->>WS: broadcast(new_project)
    WS-->>Community: Push realtime event
    API-->>UI: Created project response

    Community->>UI: Open project details
    UI->>API: GET /api/projects/{project_id}
    API->>DB: Load project, updates, comments
    DB-->>API: Project data
    API-->>UI: Project detail payload

    Community->>UI: Request collaboration
    UI->>API: POST /api/projects/{project_id}/collaborate
    API->>DB: Save collaboration request
    API->>DB: Log notification email
    API->>WS: broadcast(activity update)
    WS-->>Builder: Notify project owner
    API-->>UI: Collaboration request saved
```

---

## Project Structure

```text
backend/
  app/
    core/        configuration and database setup
    models/      request/response schemas
    routes/      API endpoints
    services/    business logic
    utils/       shared helpers

frontend/
  src/
    components/  reusable UI components
    contexts/    auth and websocket state
    pages/       main views
    lib/         API utilities

docs/            architecture and API documentation
tests/           backend tests
```

---

## Running the Project Locally

### Backend

```bash
pip install -r backend/requirements.txt
uvicorn backend.server:app --reload
```

Environment variables:

* `USE_MOCK_DB=true` (optional for local testing)
* `JWT_SECRET=your-secret`
* `FRONTEND_URL=http://localhost:3000`

---

### Frontend

```bash
cd frontend
npm install
npm start
```

---

## Testing

```bash
pytest -q
```

---

## API Overview

The backend exposes endpoints for authentication, users, projects, and social interactions.

Examples:

* `POST /api/auth/register`
* `POST /api/auth/login`
* `GET /api/projects`
* `POST /api/projects`
* `GET /api/feed`

See `docs/API_SUMMARY.md` for the full list.

---

## Deployment

**Backend (Render)**
Configured via `render.yaml` with environment variables for database and authentication.

**Frontend (Vercel)**
Uses `vercel.json` for routing and API proxying.

---

## Security

* Passwords are hashed using bcrypt
* Authentication is handled with JWT (httpOnly cookies)
* Input validation is enforced using Pydantic
* Secrets are managed through environment variables

---

## Notes

This project was built with a focus on clean structure, separation of concerns, and maintainability. The goal was to simulate a real-world full-stack setup rather than just a demo application. The system design was planned using UML diagrams before implementation to ensure clear relationships between entities and scalable architecture decisions.

---

## Documentation

* `docs/ARCHITECTURE.md` — system design and flow
* `docs/API_SUMMARY.md` — endpoint reference
