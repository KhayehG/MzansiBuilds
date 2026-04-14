# Deployment Guide

## Target setup

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## Backend on Render

Render already uses `render.yaml` at the repository root.

### Required environment variables

- `APP_ENV=production`
- `MONGO_URL=<your MongoDB Atlas connection string>`
- `JWT_SECRET=<strong random secret>`
- `FRONTEND_URL=<your Vercel production URL>`
- `CORS_ORIGINS=<comma-separated allowed frontend origins>`
- `ADMIN_PASSWORD=<strong admin password>`
- `RESEND_API_KEY=<Resend API key>`
- `RESEND_FROM_EMAIL=<verified sender email>`

### Optional but recommended

- `ADMIN_EMAIL=admin@example.com`
- `COOKIE_DOMAIN=<your backend cookie domain if needed>`
- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=none`
- `ALLOW_VERCEL_PREVIEW=true`

### Optional for profile image uploads

- `CLOUDINARY_CLOUD_NAME=<cloudinary cloud name>`
- `CLOUDINARY_API_KEY=<cloudinary api key>`
- `CLOUDINARY_API_SECRET=<cloudinary api secret>`

### Important production behavior

The backend now fails fast in production if either of these are true:

- `MONGO_URL` is missing
- `USE_MOCK_DB=true`

That prevents accidental deployment against the mock database.

## Frontend on Vercel

The frontend should call the backend directly using environment variables.

### Vercel project settings

- Framework preset: `Create React App`
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `build`

### Required environment variables

- `REACT_APP_BACKEND_URL=https://<your-render-backend-domain>`
- `REACT_APP_WS_URL=wss://<your-render-backend-domain>`

Examples:

```text
REACT_APP_BACKEND_URL=https://mzansibuilds-api.onrender.com
REACT_APP_WS_URL=wss://mzansibuilds-api.onrender.com
```

## Recommended deployment order

1. Deploy the backend on Render first.
2. Confirm the backend health endpoint responds.
3. Add the backend URL to Vercel frontend environment variables.
4. Deploy the frontend on Vercel.
5. Test auth, project creation, comments, collaboration requests, and uploads.

## Render dashboard values

- Service type: `Web Service`
- Environment: `Python`
- Root directory: repository root
- Build command: `pip install -r backend/requirements-render.txt`
- Start command: `uvicorn backend.server:app --host 0.0.0.0 --port $PORT`
- Health check path: `/api/health`

## Vercel environment values

- `REACT_APP_BACKEND_URL=https://<your-render-service>.onrender.com`
- `REACT_APP_WS_URL=wss://<your-render-service>.onrender.com`

## Cookie and auth notes

- Keep `COOKIE_SECURE=true` in production.
- Keep `COOKIE_SAMESITE=none` when frontend and backend are on different domains.
- Set `FRONTEND_URL` to the exact Vercel production URL.
- Set `CORS_ORIGINS` to include the exact Vercel production URL, and optionally preview URLs if you use them.

## MongoDB Atlas note

- In Atlas Network Access, allow connections from Render.
- If you are testing quickly, `0.0.0.0/0` works, but a tighter allowlist is better long term.

## Deployment checklist

1. Create MongoDB Atlas database and get the connection string.
2. Set backend environment variables in Render.
3. Deploy the backend and verify `https://<backend>/api/health` returns healthy.
4. Set frontend environment variables in Vercel.
5. Deploy the frontend.
6. Verify login, project creation, realtime feed updates, and profile editing.
7. If using uploads, verify Cloudinary variables are present and profile image upload works.

## Smoke test after deploy

- Open the frontend home page.
- Register a new user.
- Create a project.
- Open the same app in a second browser window to verify feed updates.
- Open profile edit and upload an image.
- Confirm cookies work across frontend and backend domains.
