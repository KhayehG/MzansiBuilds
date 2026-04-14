# MzansiBuilds

MzansiBuilds is a professional developer collaboration platform built to help software creators publish work in progress, discover new ideas, and coordinate contributions. It combines project publication, progress tracking, collaboration requests, feedback loops, and operational moderation into a unified developer experience.

This implementation includes a React-based frontend, a FastAPI backend, MongoDB persistence, realtime updates over WebSocket, and GitHub Actions-powered CI validation.

---

## Project Title & Introduction

MzansiBuilds is a modern developer ecosystem for sharing active builds and growing technical collaboration. It solves the problem of isolated project work by making development progress social, discoverable, and manageable.

The platform enables developers to:

* publish projects with structured progress stages
* request collaboration and manage contributor interactions
* discover projects through feed and celebration walls
* interact with the community through likes, follows, and comments
* protect the platform with reporting and admin moderation tools

---

## Key Features

### Authentication System

* Secure registration and login workflows
* JWT-backed authentication with access and refresh tokens
* Session persistence via secure cookies
* Password reset flow with time-bound tokens
* Email/password credentials are validated with strict backend schemas

### Project Creation and Management

* Create new projects with title, description, stage, support needs, and tech stack
* Edit project metadata and lifecycle details
* Delete projects from user-owned collections
* Publish updates and comments tied to projects
* Track contributions with collaborator status and project progress

### SDLC Tracking

* Supports both waterfall and agile project stage flows
* Provides stage history and active stage transitions
* Allows milestone creation, updates, and removal
* Reflects stage state in the project feed and detail views

### Feed System and Discovery

* Global feed for all public projects and updates
* Following feed for personalized developer discovery
* Celebration wall for completed projects
* Search filters for stage, tech stack, owner, and keywords
* Online user presence tracking

### Engagement and Likes

* Like projects, updates, and comments
* Remove likes with a toggle flow
* Maintain engagement metrics across content types
* Send in-app notifications for new likes and interactions

### Collaboration and Requests

* Request collaboration on existing projects
* Accept or reject collaboration requests as a project owner
* Cancel pending collaboration requests
* Track collaborator permissions and project roles
* Support project chat and direct messaging through conversation APIs

### Reporting and Moderation

* File reports for projects, comments, users, and system issues
* Admin report review with status management and notes
* Hide and unhide reported content on moderation decisions
* Auto-flagging escalation for repeated reports

### Role-Based Access Control

* Standard users create projects, interact socially, and request collaboration
* Admin users manage reports, hide content, and suspend users
* Owner and collaborator permissions are enforced per project
* Admin-only routes are protected by server-side role checks

---

## System Architecture

MzansiBuilds is structured as a layered full-stack application:

* **Frontend:** React UI with routing, authentication context, and realtime state
* **Backend:** FastAPI REST API with route, service, and validation layers
* **Database:** MongoDB for users, projects, activity, and moderation data
* **Realtime:** WebSocket endpoint for live notifications and activity updates
* **CI/CD:** GitHub Actions for backend tests and frontend build checks

```text
React Frontend
      |
      | HTTP REST API (/api)
      | WebSocket (/ws)
      v
FastAPI Backend
      |
      | Database access, auth, moderation, realtime
      v
MongoDB
```

### Architectural Layers

* `frontend/src/` — client UI, pages, components, contexts, and API helpers
* `backend/app/core/` — configuration, database initialization, and environment management
* `backend/app/models/` — Pydantic request and response schemas
* `backend/app/routes/` — REST API endpoint definitions
* `backend/app/services/` — business logic, authentication, email, realtime
* `tests/` — backend integration and smoke test coverage

---

## Tech Stack

* **FastAPI** — backend framework for REST and realtime endpoints
* **Python 3.11** — backend runtime environment
* **MongoDB** — document database for persistence
* **Pydantic** — request validation and data modeling
* **JWT** — authentication and session tokens
* **GitHub Actions** — CI/CD automation for tests and builds
* **Node.js** — frontend build tooling
* **pytest** — backend testing framework

---

## Authentication & Security Design

Security is built into the platform design rather than added after the fact.

### JWT Authentication Flow

