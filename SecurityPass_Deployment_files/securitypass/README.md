# Security Pass — Access Management System

> Enterprise visitor access management with role-based approvals, QR gate scanning, and real-time audit trails.

---

## Overview

Security Pass is a self-contained, single-file web application for managing visitor access across secure facilities. It supports four user roles — Admin, Approver, Gate User, and Visitor — each with a tailored interface and permissions.

---

## Quick Start

### Option 1 — Open directly in browser

```bash
open index.html
```

No server, no build step. Works entirely offline from the file system.

### Option 2 — Serve locally

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# Then open: http://localhost:8080
```

### Option 3 — Deploy to any static host

Upload `index.html` to:
- Nginx / Apache document root
- AWS S3 static website
- GitHub Pages
- Netlify / Vercel (drag and drop)

---

## Login Credentials

| Role       | Email                          | Password    |
|------------|-------------------------------|-------------|
| Admin      | admin@securitypass.local       | password    |
| Admin      | anjali@company.com             | anjali@123  |
| Approver   | priya@company.com              | priya@123   |
| Approver   | rohan@company.com              | rohan@123   |
| Approver   | kavita@company.com             | kavita@123  |
| Approver   | dev@company.com                | dev@123     |
| Approver   | suresh@company.com             | suresh@123  |
| Approver   | meena@company.com              | meena@123   |
| Approver   | arjun@company.com              | arjun@123   |
| Gate User  | ravi@company.com               | ravi@123    |
| Gate User  | sunita.g@company.com           | sunita@123  |
| Visitor    | visitor@securitypass.local     | password    |

> **Test dropdown**: Use the "Quick Test Login" dropdown on the login page to auto-fill any account with one click.

---

## User Roles

### Admin
- Full dashboard with live stats and metrics
- View, filter, and manage all passes
- Approve or reject pending passes
- Access visitor directory
- User management (all staff accounts)
- System notifications

### Approver
- Scoped dashboard (own passes only)
- Approve / reject passes assigned to them
- Request new passes
- Notifications for pending actions

### Gate User
- All passes list with entry/exit logging
- Visitor directory
- Gate activity — mark visitor entry and exit

### Visitor
- Request a new pass (select meeting officer, purpose, dates)
- View own pass history with QR codes
- Self-registration available without login

---

## Features

- **Role-based navigation** — each role sees only relevant pages
- **Pass lifecycle** — Request → Pending → Approved/Rejected → Entry → Exit
- **QR code generation** — approved passes get unique QR codes
- **Print gate pass** — print-ready pass with QR, visitor photo and details
- **Camera capture** — visitor photo via webcam or file upload
- **Visitor self-registration** — public form, no login required
- **Duplicate validation** — checks email, phone, and Govt ID on registration
- **Account recovery** — Forgot Password (3-step OTP) + Forgot User ID (mobile/name lookup)
- **Notifications** — real-time badges, per-user scoped alerts
- **Gate activity log** — entry/exit timestamps with duration tracking

---

## Design System

| Token      | Value        | Usage                  |
|-----------|-------------|------------------------|
| `--acc`    | `#0891b2`   | Primary teal           |
| `--acc2`   | `#06b6d4`   | Cyan accent            |
| `--acc3`   | `#e0f7fa`   | Light teal background  |
| `--navy`   | `#0b1120`   | Sidebar / dark bg      |
| `--surf`   | `#f0f9ff`   | Page surface           |

Fonts: **Syne** (headings) + **Instrument Sans** (body)

---

## File Structure

```
securitypass/
├── index.html          ← Complete application (single file, ~200KB)
├── README.md           ← This guide
├── CHANGELOG.md        ← Version history
└── docs/
    ├── credentials.md  ← Quick credentials reference card
    └── user-guide.md   ← Per-role user guide
```

---

## Browser Support

| Browser        | Supported |
|---------------|-----------|
| Chrome 90+    | ✅        |
| Firefox 88+   | ✅        |
| Safari 14+    | ✅        |
| Edge 90+      | ✅        |

---

## Version

**1.0.0** — April 2026  
Build: v1.94 (internal)
