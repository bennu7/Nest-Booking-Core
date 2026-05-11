# Product Requirements Document — Nest Booking Core

> **Document Type:** PRD / Architecture Reference
> **Audience:** AI Agent (Claude Opus), Senior Engineer, Future Maintainer
> **Purpose:** Single source of truth untuk business flow, technical architecture, dan project state
> **Last Updated:** 2026-05-11
> **Status:** Active Development — Phase 2b Payment Module (Security Issues Fixed)

---

# Project Overview

**Nest Booking Core** adalah backend API multi-tenant untuk layanan booking berbasis jadwal. Built dengan NestJS dan PostgreSQL.

**Target use case:** Bisnis layanan berbasis jadwal — barbershop, studio foto, klinik, konsultan — yang butuh sistem booking online dengan slot real-time, multi-tenant support, dan notifikasi otomatis.

**Tech Stack:**
- Runtime: Bun
- Framework: NestJS
- ORM: Prisma
- Database: PostgreSQL
- Queue: BullMQ (planned)
- Payment Gateway: Midtrans (integrated)

---

# Business Goals

1. **Hindari Double Booking** — Slot dikunci sementara (TTL-based hold) + optimistic locking untuk mencegah dua customer booking jam yang sama
2. **Isolasi Data Tenant** — Setiap bisnis punya data terpisah: pelanggan, jadwal, booking, kebijakan
3. **Fleksibilitas Kebijakan** — Cancellation policy per tenant, tidak hardcoded
4. **Transparansi** — Audit trail untuk setiap perubahan status booking
5. **Notifikasi Otomatis** — Email, SMS, push, WebSocket notification per event booking

---

# Current Development State

## Phase Overview

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Auth Module (JWT + Refresh Token, tenant context) | ✅ Complete |
| Phase 2a | Booking Core (slot hold, booking CRUD, status management) | ✅ Complete |
| Phase 2b | Payment Module (Midtrans integration) | ✅ Complete (Security Fixed) |
| Phase 2b-tests | Payment Module Unit Tests (STEP 6) | ✅ Complete (53 tests) |
| Phase 2c | Notification Module | 🔄 Planned |
| Phase 3a | E2E Test Infrastructure | 🔄 Planned |
| Phase 3b | Jobs Module (slot cleanup, booking reminder) | 🔄 Planned |
| Phase 4a | Health Module | ✅ Complete (basic) |
| Phase 4b | Analytics Module | 🔄 Planned |

## Security Audit Status

**2026-05-11 Audit Result: All Critical Issues Resolved + Unit Tests Added**

| Issue ID | Description | Severity | Status |
|----------|-------------|----------|--------|
| C1 | Webhook Idempotency | 🔴 CRITICAL | ✅ Fixed — skip if payment not PENDING |
| C2 | Race Condition in updatePaymentStatus | 🔴 CRITICAL | ✅ Fixed — atomic `updateMany` |
| C3 | Silent Refund Failure | 🔴 CRITICAL | ✅ Fixed — throws PaymentGatewayException |
| C4 | Hardcoded 'CONFIRMED' string | 🔴 CRITICAL | ✅ Fixed — uses BookingStatus.CONFIRMED |
| C5 | Webhook Signature Verification | 🔴 CRITICAL | ✅ Fixed — SHA512 verification before processing |
| W1 | @Global() on PaymentModule | 🟡 HIGH | ✅ Fixed — removed |
| W2 | MidtransNotificationResponse leak | 🟡 HIGH | ✅ Fixed — moved to `types/midtrans.types.ts` |
| W3 | WebhookController inject concrete | 🟡 HIGH | ✅ Fixed — injects via PAYMENT_GATEWAY token |
| W4 | Double gateway instantiation | 🟡 HIGH | ✅ Fixed — single instance via injection token |
| W5 | retryPayment no booking validation | 🟡 HIGH | ✅ Fixed — explicit booking status check |
| W6 | OR condition in findByExternalId | 🟡 HIGH | ✅ Fixed — OR removed, canonical lookup |
| W7 | @OnEvent booking.created not working | 🟡 HIGH | ✅ Fixed — emit in BookingService, listen in PaymentService |
| I1 | PaymentGatewayException location | 🟠 MEDIUM | ⚠️ Partial — refund now throws, tapi class masih di `midtrans-payment.gateway.ts` (belum dipindah ke shared exceptions) |
| I2 | Config validation missing | 🟠 MEDIUM | ✅ Fixed — throws Error if serverKey not set |

