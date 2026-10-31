# API overview

All endpoints are prefixed with `/api/v1` and return `{ success, data }` on success or `{ success: false, error }` on failure.

## Authentication

- `POST /auth/register` - create a customer (`name`, `email`, `password`)
- `POST /auth/login` - issue an access token and HttpOnly refresh cookie
- `POST /auth/refresh` - rotate the refresh cookie and issue a new access token
- `POST /auth/logout` - revoke the refresh token
- `GET /auth/me` - return the authenticated user
- `POST /auth/forgot-password` - request a reset token (sent by email in production)
- `POST /auth/reset-password` - consume a reset token once
- `POST /auth/staff` - ADMIN-only staff creation

Access tokens use `Authorization: Bearer <token>`. Refresh tokens are never returned in JSON.