* Access tokens are issued after login and used for protected requests
* Refresh tokens are used to renew access tokens without forcing re-login
* Tokens are signed with a secret from environment variables

### Cookie Security

* Authentication cookies are marked `HttpOnly`
* Production cookies use `Secure`
* `SameSite` is configured to support cross-domain deployments safely

### Role-Based Access Control

* Admin-specific routes require an admin role
* Ordinary users cannot access administrative moderation endpoints
* Project ownership and collaborator privileges gate editing and deletion

### Input Validation

* Every route validates payloads with strict Pydantic models
* Unexpected fields are rejected through `extra='forbid'`
* Text fields are normalized and sanitized before persistence
* Object IDs and query parameters are validated before use

### Environment-Based Secrets

* Secrets are loaded from environment variables only
* Production mode fails if critical secrets are missing
* No hardcoded credentials are stored in the repository

---

## Database Design Overview

MongoDB is used to model the application entities and relationships.

### Core Collections

* **Users** — account profiles, roles, suspension state, and presence
* **Projects** — project records, stages, support needs, and metadata
* **Updates** — Project progress entries
* **Comments** — discussion entries on projects
* **CollaborationRequests** — collaboration workflow records
* **Likes** — social engagement across project, update, and comment content
* **Follows** — developer following relationships
* **Reports** — moderation reports and admin actions
* **Notifications** — user-facing activity alerts

### Relationships

* Users create and own projects
* Users follow other developers for curated feeds
* Users like content and receive engagement notifications
* Users collaborate on projects through requests and approvals
* Admins manage reports and moderate content

---

## API Overview (High-Level)

### Auth Routes

* `POST /api/auth/register` — register a new user
* `POST /api/auth/login` — authenticate and set cookies
* `POST /api/auth/logout` — clear auth session cookies
* `POST /api/auth/refresh` — refresh access tokens
* `GET /api/auth/me` — retrieve current authenticated user
* `GET /api/auth/cloudinary/signature` — generate image upload signature

### User Routes

* `GET /api/users/{user_id}` — public profile retrieval
* `PUT /api/users/me` — update current user profile
* `POST /api/users/{user_id}/follow` — follow another user
* `DELETE /api/users/{user_id}/follow` — unfollow a user
* `GET /api/users/{user_id}/followers` — list followers
* `GET /api/users/{user_id}/following` — list following

### Project Routes

* `POST /api/projects` — create a project
* `GET /api/projects` — list and search projects
* `GET /api/projects/{project_id}` — get project detail
* `PUT /api/projects/{project_id}` — update a project
* `DELETE /api/projects/{project_id}` — delete a project
* `POST /api/projects/{project_id}/updates` — add a project update
* `GET /api/projects/{project_id}/updates` — list project updates
* `POST /api/projects/{project_id}/comments` — add a comment
* `GET /api/projects/{project_id}/comments` — list comments
* `POST /api/projects/{project_id}/collaborate` — request collaboration
* `DELETE /api/projects/{project_id}/collaborate` — cancel collaboration request
* `GET /api/projects/{project_id}/collaborations` — view collaboration requests
* `GET /api/projects/{project_id}/stages` — fetch stage flow
* `GET /api/projects/{project_id}/stage-history` — stage transition history
* `POST /api/projects/{project_id}/stages/complete` — complete the current stage
* `POST /api/projects/{project_id}/stages/move` — move project stage
* `POST /api/projects/{project_id}/milestones` — create a milestone
* `GET /api/projects/{project_id}/milestones` — list milestones
* `PUT /api/projects/{project_id}/milestones/{milestone_id}` — update milestone
* `DELETE /api/projects/{project_id}/milestones/{milestone_id}` — remove milestone

### Community and Social Routes

* `POST /api/like` — like/unlike a project, update, or comment
* `DELETE /api/like` — remove a like
* `GET /api/feed` — fetch global or following feed
* `GET /api/celebration-wall` — show completed projects
* `GET /api/online-users` — list active users

### Reporting and Admin Routes

* `POST /api/reports` — create a moderation report
* `GET /api/reports/admin/all` — admin report listing
* `PUT /api/reports/admin/{report_id}` — update report status
* `DELETE /api/reports/admin/{report_id}/hide-content` — hide reported content
* `PUT /api/reports/admin/{report_id}/unhide-content` — restore hidden content