Full audit details: `PLAN.md`

---

# Existing Features

## Implemented

| Feature | Module | Status | Notes |
|---------|--------|--------|-------|
| JWT + Refresh Token auth | Auth | ✅ Complete | Hash-stored refresh tokens |
| Tenant-scoped queries | All | ✅ Complete | tenantId in JWT payload |
| Slot Hold dengan 15 menit TTL | Booking | ✅ Complete | `HOLD_TTL_MS = 15 * 60 * 1000` |
| Booking CRUD dengan optimistic locking | Booking | ✅ Complete | `version` column |
| Booking status flow | Booking | ✅ Complete | PENDING→CONFIRMED→IN_PROGRESS→COMPLETED |
| Audit trail | Booking | ✅ Complete | `BookingStatusLog` on every change |
| Cancellation policy enforcement | Booking | ✅ Complete | Per tenant, calculates lateFee |
| Payment Gateway interface | Payment | ✅ Complete | `PaymentGateway` interface |
| Mock Payment Gateway | Payment | ✅ Complete | For dev/testing |
| Midtrans Payment Gateway | Payment | ✅ Complete | Full SHA512 signature verification |
| Webhook idempotency | Payment | ✅ Complete | Skip if not PENDING |
| Atomic payment status update | Payment | ✅ Complete | `updateMany` to avoid race condition |
| Auto-payment on booking | Payment | ✅ Complete | `@OnEvent('booking.created')` listener |
| Unit tests — Payment Module | Payment | ✅ Complete | 53 tests (service + status mapper) |
| Throttler (rate limiting) | App | ✅ Complete | 10 req/min global |

## Planned But Not Implemented

| Feature | Status | Priority |
|---------|--------|----------|
| BullMQ notification queue | 🔄 Planned | HIGH |
| Email/SMS/Push notification | 🔄 Planned | HIGH |
| Real-time WebSocket notification | 🔄 Planned | MEDIUM |
| Idempotency interceptor (HTTP) | 🔄 Planned | MEDIUM |
| E2E test infrastructure | 🔄 Planned | HIGH |
| Cron job untuk slot hold cleanup | 🔄 Planned | MEDIUM |
| Booking reminder job | 🔄 Planned | MEDIUM |
| Google OAuth | 🔄 Planned | LOW |

---

# Core Domain & Business Flow

## Booking Flow

```
Customer memilih slot
        ↓
Slot Hold (TTL 15 menit) ←── Double booking prevention
        ↓
Available? ── Tidak ──→ Expire, customer coba lagi
        ↓ Ya
Booking PENDING ←── BookingStatusLog created
        ↓
[Auto-Event] booking.created → PaymentService creates Payment PENDING
        ↓
Payment ── Online ──→ Redirect ke Midtrans
       └─ Cash ──→ Tunggu konfirmasi provider
        ↓
Midtrans Webhook → updatePaymentStatus (atomic)
        ↓
Payment SUCCESS → confirmBookingAfterPayment → Booking CONFIRMED
        ↓
Provider konfirmasi ──→ Booking IN_PROGRESS (optional)
        ↓
Layanan diberikan ──→ Booking COMPLETED
        ↓
Customer Batal?
        ↓
├── Dalam periode gratis? ──→ Batal tanpa biaya
└── Lewat periode gratis? ──→ Denda sesuai kebijakan tenant
        ↓
[Event] payment.completed / booking.cancelled → NotificationService (planned)
```

## Status Flow

**BookingStatus:**
```
PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
    ↓          ↓           ↓
CANCELLED  CANCELLED   CANCELLED
    ↓          ↓
  NO_SHOW   NO_SHOW
```

**PaymentStatus:**
```
PENDING → SUCCESS
    ↓       ↓
  FAILED  REFUNDED
    ↓
  EXPIRED
```

---

# Architecture Overview

## Module Structure

```
AppModule
├── AppConfigModule (ConfigService)
├── PrismaModule (PrismaService, @Global)
├── HealthModule
├── AuthModule ←── JWT + Refresh Token + Tenant context
├── TenantModule ←── Tenant CRUD + settings
├── ProviderModule ←── Provider + Schedule + Break
├── BookingModule ←── SlotHold + Booking + Status
├── PaymentModule ←── Payment + Webhook + Midtrans Gateway
└── EventEmitterModule (async event bus, @Global)
```

## Key Design Patterns

