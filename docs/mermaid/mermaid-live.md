# 🗄️ NestJS Booking Core — Database Schema (ER Diagram)

## Entity Relationship Diagram

```mermaid
erDiagram
    %% ============================================
    %% MULTI-TENANCY & AUTH
    %% ============================================

    tenants {
        string id PK "uuid"
        string name "VARCHAR(255)"
        string slug "VARCHAR(100) UNIQUE"
        string email "VARCHAR(255)"
        string phone "VARCHAR(20)"
        text address
        string timezone "VARCHAR(50)"
        text logo_url
        boolean is_active "DEFAULT true"
        jsonb settings "DEFAULT '{}'"
        timestamptz created_at
        timestamptz updated_at
    }

    users {
        string id PK "uuid"
        string tenant_id FK "VARCHAR(255) NULLABLE"
        string email "VARCHAR(255)"
        string password_hash "VARCHAR(255)"
        string full_name "VARCHAR(255)"
        string phone "VARCHAR(20)"
        text avatar_url
        UserRole role "ADMIN | PROVIDER | CUSTOMER | SUPER_ADMIN"
        AuthProvider auth_provider "LOCAL | GOOGLE"
        string auth_provider_id "VARCHAR(255)"
        boolean is_active "DEFAULT true"
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    refresh_tokens {
        string id PK "uuid"
        string user_id FK
        string token_hash "VARCHAR(255) UNIQUE"
        text user_agent
        string ip_address
        timestamptz expires_at
        timestamptz revoked_at
        timestamptz created_at
    }

    idempotency_keys {
        string id PK "uuid"
        string key "VARCHAR(255) UNIQUE"
        string user_id FK
        string request_path "VARCHAR(500)"
        string request_hash "VARCHAR(64)"
        int response_code
        jsonb response_body
        timestamptz created_at
        timestamptz expires_at
    }

    %% ============================================
    %% PROVIDER MANAGEMENT
    %% ============================================

    provider_profiles {
        string id PK "uuid"
        string user_id FK "UNIQUE"
        string tenant_id FK
        text bio
        text specialization
        decimal rating_avg "DECIMAL(3,2)"
        int total_reviews
        boolean is_available "DEFAULT true"
        timestamptz created_at
        timestamptz updated_at
    }

    provider_schedules {
        string id PK "uuid"
        string provider_id FK
        int day_of_week "0-6 (Sun-Sat)"
        time start_time
        time end_time
        boolean is_active "DEFAULT true"
        timestamptz created_at
        timestamptz updated_at
    }

    provider_breaks {
        string id PK "uuid"
        string provider_id FK
        int day_of_week
        time break_start
        time break_end
        date date_start
        date date_end
        string reason "VARCHAR(255)"
        boolean is_recurring "DEFAULT false"
        timestamptz created_at
    }

    %% ============================================
    %% SERVICES
    %% ============================================

    service_categories {
        string id PK "uuid"
        string tenant_id FK
        string name "VARCHAR(255)"
        text description
        int sort_order "DEFAULT 0"
        boolean is_active "DEFAULT true"
        timestamptz created_at
    }

    services {
        string id PK "uuid"
        string provider_id FK
        string category_id FK
        string name "VARCHAR(255)"
        text description
        int duration_minutes
        int buffer_minutes "DEFAULT 0"
        decimal price "DECIMAL(12,2)"
        string currency "VARCHAR(3)"
        int max_capacity "DEFAULT 1"
        boolean is_active "DEFAULT true"
        timestamptz created_at
        timestamptz updated_at
    }

    %% ============================================
    %% BOOKING CORE
    %% ============================================

    bookings {
        string id PK "uuid"
        string tenant_id FK
        string customer_id FK
        string provider_id FK
        string service_id FK
        timestamptz start_time
        timestamptz end_time
        BookingStatus status "PENDING | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW"
        decimal total_price "DECIMAL(12,2)"
        string currency "VARCHAR(3)"
        text notes
        text cancellation_reason
        string cancelled_by FK
        timestamptz cancelled_at
        int version "DEFAULT 1 (optimistic lock)"
        timestamptz created_at
        timestamptz updated_at
    }

    booking_status_logs {
        string id PK "uuid"
        string booking_id FK
        BookingStatus previous_status
        BookingStatus new_status
        string changed_by FK
        text change_reason
        jsonb metadata "DEFAULT '{}'"
        timestamptz created_at
    }

    slot_holds {
        string id PK "uuid"
        string tenant_id FK
        string provider_id FK
        string customer_id FK
        string service_id FK
        timestamptz start_time
        timestamptz end_time
        timestamptz expires_at "TTL"
        boolean is_converted "DEFAULT false"
        timestamptz created_at
    }

    %% ============================================
    %% PAYMENTS & NOTIFICATIONS
    %% ============================================

    payments {
        string id PK "uuid"
        string booking_id FK
        string tenant_id FK
        decimal amount "DECIMAL(12,2)"
        string currency "VARCHAR(3)"
        PaymentMethod payment_method "CASH | BANK_TRANSFER | E_WALLET | CREDIT_CARD"
        PaymentStatus status "PENDING | SUCCESS | FAILED | REFUNDED"
        string external_ref "VARCHAR(255)"
        timestamptz paid_at
        timestamptz refunded_at
        decimal refund_amount "DECIMAL(12,2)"
        jsonb metadata "DEFAULT '{}'"
        timestamptz created_at
        timestamptz updated_at
    }

    cancellation_policies {
        string id PK "uuid"
        string tenant_id FK
        string name "VARCHAR(255)"
        int hours_before_free "DEFAULT 24"
        decimal late_cancel_charge "DECIMAL(5,2)"
        decimal no_show_charge "DECIMAL(5,2)"
        boolean is_default "DEFAULT false"
        timestamptz created_at
    }

    notifications {
        string id PK "uuid"
        string tenant_id FK
        string user_id FK
        string booking_id FK
        NotificationChannel channel "EMAIL | PUSH | WEBSOCKET | SMS"
        string title "VARCHAR(255)"
        text body
        NotificationStatus status "QUEUED | SENT | FAILED | READ"
        timestamptz sent_at
        timestamptz read_at
        text error_message
        int retry_count "DEFAULT 0"
        timestamptz created_at
    }

    %% ============================================
    %% RELATIONSHIPS
    %% ============================================

    %% Tenant Relationships
    tenants }o--o{ users : "has (optional for SUPER_ADMIN)"
    tenants ||--o{ provider_profiles : "has"
    tenants ||--o{ service_categories : "has"
    tenants ||--o{ bookings : "has"
    tenants ||--o{ payments : "has"
    tenants ||--o{ notifications : "has"
    tenants ||--o{ slot_holds : "has"
    tenants ||--o{ cancellation_policies : "has"

    %% User Relationships
    users ||--o{ refresh_tokens : "has"
    users ||--o| provider_profiles : "can be"
    users ||--o{ bookings : "makes as customer"
    users ||--o{ bookings : "cancels"
    users ||--o{ notifications : "receives"
    users ||--o{ slot_holds : "creates"
    users ||--o{ idempotency_keys : "uses"

    %% Provider Relationships
    provider_profiles ||--o{ provider_schedules : "has"
    provider_profiles ||--o{ provider_breaks : "has"
    provider_profiles ||--o{ services : "offers"
    provider_profiles ||--o{ bookings : "receives"
    provider_profiles ||--o{ slot_holds : "holds"

    %% Service Relationships
    service_categories ||--o{ services : "contains"
    services ||--o{ bookings : "booked for"
    services ||--o{ slot_holds : "locked for"

    %% Booking Relationships
    bookings ||--o{ booking_status_logs : "tracks"
    bookings ||--o{ payments : "paid via"
    bookings ||--o{ notifications : "triggers"

    %% Slot Hold Relationships
    slot_holds }o..|| bookings : "converts to"
```

