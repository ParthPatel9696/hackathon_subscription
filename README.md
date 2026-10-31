# Subscription Management System

Phase 1 is a modular monolithic MERN foundation for subscription management. It includes a secure JWT authentication foundation, customer profiles, role-based access control, and a React business-software shell ready for subscription features.

## Technology stack

- **Client:** React, Vite, Tailwind CSS, React Router, Zustand, TanStack Query, Axios, Lucide React
- **Server:** Node.js, Express, MongoDB, Mongoose, JWT, bcrypt, Zod, Nodemailer-ready configuration
- **Testing:** Vitest, Supertest, MongoDB Memory Server

## Structure

```text
client/src/
  components/ layouts/ modules/auth/ modules/dashboard/
  hooks/ services/ store/ utils/
server/src/
  config/ database/ middleware/ modules/auth/ modules/users/
  utils/ app.js server.js
docs/
```

The backend follows `Route -> Middleware -> Controller -> Service -> Model -> Database`. Business rules stay in services, while controllers handle HTTP concerns.

## Prerequisites

- Node.js 20+
- MongoDB running locally (or a hosted MongoDB URI)

## Installation

```bash
cp .env.example .env
npm install
```

On Windows PowerShell, copy the environment file with `Copy-Item .env.example .env`.

Set strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values in `.env` before using the application outside local development.

## Development

Run both applications:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev --workspace server
npm run dev --workspace client
```

The API is available at `http://localhost:5000`, the client at `http://localhost:5173`, and the health check is `GET /api/v1/health`.

## Environment variables

See [.env.example](./.env.example). `MONGODB_URI`, JWT secrets, client origin, cookie security, and optional SMTP settings are supported. Password-reset responses expose a token only in non-production mode to make local development possible; production should send the token through the configured mail provider.

## Testing

```bash
npm test
```

The server tests cover registration, duplicate emails, password requirements, login, authentication middleware, admin-only staff creation, and customer ownership restrictions. Tests use an ephemeral MongoDB instance and do not require a local MongoDB server.

## API documentation

See [docs/api.md](./docs/api.md) for the Phase 1 endpoint overview. Password hashes, refresh-token hashes, and reset-token hashes are never serialized to clients.