1. **Multi-Tenancy:** `tenant_id` column di semua tabel utama, tenant-scoped queries via JWT payload
2. **Event-Driven Architecture:** `EventEmitter2` untuk decoupling Booking dan Payment
   - `booking.created` — BookingService emits → PaymentService auto-creates Payment
   - `payment.completed` — PaymentService emits → (future) NotificationService
   - `payment.failed` — PaymentService emits → (future) NotificationService
3. **Slot Locking:** TTL-based `slot_holds` table dengan 15 menit expiration
4. **Optimistic Locking:** `version` column di `bookings` table
5. **Gateway Pattern:** `PaymentGateway` interface dengan `PAYMENT_GATEWAY` injection token
6. **Atomic Updates:** `updateMany` untuk menghindari race condition pada webhook processing

---

# Module Responsibilities

## AuthModule
- Login / Register (bcrypt + tenant-scoped)
- JWT access token (short-lived)
- Refresh token rotation with SHA256 hash storage
- Tenant setup (SUPER_ADMIN creates first ADMIN)
- User activation/deactivation

## TenantModule
- Tenant CRUD (name, slug, email, phone, address, timezone)
- Tenant settings (JSONB)
- Tenant activation/deactivation

## ProviderModule
- ProviderProfile CRUD (bio, specialization, rating)
- ProviderSchedule (recurring work hours per day_of_week)
- ProviderBreak (breaks, time off, recurring support)

## BookingModule
- SlotService: createHold (15 min TTL), deleteExpiredHolds
- BookingService: CRUD, confirmBooking, cancelBooking (with policy enforcement), completeBooking
- Emit `booking.created` event after successful booking creation

## PaymentModule
- PaymentGateway interface + MockPaymentGateway (dev)
- MidtransPaymentGateway (production) — SHA512 signature verification
- PaymentService:
  - createPayment — initialize payment with gateway
  - findByExternalId — lookup by externalPaymentId
  - updatePaymentStatus — atomic updateMany
  - confirmBookingAfterPayment — update booking status + emit event
  - retryPayment — with booking status validation
  - @OnEvent('booking.created') — auto-create payment on booking

---

# API Overview

## API Versioning

API prefixed dengan `/api/v1/`

## Auth Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Register user |
| POST | `/auth/login` | Public | Login, returns JWT |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/logout` | Public | Revoke refresh token |
| POST | `/auth/setup-tenant` | JWT | Setup first tenant for user |
| PATCH | `/auth/users/:id/toggle-status` | ADMIN, SUPER_ADMIN | Activate/deactivate user |

## Tenant Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/tenants` | SUPER_ADMIN | Create tenant |
| GET | `/tenants` | SUPER_ADMIN | List tenants |
| GET | `/tenants/:id` | SUPER_ADMIN | Get tenant |
| PATCH | `/tenants/:id` | ADMIN, SUPER_ADMIN | Update tenant |
| DELETE | `/tenants/:id` | SUPER_ADMIN | Delete tenant |
| PATCH | `/tenants/:id/toggle-status` | SUPER_ADMIN | Activate/deactivate tenant |

## Provider Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/providers` | ADMIN, SUPER_ADMIN | Create provider |
| GET | `/providers` | All authenticated | List providers |
| GET | `/providers/:id` | All authenticated | Get provider detail |
| PATCH | `/providers/:id` | ADMIN, PROVIDER | Update provider |
| DELETE | `/providers/:id` | ADMIN, SUPER_ADMIN | Delete provider |
| POST | `/providers/:id/schedules` | ADMIN, PROVIDER | Create schedule |
| GET | `/providers/:id/schedules` | All authenticated | List schedules |
| PATCH | `/providers/:id/schedules/:scheduleId` | ADMIN, PROVIDER | Update schedule |
| DELETE | `/providers/:id/schedules/:scheduleId` | ADMIN, PROVIDER | Delete schedule |
| POST | `/providers/:id/breaks` | ADMIN, PROVIDER | Create break |
| GET | `/providers/:id/breaks` | All authenticated | List breaks |
| DELETE | `/providers/:id/breaks/:breakId` | ADMIN, PROVIDER | Delete break |

## Booking Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/slot-holds` | CUSTOMER | Hold slot for 15 minutes |
| GET | `/slot-holds` | CUSTOMER | List own holds |
| DELETE | `/slot-holds/:id` | CUSTOMER | Release hold |
| POST | `/bookings` | CUSTOMER | Create booking (convert hold) |
| GET | `/bookings` | All authenticated | List bookings (role-scoped) |
| GET | `/bookings/:id` | All authenticated | Get booking detail |
| PATCH | `/bookings/:id/confirm` | ADMIN, PROVIDER | Confirm booking |
| PATCH | `/bookings/:id/cancel` | All authenticated | Cancel booking |
| PATCH | `/bookings/:id/complete` | ADMIN, PROVIDER | Mark completed |