### Chat and Notification Routes

* `POST /api/chat/conversations` — create project chat conversations
* `POST /api/chat/conversations/dm` — create or fetch a direct message thread
* `GET /api/chat/conversations` — list user conversations
* `POST /api/chat/messages` — send a chat message
* `GET /api/chat/messages/{conversation_id}` — get conversation history
* `GET /api/chat/notifications` — retrieve notifications
* `PUT /api/chat/notifications/{notification_id}/read` — mark notification read
* `PUT /api/chat/notifications/read-all` — mark all notifications read

---

## CI/CD Pipeline (GitHub Actions)

The repository includes a GitHub Actions workflow to validate every change:

* Backend test suite runs with `pytest`
* Frontend build validation runs with `npm run build`
* Pipeline is triggered for pushes and pull requests
* This ensures code stability before merge

See `.github/workflows/ci.yml` for workflow details.

---

## Testing Strategy

MzansiBuilds uses backend-focused integration tests and smoke tests.

* Backend tests are executed with `pytest`
* `fastapi.testclient.TestClient` exercises API routes
* Mock database mode is enabled with `USE_MOCK_DB=true`
* Smoke tests cover authentication, project creation, collaboration, and moderation flows
* Regression tests protect established behaviors

Note: frontend-specific test coverage is not yet implemented.

---

## Branching Strategy

The repository follows a development branching model:

* `develop` — active development and feature integration
* `main` — stable production-ready releases
* feature branches are merged into `develop` first
* stable changes are promoted from `develop` into `main`

---

## Secure By Design Approach

Security is built into the design of MzansiBuilds:

* Strict schema validation for all incoming requests
* Role-based authorization for admin and owner actions
* JWT tokens validated on every authenticated endpoint
* Secure cookie handling for auth tokens
* Environment-based secrets for production-sensitive values
* Database and ID validation prevents malformed queries

---

## Known Limitations / Future Improvements

Current opportunities for improvement include:

* add frontend unit and integration tests
* add end-to-end browser testing
* expand real-time collaboration capabilities
* add a dedicated notification inbox experience
* add analytics dashboards for engagement and project health

---

## Developer Setup Instructions

### Backend

```bash
pip install -r backend/requirements.txt
uvicorn backend.server:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm start
```

### Environment Variables

Required environment variables:

* `JWT_SECRET`
* `MONGO_URL` or `USE_MOCK_DB=true`
* `FRONTEND_URL`
* `CORS_ORIGINS`
* `REACT_APP_BACKEND_URL`
* `REACT_APP_WS_URL`

Optional upload variables:

* `CLOUDINARY_CLOUD_NAME`
* `CLOUDINARY_API_KEY`
* `CLOUDINARY_API_SECRET`

### Admin Setup

Admin credentials should never be stored in the repository. The backend can seed a local admin user when it starts by using environment variables:

* `ADMIN_EMAIL` — admin account email (default: `admin@example.com`)
* `ADMIN_PASSWORD` — admin account password
* `ALLOW_INSECURE_LOCAL_ADMIN_SEED=true` — allows a local fallback password when using `USE_MOCK_DB=true`

For local testing with `USE_MOCK_DB=true`, the backend will create a seeded admin user automatically if `ADMIN_PASSWORD` is set. If `ADMIN_PASSWORD` is absent and `ALLOW_INSECURE_LOCAL_ADMIN_SEED=true`, the fallback password is `admin123`.

In production, admin seeding is skipped unless `ADMIN_PASSWORD` is explicitly provided. This keeps administrators from being created with unsafe default credentials.

If you need an admin account for local development, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your environment or use a `.env` file that is not committed to source control.

---

## Contribution Guide

To contribute:

1. Fork the repository
2. Create a branch from `develop`
3. Implement changes and keep commits focused
4. Run tests before committing
5. Open a pull request against `develop`

---

## Final Notes

MzansiBuilds is built as a portfolio-ready full-stack project with a focus on security, maintainability, and real-world architecture. It is intended to demonstrate a complete developer workflow from API and database design to frontend integration, realtime updates, and deployment readiness.


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
