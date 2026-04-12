# API Summary

## Base Conventions

* All routes are prefixed with `/api`
* Authenticated requests use cookies (`withCredentials: true`)
* Request validation is handled with Pydantic (`schemas.py`)
* IDs are returned as MongoDB ObjectId strings

---

## Authentication

| Method | Path                             | Auth          | Description                 |
| ------ | -------------------------------- | ------------- | --------------------------- |
| POST   | `/api/auth/register`             | No            | Create a user account       |
| POST   | `/api/auth/login`                | No            | Log in and set auth cookies |
| POST   | `/api/auth/logout`               | Optional      | Clear session cookies       |
| POST   | `/api/auth/refresh`              | Refresh token | Issue a new access token    |
| GET    | `/api/auth/me`                   | Yes           | Get current user            |
| GET    | `/api/auth/cloudinary/signature` | Yes           | Generate upload signature   |

### Request bodies

* `register`: `{ email, password, username, bio? }`
* `login`: `{ email, password }`

---

## Users

| Method | Path                             | Auth | Description        |
| ------ | -------------------------------- | ---- | ------------------ |
| GET    | `/api/users/{user_id}`           | No   | Get public profile |
| PUT    | `/api/users/me`                  | Yes  | Update profile     |
| POST   | `/api/users/{user_id}/follow`    | Yes  | Follow user        |
| DELETE | `/api/users/{user_id}/follow`    | Yes  | Unfollow user      |
| GET    | `/api/users/{user_id}/followers` | No   | List followers     |
| GET    | `/api/users/{user_id}/following` | No   | List following     |

---

## Projects

| Method | Path                                        | Auth  | Description                 |
| ------ | ------------------------------------------- | ----- | --------------------------- |
| POST   | `/api/projects`                             | Yes   | Create project              |
| GET    | `/api/projects`                             | No    | List projects               |
| GET    | `/api/projects/{project_id}`                | No    | Get project                 |
| PUT    | `/api/projects/{project_id}`                | Owner | Update project              |
| DELETE | `/api/projects/{project_id}`                | Owner | Delete project              |
| POST   | `/api/projects/{project_id}/updates`        | Yes   | Add update                  |
| GET    | `/api/projects/{project_id}/updates`        | No    | List updates                |
| POST   | `/api/projects/{project_id}/comments`       | Yes   | Add comment                 |
| GET    | `/api/projects/{project_id}/comments`       | No    | List comments               |
| POST   | `/api/projects/{project_id}/collaborate`    | Yes   | Request collaboration       |
| GET    | `/api/projects/{project_id}/collaborations` | Owner | View collaboration requests |

### Query examples

* `/api/projects?stage=idea|in_progress|completed`
* `/api/projects?user_id=<id>`

---

## Community

| Method | Path                       | Auth     | Description           |
| ------ | -------------------------- | -------- | --------------------- |
| POST   | `/api/like`                | Yes      | Like content          |
| DELETE | `/api/like`                | Yes      | Remove like           |
| GET    | `/api/feed`                | Optional | Get feed              |
| GET    | `/api/celebration-wall`    | No       | Completed projects    |
| GET    | `/api/online-users`        | No       | Active users          |
| PUT    | `/api/collaborations/{id}` | Yes      | Accept/reject request |

---

## System & Realtime

| Method | Path          | Description      |
| ------ | ------------- | ---------------- |
| GET    | `/api/`       | API status       |
| GET    | `/api/health` | Health check     |
| WS     | `/ws`         | Realtime updates |

### Events

* `new_project`
* `new_update`
* `new_comment`
* `new_like`
* `user_online`
* `user_offline`