## Payment Endpoints

| Method | Path | Roles | Description | Notes |
|--------|------|-------|-------------|-------|
| POST | `/payments/booking/:bookingId` | CUSTOMER, ADMIN, SUPER_ADMIN | Create/init payment | Also auto-created via `booking.created` event |
| POST | `/payments/:id/retry` | CUSTOMER, ADMIN, SUPER_ADMIN | Retry failed payment | Validates booking status |
| GET | `/payments/external/:externalId` | ADMIN, SUPER_ADMIN, PROVIDER | Get payment by external ID | Lookup via Midtrans order_id |
| POST | `/webhooks/midtrans` | Public | Midtrans callback | SHA512 signature verified |

> **⚠️ Missing Endpoints:** `GET /payments` (list) dan `GET /payments/:id` (detail) belum diimplementasi. Saat ini hanya bisa lookup via `externalId`.

---

# Database Overview

## Entity Relationship

```
tenants (1) ── (N) users
         ├── (N) provider_profiles
         ├── (N) service_categories
         ├── (N) services
         ├── (N) bookings
         ├── (N) payments
         ├── (N) notifications
         ├── (N) slot_holds
         └── (N) cancellation_policies

users (1) ── (N) refresh_tokens
        ├── (0..1) provider_profiles
        ├── (N) bookings (as customer)
        └── (N) notifications

provider_profiles (1) ── (N) provider_schedules
                      ├── (N) provider_breaks
                      ├── (N) services
                      ├── (N) bookings
                      └── (N) slot_holds

service_categories (1) ── (N) services
services (1) ── (N) bookings
           └── (N) slot_holds

bookings (1) ── (1) payments
          ├── (N) booking_status_logs
          └── (N) notifications

slot_holds ── converts to ── bookings
```

## Key Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `tenants` | Multi-tenant root | `id, name, slug, isActive, settings (JSONB)` |
| `users` | All users | `id, tenantId, email, role, authProvider, isActive` |
| `refresh_tokens` | Session management | `id, userId, tokenHash (SHA256), expiresAt, revokedAt` |
| `provider_profiles` | Provider info | `id, userId, tenantId, bio, specialization, ratingAvg` |
| `provider_schedules` | Work hours | `id, providerId, dayOfWeek, startTime, endTime, isActive` |
| `provider_breaks` | Breaks/time-off | `id, providerId, dayOfWeek, breakStart, breakEnd, isRecurring` |
| `service_categories` | Service grouping | `id, tenantId, name, sortOrder` |
| `services` | Service offerings | `id, providerId, categoryId, durationMinutes, price, maxCapacity` |
| `bookings` | Core booking | `id, tenantId, customerId, providerId, status, startTime, endTime, version` |
| `booking_status_logs` | Audit trail | `id, bookingId, previousStatus, newStatus, changedBy, metadata (JSONB)` |
| `slot_holds` | Temporary slot lock | `id, providerId, expiresAt (TTL), isConverted` |
| `payments` | Payment tracking | `id, bookingId, amount, status, externalPaymentId, paidAt` |
| `cancellation_policies` | Cancel rules | `id, tenantId, hoursBeforeFree, lateCancelCharge, noShowCharge` |
| `notifications` | Notification log | `id, userId, channel, status, retryCount` |
| `idempotency_keys` | Anti-duplicate | `id, key, userId, requestHash, responseCode, expiresAt` |

## Enums

```typescript
UserRole: ADMIN | PROVIDER | CUSTOMER | SUPER_ADMIN
AuthProvider: LOCAL | GOOGLE
BookingStatus: PENDING | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW
PaymentStatus: PENDING | SUCCESS | FAILED | REFUNDED | EXPIRED
PaymentMethod: CASH | BANK_TRANSFER | E_WALLET | CREDIT_CARD | ONLINE
NotificationChannel: EMAIL | PUSH | WEBSOCKET | SMS
NotificationStatus: QUEUED | SENT | FAILED | READ
```

---

# External Integrations

| Provider | Purpose | Status | Config |
|----------|---------|--------|--------|
| Midtrans | Payment gateway | ✅ Production Ready | `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION` |
| PostgreSQL | Primary database | ✅ Complete | `DATABASE_URL` |
| Redis | Future: BullMQ queue | 🔄 Planned | `REDIS_URL` |
| Google OAuth | Future: social login | 🔄 Planned | Not configured |

