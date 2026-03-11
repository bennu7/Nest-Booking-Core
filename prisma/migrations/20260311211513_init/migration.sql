-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PROVIDER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'E_WALLET', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH', 'WEBSOCKET', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'READ');

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "total_price" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "notes" TEXT,
    "cancellation_reason" TEXT,
    "cancelled_by" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_logs" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "previous_status" "BookingStatus",
    "new_status" "BookingStatus" NOT NULL,
    "changed_by" TEXT,
    "change_reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancellation_policies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "hours_before_free" INTEGER NOT NULL DEFAULT 24,
    "late_cancel_charge" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "no_show_charge" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cancellation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "user_id" TEXT NOT NULL,
    "request_path" VARCHAR(500) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "response_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "payment_method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "external_ref" VARCHAR(255),
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "refund_amount" DECIMAL(12,2),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_breaks" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "day_of_week" INTEGER,
    "break_start" TIME,
    "break_end" TIME,
    "date_start" DATE,
    "date_end" DATE,
    "reason" VARCHAR(255),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "bio" TEXT,
    "specialization" TEXT,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_schedules" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "buffer_minutes" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "max_capacity" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_holds" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_converted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "address" TEXT,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "full_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "auth_provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "auth_provider_id" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_tenant_id_idx" ON "bookings"("tenant_id");

-- CreateIndex
CREATE INDEX "bookings_customer_id_idx" ON "bookings"("customer_id");

-- CreateIndex
CREATE INDEX "bookings_provider_id_start_time_idx" ON "bookings"("provider_id", "start_time");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_status_idx" ON "bookings"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "bookings_tenant_id_created_at_idx" ON "bookings"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "booking_status_logs_booking_id_idx" ON "booking_status_logs"("booking_id");

-- CreateIndex
CREATE INDEX "booking_status_logs_created_at_idx" ON "booking_status_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cancellation_policies_tenant_id_name_key" ON "cancellation_policies"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_key_idx" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_status_idx" ON "payments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "provider_breaks_provider_id_idx" ON "provider_breaks"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_profiles_user_id_key" ON "provider_profiles"("user_id");

-- CreateIndex
CREATE INDEX "provider_profiles_tenant_id_idx" ON "provider_profiles"("tenant_id");

-- CreateIndex
CREATE INDEX "provider_schedules_provider_id_idx" ON "provider_schedules"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_schedules_provider_id_day_of_week_key" ON "provider_schedules"("provider_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "services_provider_id_idx" ON "services"("provider_id");

-- CreateIndex
CREATE INDEX "services_category_id_idx" ON "services"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_tenant_id_name_key" ON "service_categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "slot_holds_expires_at_idx" ON "slot_holds"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_email_idx" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_logs" ADD CONSTRAINT "booking_status_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellation_policies" ADD CONSTRAINT "cancellation_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_breaks" ADD CONSTRAINT "provider_breaks_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_schedules" ADD CONSTRAINT "provider_schedules_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_holds" ADD CONSTRAINT "slot_holds_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
