# Security Pass — Backend API

> Node.js / Express REST API with PostgreSQL for the Security Pass Access Management System.

---

## Quick Start

### Option 1 — Docker (recommended)
```bash
docker-compose up -d
```
API available at `http://localhost:3000`

### Option 2 — Local development
```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# 3. Create database
createdb securitypass

# 4. Run migrations + seed
npm run setup

# 5. Start dev server
npm run dev
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API server port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `securitypass` | Database name |
| `DB_USER` | `sp_user` | DB username |
| `DB_PASSWORD` | `sp_password` | DB password |
| `JWT_SECRET` | — | **Required** — long random string |
| `JWT_EXPIRES_IN` | `8h` | Access token expiry |
| `BCRYPT_ROUNDS` | `12` | Password hash rounds |
| `CORS_ORIGIN` | `*` | Allowed frontend origin |
| `UPLOAD_DIR` | `./uploads` | Photo upload directory |

---

## API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Login, returns JWT |
| POST | `/api/auth/refresh` | — | Refresh access token |
| POST | `/api/auth/logout` | — | Revoke refresh token |
| POST | `/api/auth/forgot-password` | — | Initiate OTP reset |
| POST | `/api/auth/reset-password` | — | Complete password reset |
| POST | `/api/auth/lookup-user-id` | — | Find email by phone/name |

### Dashboard
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/dashboard` | admin, approver, gate | KPI stats + recent data |

### Passes
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/passes` | all | List passes (role-scoped) |
| POST | `/api/passes` | admin, approver, visitor | Create pass |
| GET | `/api/passes/:id` | all | Get pass detail |
| PATCH | `/api/passes/:id/approve` | admin, approver | Approve pass + generate QR |
| PATCH | `/api/passes/:id/reject` | admin, approver | Reject pass |
| POST | `/api/passes/:id/gate-log` | admin, gate | Log entry/exit |
| GET | `/api/passes/:id/qr` | all | Get QR code (base64) |
| GET | `/api/passes/verify/:num` | **public** | Verify QR token |

### Visitors
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/visitors` | admin, gate | Visitor directory |
| GET | `/api/visitors/:id` | admin, gate | Visitor profile + history |
| GET | `/api/visitors/inside` | admin, gate | Currently inside |
| POST | `/api/visitors/register` | **public** | Self-registration |

### Users
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/users/me` | all | Own profile |
| PATCH | `/api/users/me` | all | Update name/phone |
| POST | `/api/users/me/avatar` | all | Upload photo |
| POST | `/api/users/me/change-password` | all | Change password |
| GET | `/api/users` | admin | All users list |
| PATCH | `/api/users/:id/status` | admin | Activate/deactivate |

### Notifications
| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/notifications` | all | Own notifications |
| GET | `/api/notifications/unread-count` | all | Unread badge count |
| PATCH | `/api/notifications/:id/read` | all | Mark one read |
| PATCH | `/api/notifications/read-all` | all | Mark all read |

---

## Authentication

All protected routes require a Bearer token in the header:
```
Authorization: Bearer <accessToken>
```

### Login example
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@securitypass.local","password":"password"}'
```

### Response format
All responses follow:
```json
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```
Paginated responses add:
```json
{
  "pagination": {
    "page": 1, "limit": 20, "total": 42, "pages": 3
  }
}
```

---

## Database Schema

```
departments          ← organisational departments
users                ← all users (staff + visitors)
visitor_profiles     ← extended visitor data
passes               ← security passes (full lifecycle)
gate_logs            ← entry/exit events per pass
notifications        ← per-user alerts
refresh_tokens       ← JWT refresh token store
audit_logs           ← full action audit trail

Views:
  v_passes            ← passes with host + gate logs
  v_currently_inside  ← visitors currently on premises
  v_dashboard_stats   ← KPI aggregates
```

---

## Project Structure
```
sp-backend/
├── src/
│   ├── server.js               ← Express app + server boot
│   ├── routes/
│   │   ├── index.js            ← Route aggregator
│   │   ├── auth.routes.js
│   │   ├── passes.routes.js
│   │   ├── visitors.routes.js
│   │   ├── users.routes.js
│   │   ├── dashboard.routes.js
│   │   └── notifications.routes.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── passes.controller.js
│   │   ├── visitors.controller.js
│   │   ├── users.controller.js
│   │   ├── dashboard.controller.js
│   │   └── notifications.controller.js
│   ├── middleware/
│   │   ├── auth.js             ← JWT verify + RBAC
│   │   ├── validate.js         ← express-validator runner
│   │   ├── audit.js            ← audit log middleware
│   │   └── errorHandler.js     ← global error handler
│   └── utils/
│       ├── logger.js           ← Winston logger
│       └── response.js         ← Standard response helpers
├── config/
│   └── database.js             ← pg pool
├── migrations/
│   ├── run.js                  ← Migration runner
│   └── 001_schema.sql          ← Full PostgreSQL schema
├── seeds/
│   ├── run.js                  ← Seed runner
│   └── 001_seed.sql            ← Demo data (12 users, 5 passes)
├── tests/
│   └── auth.test.js
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@securitypass.local | password |
| Admin | anjali@company.com | anjali@123 |
| Approver | priya@company.com | priya@123 |
| Approver | rohan@company.com | rohan@123 |
| Gate User | ravi@company.com | pass@123 |
| Gate User | sunita.g@company.com | sunita@123 |
| Visitor | visitor@securitypass.local | password |