---

# Authentication & Authorization Flow

## Token Flow

```
1. POST /auth/login { email, password, tenantId? }
           ↓
2. Verify credentials (bcrypt compare)
           ↓
3. Delete old refresh tokens (one active token per user)
           ↓
4. Generate JWT access_token (short-lived)
           ↓
5. Generate JWT refresh_token (long-lived)
           ↓
6. SHA256 hash refresh_token, store in DB with metadata
           ↓
7. Return { access_token, refresh_token }
```

## Refresh Token Flow

```
1. access_token expires → Client calls POST /auth/refresh
           ↓
2. SHA256 hash incoming token, lookup in DB
           ↓
3. Verify expiry + revocation status
           ↓
4. Generate new token pair
           ↓
5. Delete old refresh_token, store new one
           ↓
6. Return new { access_token, refresh_token }
```

## Role-Based Access

| Role | Scope | Capabilities |
|------|-------|--------------|
| CUSTOMER | Own tenant | Create hold, booking, view own bookings/payments |
| PROVIDER | Own tenant | View own bookings, confirm/complete, manage own schedule |
| ADMIN | Own tenant | Full CRUD on tenant resources |
| SUPER_ADMIN | All tenants | Manage tenants, providers, view all data |

## Tenant Context

Tenant context di-set via `TenantContextInterceptor` yang membaca `tenantId` dari JWT payload. Semua query menggunakan tenant-scoped filtering. SUPER_ADMIN harus supply `tenantId` query param untuk akses cross-tenant.

---

# Async/Event Flow

## Event Emitter Setup

`EventEmitterModule.forRoot()` di-app.module.ts. Tidak ada event registry terdokumentasi — lihat tabel di bawah untuk events yang aktif.

## Events

| Event | Emitter | Listener | Status |
|-------|---------|----------|--------|
| `booking.created` | BookingService | PaymentService | ✅ Implemented |
| `payment.completed` | PaymentService | (future) NotificationService | ✅ Emits |
| `payment.failed` | PaymentService | (future) NotificationService | ✅ Emits |

## Queue System (Planned)

BullMQ with Redis for async notification processing:
- `notification` queue with processors for email, SMS, push
- Retry mechanism with backoff
- Dead letter queue for failed jobs

---

# Cache/Session Strategy

## Current State

- **No Redis integration yet**
- Session stored in PostgreSQL via `refresh_tokens` table
- Token revocation by deleting hash from DB

## Planned

- Redis for BullMQ (notification queue)
- Redis for caching provider schedules (optimization)
- Redis for rate limiting (ThrottlerModule already exists)

---

# Known Limitations

1. **SlotHold TTL: 15 minutes** — hardcoded, no per-tenant configuration
2. **No capacity per slot** — `maxCapacity` field exists but not enforced in SlotService
3. **No availability calculation** — SlotService doesn't compute available slots from schedules + breaks + existing bookings
4. **No Google OAuth** — AuthProvider enum exists but no implementation
5. **No review/rating system** — `ratingAvg` and `totalReviews` fields exist but not used
6. **No WebSocket real-time** — WEBSOCKET channel in NotificationChannel but not implemented
7. **No HTTP idempotency interceptor** — only webhook idempotency implemented

---

# Future Improvement Direction

## Near Term (1-3 months)

1. **Phase 2c:** Notification Module with BullMQ
2. **Phase 3a:** E2E test infrastructure
3. **Phase 3b:** Jobs module (slot hold cleanup, booking reminder, expired token cleanup)
4. Unit tests for all services

## Medium Term (3-6 months)

1. Google OAuth integration
2. WebSocket real-time notifications
3. Analytics dashboard endpoints
4. Email/SMS provider integrations (SendGrid, Twilio)

## Long Term (6+ months)

1. Multi-language support (i18n)
2. Advanced scheduling (recurring booking, multi-provider)
3. Calendar integration (Google Calendar, iCal)
4. Mobile app backend optimization

---

# Important Engineering Notes

## Security

1. **Webhook Security** — Payment webhook verifies SHA512 signature before processing (line: `payment-webhook.controller.ts:47-56`)
2. **Webhook Idempotency** — Skips processing if payment already in terminal state (line: `payment-webhook.controller.ts:58-71`)
3. **Tenant Isolation** — Always validate `tenantId` from JWT matches query targets
4. **Refresh Token Rotation** — Old tokens revoked on new login (one active token per user)
5. **Password Storage** — bcrypt with salt rounds = 10
6. **Atomic Payment Updates** — Uses `updateMany` to avoid race conditions