---

## 📊 Table Summary

| #   | Table                   | Purpose                                        | Priority  |
| --- | ----------------------- | ---------------------------------------------- | --------- |
| 1   | `tenants`               | Multi-tenant root organization                 | 🔴 Must   |
| 2   | `users`                 | All users (Admin, Provider, Customer)          | 🔴 Must   |
| 3   | `refresh_tokens`        | JWT refresh token storage & session management | 🔴 Must   |
| 4   | `provider_profiles`     | Provider business profiles                     | 🔴 Must   |
| 5   | `provider_schedules`    | Provider work schedules (recurring)            | 🔴 Must   |
| 6   | `provider_breaks`       | Provider breaks & time off                     | 🟡 Should |
| 7   | `service_categories`    | Service categorization                         | 🟡 Should |
| 8   | `services`              | Services offered by providers                  | 🔴 Must   |
| 9   | `bookings`              | Core booking entity with time slots            | 🔴 Must   |
| 10  | `booking_status_logs`   | Audit trail for booking changes                | 🟡 Should |
| 11  | `slot_holds`            | Temporary slot locking (TTL-based)             | 🔴 Must   |
| 12  | `payments`              | Payment tracking                               | 🟡 Should |
| 13  | `idempotency_keys`      | Anti double-processing                         | 🟢 Nice   |
| 14  | `cancellation_policies` | Configurable cancellation rules                | 🟢 Nice   |
| 15  | `notifications`         | Notification logging                           | 🟡 Should |

---

## 🔑 Key Features

### 1. Multi-Tenancy

- **Strategy**: `tenant_id` column di semua tabel utama
- **Isolation**: Row-level security ready (PostgreSQL RLS)
- **Scalability**: Support 1000+ tenants dalam 1 database

### 2. Double Booking Prevention

- **Application Level**: Slot holds dengan TTL (5 menit)
- **Database Level**: PostgreSQL EXCLUDE constraints (ready untuk ditambahkan)
- **Optimistic Locking**: `version` column di bookings

### 3. Session Management

- **JWT Access Token**: Short-lived (15-30 menit)
- **JWT Refresh Token**: Long-lived, stored in database
- **Token Revocation**: Delete refresh token on logout
- **Device Tracking**: `user_agent` & `ip_address` logged

### 4. Audit Trail

- **Booking Status Changes**: Every status change logged
- **Metadata**: JSONB for flexible context storage
- **Changed By**: Track who made the change

### 5. Real-time Slot Locking

- **Temporary Hold**: 5-minute TTL
- **Auto-expire**: `expires_at` index for cleanup jobs
- **Conversion Tracking**: `is_converted` flag

---

## 📝 Enums

### UserRole

```
ADMIN | PROVIDER | CUSTOMER | SUPER_ADMIN
```

ADMIN | PROVIDER | CUSTOMER

```

### AuthProvider

```

LOCAL | GOOGLE

```

### BookingStatus

```

PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
↘ CANCELLED
↘ NO_SHOW

```

### PaymentStatus

```

PENDING → SUCCESS
→ FAILED
→ REFUNDED

```

### PaymentMethod

```

CASH | BANK_TRANSFER | E_WALLET | CREDIT_CARD

```

### NotificationChannel

```

EMAIL | PUSH | WEBSOCKET | SMS

```

### NotificationStatus

```

QUEUED → SENT → READ
→ FAILED (with retry)

```

---

## 🔗 Links

- [Prisma Schema Files](../prisma/models/)
- [Migration Files](../prisma/migrations/)
- [Database Setup Guide](../DATABASE_SETUP.md)
```
