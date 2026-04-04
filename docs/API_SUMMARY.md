# API Summary

## Base Conventions

- All HTTP routes are mounted under the `/api` prefix.
- Authenticated browser requests should send cookies with `withCredentials: true`.
- Request validation is handled by Pydantic models in `backend/app/models/schemas.py`.
- IDs are returned as MongoDB ObjectId strings.

## Authentication

| Method | Path | Auth Required | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Create an account and set auth cookies |
| `POST` | `/api/auth/login` | No | Log in and issue fresh cookies |
| `POST` | `/api/auth/logout` | Yes/Optional | Clear auth cookies |
| `POST` | `/api/auth/refresh` | Refresh cookie | Renew the short-lived access token |
| `GET` | `/api/auth/me` | Yes | Return the authenticated user's profile |
| `GET` | `/api/auth/cloudinary/signature` | Yes | Generate a signed upload payload when Cloudinary is configured |

### Auth request bodies

- `register`: `{ email, password, username, bio? }`
- `login`: `{ email, password }`

## Users

| Method | Path | Auth Required | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/users/{user_id}` | No | Fetch a public user profile |
| `PUT` | `/api/users/me` | Yes | Update the current user's profile |
| `POST` | `/api/users/{user_id}/follow` | Yes | Follow a user |
| `DELETE` | `/api/users/{user_id}/follow` | Yes | Unfollow a user |
| `GET` | `/api/users/{user_id}/followers` | No | List a user's followers |
| `GET` | `/api/users/{user_id}/following` | No | List who a user follows |

### Profile update fields

`PUT /api/users/me` accepts any subset of:

```json
{
  "username": "new_name",
  "bio": "Short profile bio",
  "profile_picture_url": "https://...",
  "skills": ["React", "FastAPI"],
  "github_url": "https://github.com/...",
  "linkedin_url": "https://linkedin.com/in/..."
}
```

## Projects

| Method | Path | Auth Required | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/projects` | Yes | Create a new project |
| `GET` | `/api/projects` | No | List projects, optionally filtered |
| `GET` | `/api/projects/{project_id}` | No | Fetch project details |
| `PUT` | `/api/projects/{project_id}` | Yes (owner) | Update your project |
| `DELETE` | `/api/projects/{project_id}` | Yes (owner) | Delete your project |
| `POST` | `/api/projects/{project_id}/updates` | Yes | Add a progress update |
| `GET` | `/api/projects/{project_id}/updates` | No | List project updates |
| `POST` | `/api/projects/{project_id}/comments` | Yes | Add a comment or reply |
| `GET` | `/api/projects/{project_id}/comments` | No | List threaded comments |
| `POST` | `/api/projects/{project_id}/collaborate` | Yes | Request collaboration on a project |
| `GET` | `/api/projects/{project_id}/collaborations` | Yes/Owner-friendly | List collaboration requests |

### Query parameters

- `GET /api/projects?stage=idea|in_progress|completed`
- `GET /api/projects?user_id=<user-id>`

### Project request bodies

```json
{
  "title": "Community Garden Tracker",
  "description": "A detailed description between 10 and 5000 characters.",
  "stage": "idea",
  "support_needed": "Design feedback or backend help"
}
```

```json
{
  "content": "Shipped the first prototype today!"
}
```

```json
{
  "content": "Looks great — have you considered mobile support?",
  "parent_id": "optional-comment-id-for-replies"
}
```

```json
{
  "message": "I can help with testing and documentation."
}
```

## Community and Collaboration

| Method | Path | Auth Required | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/like` | Yes | Like a project, update, or comment |
| `DELETE` | `/api/like` | Yes | Remove a like |
| `GET` | `/api/feed` | Optional | Return the global or following-based feed |
| `GET` | `/api/celebration-wall` | No | List completed projects |
| `GET` | `/api/online-users` | No | List currently online users |
| `PUT` | `/api/collaborations/{collab_id}?status=accepted|rejected` | Yes | Accept or reject a collaboration request |

### Like payload

Send exactly one target identifier:

```json
{ "project_id": "..." }
```

or

```json
{ "update_id": "..." }
```

or

```json
{ "comment_id": "..." }
```

### Feed modes

- `GET /api/feed?mode=global` — all recent public activity
- `GET /api/feed?mode=following` — activity from followed users when authenticated

## System and Realtime

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/` | Basic API status message |
| `GET` | `/api/health` | Health check and online-user count |
| `WebSocket` | `/ws` | Realtime presence and broadcast channel |

### Realtime event types

The WebSocket channel is used for events such as:

- `new_project`
- `new_update`
- `new_comment`
- `new_like`
- `user_online`
- `user_offline`
