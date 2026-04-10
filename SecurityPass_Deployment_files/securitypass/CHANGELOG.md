# Security Pass — Changelog

## v1.0.0 — April 2026

### Core Application
- Role-based access management (Admin, Approver, Gate User, Visitor)
- Complete pass lifecycle: Request → Approval → QR → Gate Entry/Exit
- Four-role navigation with scoped data per user
- Real-time dashboard with live stat tiles and progress indicators

### Authentication
- Login with email and password
- Quick test login dropdown (12 demo accounts)
- Account Recovery: Forgot Password (3-step Email → OTP → Reset)
- Account Recovery: Forgot User ID (mobile number or name lookup)
- Visitor self-registration (public, no login required)
- Duplicate validation on email, phone, and Govt ID

### Pass Management
- Pass request form with visitor photo (camera or file upload)
- Meeting officer selection and purpose categorisation
- Valid from / until date range with midnight defaults
- Auto visitor record creation on pass submission
- Pass detail with QR code, print, and download
- Bulk approve/reject from dashboard pending actions panel
- Gate activity log with entry/exit timestamps

### Dashboard
- Personalised greeting with first name
- 4 KPI tiles: Total Passes, Pending Approvals, Approved Today, Total Visitors
- Each tile has colour-coded accent, live progress bar, contextual footer
- Role-scoped data (Approver sees only their assigned passes)
- Currently Inside panel with live pulse indicator
- Pending Actions panel with amber urgency bars and inline approve/reject

### Design System
- Teal colour theme: `#0891b2` / `#06b6d4` / `#e0f7fa`
- Dark obsidian login page with teal-tinted glass card
- Login left panel: dot-grid background, orbs, feature bullet points
- Syne headings + Instrument Sans body
- Interactive states: hover lift on cards, teal focus rings, teal nav accent bar
- Notification badges: teal gradient
- Toast notifications with teal left border accent

### Notifications
- Per-user scoped notifications (target_user_id filtering)
- Unread badge counts on nav and topbar
- Click notification → navigate to pass detail
- Mark all read

### User Profile
- Edit name, email, phone
- Profile photo upload
- Change password with current password validation
- Six-character minimum, confirm match

### Technical
- Single-file HTML deployment (~200KB)
- Vanilla JS, no frameworks or build steps required
- Google Fonts: Syne + Instrument Sans
- QRCode.js CDN for QR generation
- Fully offline-capable after initial font load
