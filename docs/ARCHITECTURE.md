# ClientHub — Product & Technical Architecture

## Assumptions

- Single-tenant deployment per Voixly instance (one agency, many clients).
- Email/password auth for MVP; OAuth can be added via Auth.js providers later.
- File storage is local disk (`public/uploads`) for MVP; swap to S3/R2 by changing `src/actions/files.ts`.
- USD currency only; Stripe Checkout one-time payments per invoice.
- Staff see only clients assigned via `StaffClientAssignment`; admins see all.
- Resend runs in dev-log mode when `RESEND_API_KEY` is unset.

---

## 1. Product architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ClientHub                             │
├──────────────────────────┬──────────────────────────────────┤
│     CLIENT PORTAL        │     ADMIN / STAFF DASHBOARD        │
│  (role: CLIENT)          │  (role: STAFF, ADMIN)             │
├──────────────────────────┼──────────────────────────────────┤
│ Dashboard                │ Dashboard (KPIs)                   │
│ Billing + Stripe Pay     │ Clients + notes + assignments    │
│ Support tickets (chat)   │ Invoices + payment status        │
│ Project/task updates     │ Tasks + comments                   │
│ Files                    │ Support inbox                      │
│ Announcements            │ Files + announcements              │
│ Profile                  │ Activity audit log                 │
└──────────────────────────┴──────────────────────────────────┘
         │                              │
         └──────────┬───────────────────┘
                    ▼
         ┌──────────────────────┐
         │  Next.js App Router   │
         │  Server Actions + API │
         └──────────┬───────────┘
                    ▼
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
 MySQL          Stripe          Resend
 (Prisma)       (Checkout)      (Email)
```

---

## 2. MySQL database architecture

**Core entities:** User, Client, StaffProfile, StaffClientAssignment, Invoice, Payment, Task, TaskComment, SupportTicket, TicketMessage, FileUpload, ClientNote, Announcement, AnnouncementClient, ActivityLog.

**Relationships (high level):**

- User 1:1 Client (clients) or 1:1 StaffProfile (staff/admin)
- Client 1:N Invoice, Payment, Task, SupportTicket, FileUpload, ClientNote
- Staff N:M Client via StaffClientAssignment
- Invoice 1:N Payment
- Task N:1 Client (optional), N:1 assignee User
- SupportTicket 1:N TicketMessage

**Indexes:** On `role`, `deletedAt`, `clientId`, `status`, `dueDate`, foreign keys — see `prisma/schema.prisma`.

**Soft delete:** `deletedAt` on User, Client, Invoice, Task, SupportTicket, FileUpload, ClientNote, Announcement.

**Audit:** `ActivityLog` + `createdAt` / `updatedAt` on all major tables.

---

## 3. Prisma schema

Location: `prisma/schema.prisma`  
Migration: `prisma/migrations/20250520000000_init/`

---

## 4. User roles & permissions

| Capability | ADMIN | STAFF | CLIENT |
|------------|-------|-------|--------|
| Admin dashboard | ✅ | ✅ | ❌ |
| All clients | ✅ | Assigned only | Own only |
| Create clients/invoices | ✅ | ❌* | ❌ |
| Support reply | ✅ | ✅ | Own tickets |
| Tasks (internal) | ✅ | ✅ | Visible only |
| Pay invoices | ❌ | ❌ | ✅ |
| Activity log | ✅ | ✅ | ❌ |

\*Staff can manage tickets/tasks/files for assigned clients; client creation is admin-only in MVP.

Implementation: `src/lib/permissions.ts`, `src/lib/session-guard.ts`, `src/middleware.ts`.

---

## 5. Main app routes

### Public
- `/` — redirect by role
- `/login` — credentials sign-in

### Client portal (`/portal/*`)
- `/portal` — dashboard
- `/portal/billing` — invoices & payments
- `/portal/support` — ticket list + create
- `/portal/support/[id]` — thread
- `/portal/projects` — client-visible tasks
- `/portal/files` — upload/download
- `/portal/announcements`
- `/portal/profile`

### Admin (`/admin/*`)
- `/admin` — dashboard
- `/admin/clients`, `/admin/clients/[id]`
- `/admin/invoices`
- `/admin/tickets`, `/admin/tickets/[id]`
- `/admin/tasks`, `/admin/tasks/[id]`
- `/admin/files`
- `/admin/announcements`
- `/admin/activity`

### API
- `/api/auth/[...nextauth]`
- `/api/webhooks/stripe`

---

## 6. API routes & server actions

| Action / Route | Purpose |
|----------------|---------|
| `createCheckoutSession` | Stripe Checkout for invoice |
| `POST /api/webhooks/stripe` | Mark invoice paid on `checkout.session.completed` |
| `createInvoice` | Admin creates & sends invoice |
| `createTicket`, `replyToTicket`, `updateTicketStatus` | Support workflow + email |
| `createTask`, `updateTaskStatus`, `addTaskComment` | Task tracker |
| `createClient`, `updateClientProfile`, `addClientNote` | CRM |
| `uploadFile` | Local file storage |
| `createAnnouncement` | Broadcast notices |

---

## 7. Stripe billing flow

```
Client clicks "Pay now"
    → createCheckoutSession (server action)
    → Payment record (PENDING) + Stripe Checkout Session
    → Redirect to Stripe Hosted Checkout
    → Webhook: checkout.session.completed
    → Invoice → PAID, Payment → SUCCEEDED, balance updated
    → Client redirected to /portal/billing?paid=1
```

Required env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` (optional for Elements later).

---

## 8–13. Feature modules (implemented)

- **Admin dashboard** — KPI cards, scoped by staff assignments
- **Client portal** — simplified navigation, pay CTA, chat-style tickets
- **Task tracker** — statuses, due dates, client visibility flag, comments
- **Support** — ticket thread UI, status transitions, Resend on reply
- **Files** — multipart upload, client visibility, download links
- **Email** — Resend wrapper in `src/lib/email.ts` (dev fallback logs)

---

## 14. UI wireframe description

**Layout:** Fixed left sidebar (64px mobile drawer), top bar with user + sign out, content area with max readable width.

**Client portal:** White background, coral primary CTAs, card-based dashboard, table lists for billing/tickets, chat bubbles for support (staff left, client right coral).

**Admin:** Same shell with “Operations” subtitle; dense tables with status badges; inline forms at top of list pages for quick create (client, invoice, task, ticket).

**Typography:** Geist sans (Next.js default), minimal borders, `rounded-xl` cards — Linear/Stripe-inspired.

---

## 15. Development plan

### Phase 1 — MVP (current)
- Auth, roles, middleware
- Prisma schema + migrations + seed
- Portal + admin pages
- Stripe Checkout + webhook
- Resend notifications
- Local file uploads

### Phase 2 — Production hardening
- S3/R2 file storage
- Rate limiting on auth & uploads
- Cron for overdue invoices (`markOverdueInvoices`)
- PDF invoice generation
- Per-client announcement targeting

### Phase 3 — Scale
- OAuth (Google/Microsoft)
- Stripe Customer Portal & subscriptions
- Real-time support (Pusher/Ably)
- Reporting exports
- Multi-workspace / agency accounts

---

## Security notes

- JWT sessions via Auth.js
- Middleware enforces route/role separation
- Server actions validate client scope on every mutation
- Stripe webhook signature verification
- Passwords hashed with bcrypt (cost 12)
- Upload size cap 10MB