## Concurrency

1. **Slot Locking:** 15-minute TTL hold prevents double-booking
2. **Optimistic Locking:** `version` column on bookings for safe updates
3. **Database Transactions:** All booking operations wrapped in `$transaction`
4. **Atomic Webhook Processing:** `updateMany` instead of find + update

## Code Conventions

1. **DTOs** — in module's `dto/` folder, validated with class-validator
2. **Services** — handle business logic
3. **Guards** — `JwtAuthGuard`, `RolesGuard` applied globally via `APP_GUARD`
4. **Interceptors** — `TenantContextInterceptor`, `ResponseFormatterInterceptor`
5. **Filters** — `HttpExceptionFilter` for global exception handling
6. **Generated Enums** — imported from `@generated/enums`
7. **Payment Gateway** — injected via `PAYMENT_GATEWAY` token

---

# Glossary / Domain Terms

| Term | Definition |
|------|------------|
| **Tenant** | Business entity on the platform. Each tenant has isolated data. |
| **Provider** | Service provider (e.g., barber, photographer). Has schedules and breaks. |
| **Slot** | A time period for booking. |
| **SlotHold** | Temporary lock on a slot (15 min TTL) while customer completes booking flow. |
| **Booking** | Confirmed reservation. Created by converting a SlotHold. |
| **CancellationPolicy** | Tenant-level rules for free cancellation period and late cancellation fee. |
| **Version** | Optimistic lock column in bookings table. Incremented on each update. |
| **Refresh Token** | Long-lived token for obtaining new access tokens. Stored hashed in DB. |
| **Idempotency Key** | Client-provided key to prevent duplicate operations. |
| **Payment Gateway** | Abstraction layer for payment providers (Midtrans, Stripe, Mock). |
| **Webhook** | HTTP callback from payment provider to notify payment status. |
| **PAYMENT_GATEWAY** | Injection token for PaymentGateway interface. Enables swap between Mock and Midtrans. |

---

# Appendix: File Structure

```
src/
├── main.ts                      # Bootstrap + global pipes/interceptors/filters
├── app.module.ts                # Root module
├── app.controller.ts            # Health check
├── config/
│   ├── app.config.ts            # App configuration
│   └── database.config.ts       # Prisma service
├── prisma/
│   └── prisma.service.ts        # Database service
├── common/
│   ├── decorators/              # currentUser, roles, public
│   ├── guards/                  # JwtAuthGuard, RolesGuard
│   ├── filters/                 # HttpExceptionFilter
│   ├── interceptors/            # TenantContext, ResponseFormatter
│   └── middleware/              # Logging, TenantContext
├── modules/
│   ├── auth/                    # Auth module
│   ├── tenant/                  # Tenant module
│   ├── provider/                 # Provider + Schedule + Break
│   ├── booking/                  # SlotHold + Booking
│   └── payment/                  # Payment + Webhook
│       ├── gateways/
│       │   ├── payment-gateway.interface.ts  # PAYMENT_GATEWAY token
│       │   ├── mock-payment.gateway.ts
│       │   └── midtrans-payment.gateway.ts   # SHA512 signature
│       ├── types/
│       │   └── midtrans.types.ts             # MidtransNotificationResponse
│       ├── utils/
│       │   └── midtrans-status-mapper.util.ts
│       ├── payment.service.ts   # @OnEvent listener + atomic updates
│       ├── payment.controller.ts
│       └── webhooks/
│           └── payment-webhook.controller.ts # Idempotency + signature
└── generated/
    └── enums/                   # Prisma generated enums

prisma/
├── schema.prisma               # Main schema
├── models/                      # Split model files
│   ├── tenant.prisma
│   ├── user.prisma
│   ├── refreshToken.prisma
│   ├── idempotencyKey.prisma
│   ├── providerProfile.prisma
│   ├── providerSchedule.prisma
│   ├── providerBreak.prisma
│   ├── serviceCategory.prisma
│   ├── service.prisma
│   ├── booking.prisma
│   ├── bookingStatusLog.prisma
│   ├── slotHold.prisma
│   ├── payment.prisma
│   ├── cancellationPolicy.prisma
│   └── notification.prisma
└── migrations/

docs/
├── mermaid/
│   ├── flow-db-mermaid.md
│   └── general/
└── PLAN-AUTH-MULTIPLE.md
```
