# Phase 2a — Complete Booking Core

> **Untuk AI Agent:** Eksekusi langkah-langkah secara berurutan. Gunakan `bun test` untuk semua pengujian. JANGAN melompati langkah apa pun.
> **Runtime:** Bun | **Framework:** NestJS | **ORM:** Prisma | **DB:** PostgreSQL

---

## Konteks & Skema Database

### Model yang Sudah Ada (sudah di-migrate)

**Booking** (`bookings`): `id, tenantId, customerId, providerId, serviceId, startTime, endTime, status(BookingStatus), totalPrice, currency, notes, cancellationReason, cancelledBy, cancelledAt, version, createdAt, updatedAt`

**BookingStatusLog** (`booking_status_logs`): `id, bookingId, previousStatus, newStatus, changedBy, changeReason, metadata(Json), createdAt`

**CancellationPolicy** (`cancellation_policies`): `id, tenantId, name, hoursBeforeFree(default:24), lateCancelCharge(default:50%), noShowCharge(default:100%), isDefault, createdAt` — unik pada `[tenantId, name]`

**SlotHold** (`slot_holds`): `id, tenantId, providerId, customerId, serviceId, startTime, endTime, expiresAt, isConverted, createdAt`

**ProviderSchedule** (`provider_schedules`): `id, providerId, dayOfWeek, startTime(Time), endTime(Time), isActive` — unik pada `[providerId, dayOfWeek]`

**ProviderBreak** (`provider_breaks`): `id, providerId, dayOfWeek?, breakStart?(Time), breakEnd?(Time), dateStart?(Date), dateEnd?(Date), reason?, isRecurring`

**Service** (`services`): `id, providerId, categoryId?, name, description?, durationMinutes, bufferMinutes(default:0), price, currency, maxCapacity(default:1), isActive`

**BookingStatus enum:** `PENDING | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED | NO_SHOW`

### Kode yang Sudah Ada

- `BookingService` memiliki: `findManyPaginated`, `findOneOrThrow`
- `SlotService` memiliki: `createHold`, `deleteExpiredHolds`
- `BookingController` memiliki: `GET /bookings`, `GET /bookings/:id`, `POST /bookings/slot-holds`, `POST /bookings/slot-holds/cleanup-expired`
- `booking.fixture.ts` memiliki: `TENANT_A, USER_CUSTOMER, USER_PROVIDER, PROVIDER_PROFILE_ID, BOOKING_ID, SERVICE_ID, currentUserPayload(), listBookingsQueryDto(), createSlotHoldDto(), cleanupExpiredHoldsQueryDto()`
- `seed.helper.ts` memiliki: `seedBooking()`, `seedSlotHold()`, `seedAll()` (mengembalikan `SeedResult` dengan tenant, superAdmin, admin, providerUser, customer, category, providerProfile, service, schedule)

### State Machine Booking

```text
PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
   ↓          ↓            ↓
CANCELLED  CANCELLED   CANCELLED
```

---

## STEP 1 — Slot Calculator Utility (Pure Function)

**Buat:** `src/common/utils/slot-calculator.util.ts`

Sebuah pure function (tanpa DI) yang menghitung slot waktu yang tersedia untuk provider pada tanggal tertentu. Tidak ada pemanggilan database — function ini menerima data yang sudah di-fetch.

### Interface & Function Signature

```typescript
export interface TimeSlot {
  startTime: Date;
  endTime: Date;
}

export interface SlotCalculatorInput {
  date: Date;                           // Tanggal untuk menghitung slot
  schedule: {                           // Jadwal provider untuk hari ini (day-of-week)
    startTime: Date;                    // Hanya waktu (1970-01-01T08:00:00Z)
    endTime: Date;                      // Hanya waktu (1970-01-01T17:00:00Z)
    isActive: boolean;
  } | null;
  breaks: Array<{                      // Waktu istirahat berulang untuk hari ini
    breakStart: Date | null;           // Hanya waktu
    breakEnd: Date | null;             // Hanya waktu
  }>;
  existingBookings: Array<{            // Booking yang aktif pada tanggal ini
    startTime: Date;
    endTime: Date;
  }>;
  existingHolds: Array<{              // Hold yang aktif (belum expired, belum diconvert)
    startTime: Date;
    endTime: Date;
  }>;
  serviceDurationMinutes: number;
  bufferMinutes: number;
}

export function calculateAvailableSlots(input: SlotCalculatorInput): TimeSlot[]
```

### Logika

1. Jika `schedule` adalah null atau `!schedule.isActive`, kembalikan `[]`
2. Generate kandidat slot dari jadwal start→end menggunakan `serviceDurationMinutes + bufferMinutes` sebagai step
3. Hapus slot yang tumpang tindih (overlap) dengan waktu istirahat (break)
4. Hapus slot yang tumpang tindih dengan booking yang sudah ada
5. Hapus slot yang tumpang tindih dengan hold yang aktif
6. Kembalikan sisa slot yang tersedia

### Unit Test

**Buat:** `src/common/utils/__tests__/slot-calculator.spec.ts`

Test cases (~8):
- Mengembalikan array kosong ketika tidak ada jadwal untuk hari tersebut
- Mengembalikan array kosong ketika jadwal tidak aktif
- Mengembalikan slot yang benar untuk jadwal sederhana (08:00-17:00, durasi service 60m)
- Menghapus slot yang overlap dengan break
- Menghapus slot yang overlap dengan existing bookings
- Menghapus slot yang overlap dengan active holds
- Menangani buffer minutes dengan benar
- Mengembalikan array kosong ketika semua slot penuh

**Verifikasi:** `bun test slot-calculator`

---

## STEP 2 — CancellationPolicy CRUD (TenantModule)

### 2a. Buat DTOs

**Buat:** `src/modules/tenant/dto/create-cancellation-policy.dto.ts`

```typescript
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCancellationPolicyDto {
  @IsString()
  name!: string;

  @IsOptional() @IsInt() @Min(0)
  hoursBeforeFree?: number;            // default 24

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  lateCancelCharge?: number;           // default 50 (persentase)

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  noShowCharge?: number;               // default 100 (persentase)

  @IsOptional() @IsBoolean()
  isDefault?: boolean;
}
```

**Buat:** `src/modules/tenant/dto/update-cancellation-policy.dto.ts`

Gunakan `PartialType(CreateCancellationPolicyDto)` dari `@nestjs/mapped-types`.

### 2b. Tambah Service Methods ke `TenantService`

**Ubah:** `src/modules/tenant/tenant.service.ts` — tambahkan methods ini:

- `createCancellationPolicy(tenantId: string, dto: CreateCancellationPolicyDto)` — periksa keunikan nama dalam tenant (unique constraint `[tenantId, name]`); jika `isDefault=true`, unset default yang lain terlebih dahulu; create lalu return
- `findCancellationPolicies(tenantId: string)` — return semua policy untuk tenant diurutkan berdasarkan `createdAt asc`
- `updateCancellationPolicy(id: string, tenantId: string, dto: UpdateCancellationPolicyDto)` — verifikasi kepemilikan via `tenantId`; jika mengatur `isDefault=true`, unset yang lain terlebih dahulu; update lalu return
- `deleteCancellationPolicy(id: string, tenantId: string)` — verifikasi kepemilikan; delete lalu return
- `findDefaultCancellationPolicy(tenantId: string)` — return default policy (dimana `isDefault=true`) atau null; **export method ini untuk digunakan oleh BookingService**

### 2c. Tambah Controller Endpoints ke `TenantController`

**Ubah:** `src/modules/tenant/tenant.controller.ts` — tambahkan endpoints:

| Method | Path | Roles | Handler |
|--------|------|-------|---------|
| POST | `cancellation-policies` | ADMIN, SUPER_ADMIN | `createCancellationPolicy` |
| GET | `cancellation-policies` | ADMIN, SUPER_ADMIN | `getCancellationPolicies` |
| PATCH | `cancellation-policies/:id` | ADMIN, SUPER_ADMIN | `updateCancellationPolicy` |
| DELETE | `cancellation-policies/:id` | ADMIN, SUPER_ADMIN | `deleteCancellationPolicy` |

Semuanya membutuhkan `user.tenantId` (throw `BadRequestException` jika tidak ada).

### 2d. Unit Tests

**Ubah:** `src/modules/tenant/__tests__/fixtures/tenant.fixture.ts` — tambahkan factory functions: `createCancellationPolicyDto()`, `updateCancellationPolicyDto()`, `makeCancellationPolicy()`

**Ubah:** `src/modules/tenant/__tests__/unit/tenant.service.spec.ts` — tambahkan `describe('createCancellationPolicy')` dsb. Tambahkan `cancellationPolicy` mock ke prisma mock. (~8 test cases)

**Ubah:** `src/modules/tenant/__tests__/unit/tenant.controller.spec.ts` — tambahkan test untuk 4 endpoint baru tersebut (~4 test cases)

**Verifikasi:** `bun test tenant`

### 2e. E2E Tests

**Ubah:** `test/e2e/tenant.e2e-spec.ts` — tambahkan section untuk endpoint cancellation policy (~6 test cases):
- 201 — ADMIN create cancellation policy
- 200 — ADMIN list cancellation policies
- 200 — ADMIN update cancellation policy
- 200 — ADMIN delete cancellation policy
- 403 — CUSTOMER tidak bisa create cancellation policy
- 400 — nama duplikat dalam satu tenant

**Verifikasi:** `bun test ./test/e2e/tenant.e2e-spec.ts`

---

## STEP 3 — Create Booking (Convert SlotHold → Booking)

### 3a. Buat DTO

**Buat:** `src/modules/booking/dto/create-booking.dto.ts`

```typescript
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  slotHoldId!: string;

  @IsOptional() @IsString()
  notes?: string;
}
```

**Ubah:** `src/modules/booking/dto/index.ts` — tambahkan export untuk `CreateBookingDto`

### 3b. Tambah `createBooking` ke `BookingService`

**Ubah:** `src/modules/booking/booking.service.ts`

Method: `async createBooking(user: CurrentUserPayload, dto: CreateBookingDto)`

Logika:
1. Wajibkan `user.role === CUSTOMER` dan `user.tenantId` harus ada
2. Cari `SlotHold` berdasarkan `dto.slotHoldId` di mana `isConverted=false` dan `customerId=user.id` dan `tenantId=user.tenantId`
3. Jika tidak ditemukan → `NotFoundException('Slot hold not found or already converted')`
4. Jika `slotHold.expiresAt < now` → `BadRequestException('Slot hold has expired')`
5. Periksa konflik booking: cari `Booking` mana saja dengan `providerId` yang sama, rentang waktu yang overlap, dan status BUKAN `[CANCELLED, NO_SHOW]`
6. Jika ada konflik → `BadRequestException('Time slot conflict with existing booking')`
7. Fetch `Service` untuk mendapatkan `price` yang akan digunakan pada `totalPrice`
8. Gunakan `prisma.$transaction` untuk:
   - Buat `Booking` (status `PENDING`, `totalPrice` dari service.price)
   - Update `SlotHold` set `isConverted = true`
   - Buat `BookingStatusLog` (previousStatus: null, newStatus: PENDING, changedBy: user.id)
9. Return booking yang baru dibuat berserta includes-nya

### 3c. Tambah Controller Endpoint

**Ubah:** `src/modules/booking/booking.controller.ts`

```typescript
@Roles(UserRole.CUSTOMER)
@Post()
async create(
  @CurrentUser() user: CurrentUserPayload,
  @Body() dto: CreateBookingDto,
) {
  const result = await this.bookingService.createBooking(user, dto);
  return new ApiResponse({
    code: HttpStatus.CREATED,
    message: 'Booking created successfully',
    data: result,
  });
}
```

### 3d. Unit Tests

**Ubah:** `src/modules/booking/__tests__/fixtures/booking.fixture.ts` — tambahkan:
- konstanta `SLOT_HOLD_ID`
- factory `createBookingDto()`
- factory `makeSlotHold()`
- factory `makeBooking()` (dengan status, totalPrice, dll.)
- factory `makeBookingStatusLog()`

**Ubah:** `src/modules/booking/__tests__/unit/booking.service.spec.ts` — tambahkan `describe('createBooking')` dengan test cases (~8):
- melempar ForbiddenException ketika user bukan CUSTOMER
- melempar BadRequestException ketika tenantId tidak ada
- melempar NotFoundException ketika slot hold tidak ditemukan
- melempar NotFoundException ketika slot hold sudah diconvert
- melempar BadRequestException ketika slot hold sudah expired
- melempar BadRequestException ketika time slot konflik
- berhasil membuat booking dan menandai hold sebagai converted
- membuat entri BookingStatusLog

**Ubah:** `src/modules/booking/__tests__/unit/booking.controller.spec.ts` — tambahkan test untuk `POST /bookings` (~1 test)

**Verifikasi:** `bun test booking`

### 3e. E2E Tests

**Ubah:** `test/e2e/booking.e2e-spec.ts` — tambahkan section `POST /api/v1/bookings` (~5 test cases):
- 201 — CUSTOMER membuat booking dari slot hold yang valid
- 400 — slot hold expired
- 404 — slot hold tidak ditemukan
- 403 — ADMIN tidak bisa membuat booking
- 401 — tanpa JWT

Gunakan `seedSlotHold()` dari `seed.helper.ts` untuk membuat test data.

**Verifikasi:** `bun test ./test/e2e/booking.e2e-spec.ts`

---

## STEP 4 — Confirm Booking

### 4a. Buat DTO

**Buat:** `src/modules/booking/dto/update-booking-status.dto.ts`

```typescript
import { IsOptional, IsString } from 'class-validator';

export class UpdateBookingStatusDto {
  @IsOptional() @IsString()
  reason?: string;
}
```

**Ubah:** `src/modules/booking/dto/index.ts` — tambahkan export

### 4b. Tambah `confirmBooking` ke `BookingService`

**Ubah:** `src/modules/booking/booking.service.ts`

Method: `async confirmBooking(user: CurrentUserPayload, bookingId: string, dto: UpdateBookingStatusDto)`

Logika:
1. Panggil `findOneOrThrow(user, bookingId)` untuk memvalidasi akses
2. Jika `booking.status !== PENDING` → `BadRequestException('Only PENDING bookings can be confirmed')`
3. Wajibkan role user adalah ADMIN, PROVIDER, atau SUPER_ADMIN
4. Gunakan `prisma.$transaction`:
   - Update booking `status = CONFIRMED`
   - Buat `BookingStatusLog` (previousStatus: PENDING, newStatus: CONFIRMED, changedBy: user.id, changeReason: dto.reason)
5. Return booking yang sudah di-update

### 4c. Tambah Controller Endpoint

**Ubah:** `src/modules/booking/booking.controller.ts`

```typescript
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PROVIDER)
@Patch(':id/confirm')
async confirm(
  @CurrentUser() user: CurrentUserPayload,
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: UpdateBookingStatusDto,
) { ... }
```

### 4d. Unit Tests

**Ubah:** `src/modules/booking/__tests__/unit/booking.service.spec.ts` — tambahkan `describe('confirmBooking')` (~4 tests):
- melempar NotFoundException ketika booking tidak ditemukan
- melempar BadRequestException ketika status bukan PENDING
- mengkonfirmasi booking dan membuat status log
- melempar ForbiddenException untuk CUSTOMER

**Verifikasi:** `bun test booking`

### 4e. E2E Tests

**Ubah:** `test/e2e/booking.e2e-spec.ts` — tambahkan section `PATCH /api/v1/bookings/:id/confirm` (~4 tests):
- 200 — ADMIN mengkonfirmasi pending booking
- 400 — tidak bisa mengkonfirmasi booking yang sudah dikonfirmasi
- 403 — CUSTOMER tidak bisa melakukan konfirmasi
- 404 — booking tidak ditemukan

Buat test booking via `seedBooking()` dengan `status: 'PENDING'`.

**Verifikasi:** `bun test ./test/e2e/booking.e2e-spec.ts`

---

## STEP 5 — Cancel Booking

### 5a. Tambah `cancelBooking` ke `BookingService`

**Ubah:** `src/modules/booking/booking.service.ts`

Method: `async cancelBooking(user: CurrentUserPayload, bookingId: string, dto: UpdateBookingStatusDto)`

Logika:
1. Panggil `findOneOrThrow(user, bookingId)` untuk memvalidasi akses
2. Jika `booking.status` adalah `CANCELLED`, `COMPLETED`, atau `NO_SHOW` → `BadRequestException('Cannot cancel this booking')`
3. Tentukan refund: jika tenant memiliki default CancellationPolicy, cek `hoursBeforeFree` terhadap `booking.startTime - now`. Hitung `refundAmount` berdasarkan persentase `lateCancelCharge` yang diterapkan pada `totalPrice`. (Untuk saat ini, simpan kalkulasi jumlah refund di status log metadata — actual refund pembayaran ada di Phase 2b)
4. Gunakan `prisma.$transaction`:
   - Update booking: `status = CANCELLED`, `cancelledBy = user.id`, `cancelledAt = new Date()`, `cancellationReason = dto.reason`
   - Buat `BookingStatusLog` (previousStatus → CANCELLED, changedBy, changeReason, metadata: `{ refundAmount, policyApplied }`)
5. Return booking yang sudah di-update

**Import yang dibutuhkan:** Service perlu mengakses `CancellationPolicy` via PrismaService. Tidak perlu cross-module import karena ini hanya query Prisma biasa.

### 5b. Tambah Controller Endpoint

**Ubah:** `src/modules/booking/booking.controller.ts`

```typescript
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PROVIDER, UserRole.CUSTOMER)
@Patch(':id/cancel')
async cancel(...) { ... }
```

### 5c. Unit Tests

**Ubah:** `src/modules/booking/__tests__/unit/booking.service.spec.ts` — tambahkan `describe('cancelBooking')` (~5 tests):
- melempar error ketika booking sudah di-cancel
- melempar error ketika booking sudah completed
- melakukan cancel pada PENDING booking (free cancel, no charge)
- melakukan cancel pada CONFIRMED booking dengan late cancel charge (mock cancellation policy)
- mengeset cancelledBy dan cancellationReason dengan benar

**Verifikasi:** `bun test booking`

### 5d. E2E Tests

**Ubah:** `test/e2e/booking.e2e-spec.ts` — tambahkan section `PATCH /api/v1/bookings/:id/cancel` (~4 tests):
- 200 — CUSTOMER membatalkan booking miliknya sendiri
- 200 — ADMIN membatalkan booking
- 400 — tidak bisa membatalkan booking yang sudah dibatalkan
- 404 — booking tidak ditemukan

**Verifikasi:** `bun test ./test/e2e/booking.e2e-spec.ts`

---

## STEP 6 — Complete Booking

### 6a. Tambah `completeBooking` ke `BookingService`

Method: `async completeBooking(user: CurrentUserPayload, bookingId: string, dto: UpdateBookingStatusDto)`

Logika:
1. Panggil `findOneOrThrow(user, bookingId)` untuk memvalidasi akses
2. Jika `booking.status !== CONFIRMED && booking.status !== IN_PROGRESS` → `BadRequestException('Only CONFIRMED or IN_PROGRESS bookings can be completed')`
3. Wajibkan role user adalah ADMIN, PROVIDER, atau SUPER_ADMIN
4. Gunakan `prisma.$transaction`:
   - Update booking `status = COMPLETED`
   - Buat `BookingStatusLog`
5. Return booking yang sudah di-update

### 6b. Tambah Controller Endpoint

```typescript
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PROVIDER)
@Patch(':id/complete')
async complete(...) { ... }
```

### 6c. Unit Tests

Tambahkan `describe('completeBooking')` (~4 tests):
- melempar error ketika booking berstatus PENDING (harus dikonfirmasi terlebih dahulu)
- melempar error ketika sudah completed
- berhasil complete pada CONFIRMED booking
- membuat entri status log

**Verifikasi:** `bun test booking`

### 6d. E2E Tests

Tambahkan section `PATCH /api/v1/bookings/:id/complete` (~3 tests):
- 200 — ADMIN menyelesaikan confirmed booking
- 400 — tidak bisa menyelesaikan pending booking
- 403 — CUSTOMER tidak bisa menyelesaikan booking

**Verifikasi:** `bun test ./test/e2e/booking.e2e-spec.ts`

---

## STEP 7 — Provider Availability Endpoint

### 7a. Buat DTO

**Buat:** `src/modules/provider/dto/availability-query.dto.ts`

```typescript
import { IsDateString } from 'class-validator';

export class AvailabilityQueryDto {
  @IsDateString()
  date!: string;   // misal: "2025-06-15"
}
```

**Ubah:** `src/modules/provider/dto/index.ts` — tambahkan export

### 7b. Tambah `getAvailability` ke `ProviderService` (atau buat `AvailabilityService`)

**Ubah:** `src/modules/provider/provider.service.ts`

Method: `async getAvailability(providerId: string, date: string, serviceId?: string)`

Logika:
1. Cari provider, lempar NotFoundException jika tidak ditemukan
2. Parse `date` → tentukan `dayOfWeek` (0=Minggu, 1=Senin, ...)
3. Query `ProviderSchedule` berdasarkan `providerId` dan `dayOfWeek`
4. Query `ProviderBreak` berdasarkan `providerId` dan (recurring dengan `dayOfWeek` yang cocok ATAU one-time yang overlap dengan tanggal tersebut)
5. Query `Booking` aktif berdasarkan `providerId`, rentang tanggal, status BUKAN `[CANCELLED, NO_SHOW]`
6. Query `SlotHold` aktif berdasarkan `providerId`, rentang tanggal, `isConverted=false`, `expiresAt > now`
7. Jika `serviceId` diberikan, fetch `durationMinutes` dan `bufferMinutes` dari service; jika tidak gunakan default 60/0
8. Panggil `calculateAvailableSlots(...)` dari `slot-calculator.util.ts`
9. Return `{ date, providerId, slots: TimeSlot[] }`

### 7c. Tambah Controller Endpoint

**Ubah:** `src/modules/provider/provider.controller.ts`

```typescript
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PROVIDER, UserRole.CUSTOMER)
@Get(':id/availability')
async getAvailability(
  @Param('id') providerId: string,
  @Query() query: AvailabilityQueryDto,
  @Query('serviceId') serviceId?: string,
) { ... }
```

> **Catatan:** Tempatkan route ini SEBELUM `@Get(':id')` untuk menghindari route conflict.

### 7d. Unit Tests

**Ubah:** `src/modules/provider/__tests__/unit/provider.service.spec.ts` — tambahkan `describe('getAvailability')` (~4 tests):
- melempar NotFoundException ketika provider tidak ditemukan
- mengembalikan slots kosong ketika tidak ada jadwal di hari tersebut
- mengembalikan slots yang tersedia (available) dengan benar
- mengabaikan/menghapus slot yang sudah di-booking atau sedang di-hold

**Verifikasi:** `bun test provider`

### 7e. E2E Tests

**Ubah:** `test/e2e/provider.e2e-spec.ts` — tambahkan section `GET /api/v1/providers/:id/availability` (~3 tests):
- 200 — mengembalikan slot yang tersedia untuk tanggal tertentu
- 200 — mengembalikan array kosong ketika provider tidak memiliki jadwal
- 404 — provider tidak ditemukan

**Verifikasi:** `bun test ./test/e2e/provider.e2e-spec.ts`

---

## STEP 8 — Update Seed Helpers

**Ubah:** `test/helpers/seed.helper.ts` — tambahkan:

```typescript
export async function seedCancellationPolicy(
  prisma: PrismaService,
  tenantId: string,
  overrides: Record<string, unknown> = {},
) {
  return prisma.cancellationPolicy.create({
    data: {
      tenantId,
      name: 'Default Policy',
      hoursBeforeFree: 24,
      lateCancelCharge: 50,
      noShowCharge: 100,
      isDefault: true,
      ...overrides,
    },
  });
}
```

**Ubah:** Interface `SeedResult` — tambahkan field `cancellationPolicy`.

**Ubah:** `seedAll()` — panggil `seedCancellationPolicy` di Level 1 (FK → Tenant only) dan sertakan pada return object.

**Verifikasi:** `bun test ./test/e2e/booking.e2e-spec.ts` (jalankan ulang untuk memastikan seed masih bekerja)

---

## STEP 9 — Full Integration E2E Flow Test

**Ubah:** `test/e2e/flows.e2e-spec.ts` — tambahkan flow lifecycle booking lengkap:

```typescript
describe('Booking Lifecycle Flow', () => {
  it('complete flow: slot-hold → booking → confirm → complete', async () => {
    // 1. CUSTOMER membuat slot hold
    // 2. CUSTOMER mengkonversi slot hold menjadi booking (POST /bookings)
    // 3. ADMIN mengkonfirmasi booking (PATCH /bookings/:id/confirm)
    // 4. ADMIN menyelesaikan booking (PATCH /bookings/:id/complete)
    // Lakukan assert pada setiap status response dan transisi status booking
  });

  it('cancellation flow: slot-hold → booking → cancel with policy', async () => {
    // 1. CUSTOMER membuat slot hold
    // 2. CUSTOMER mengkonversi menjadi booking
    // 3. CUSTOMER membatalkan booking (PATCH /bookings/:id/cancel)
    // Lakukan assert field cancellation telah di-set dengan benar
  });
});
```

**Verifikasi:** `bun test ./test/e2e/flows.e2e-spec.ts`

---

## STEP 10 — Final Verification

Jalankan semua pemeriksaan secara berurutan:

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Semua unit tests
bun test src/

# 3. Semua E2E tests
bun test ./test/e2e/

# 4. Keseluruhan test suite
bun test
```

Semuanya harus lulus dengan 0 kegagalan (failures).

---

## Ringkasan File untuk Dibuat/Diubah

### File Baru
| File | Deskripsi |
|------|-------------|
| `src/common/utils/slot-calculator.util.ts` | Pure function: hitung slot tersedia |
| `src/common/utils/__tests__/slot-calculator.spec.ts` | Unit tests untuk slot calculator |
| `src/modules/tenant/dto/create-cancellation-policy.dto.ts` | DTO |
| `src/modules/tenant/dto/update-cancellation-policy.dto.ts` | DTO |
| `src/modules/booking/dto/create-booking.dto.ts` | DTO |
| `src/modules/booking/dto/update-booking-status.dto.ts` | DTO |
| `src/modules/provider/dto/availability-query.dto.ts` | DTO |

### File yang Diubah
| File | Perubahan |
|------|---------|
| `src/modules/tenant/tenant.service.ts` | Tambah 5 metode CancellationPolicy |
| `src/modules/tenant/tenant.controller.ts` | Tambah 4 endpoint CancellationPolicy |
| `src/modules/booking/booking.service.ts` | Tambah `createBooking`, `confirmBooking`, `cancelBooking`, `completeBooking` |
| `src/modules/booking/booking.controller.ts` | Tambah `POST /`, `PATCH /:id/confirm`, `PATCH /:id/cancel`, `PATCH /:id/complete` |
| `src/modules/booking/dto/index.ts` | Export DTO baru |
| `src/modules/provider/provider.service.ts` | Tambah `getAvailability` |
| `src/modules/provider/provider.controller.ts` | Tambah `GET /:id/availability` |
| `src/modules/provider/dto/index.ts` | Export DTO baru |
| `src/modules/booking/__tests__/fixtures/booking.fixture.ts` | Tambah factories |
| `src/modules/booking/__tests__/unit/booking.service.spec.ts` | Tambah ~21 test cases |
| `src/modules/booking/__tests__/unit/booking.controller.spec.ts` | Tambah ~4 test cases |
| `src/modules/tenant/__tests__/fixtures/tenant.fixture.ts` | Tambah factories |
| `src/modules/tenant/__tests__/unit/tenant.service.spec.ts` | Tambah ~8 test cases |
| `src/modules/tenant/__tests__/unit/tenant.controller.spec.ts` | Tambah ~4 test cases |
| `src/modules/provider/__tests__/unit/provider.service.spec.ts` | Tambah ~4 test cases |
| `test/helpers/seed.helper.ts` | Tambah `seedCancellationPolicy`, update `seedAll` |
| `test/e2e/tenant.e2e-spec.ts` | Tambah ~6 cancellation policy tests |
| `test/e2e/booking.e2e-spec.ts` | Tambah ~16 booking lifecycle tests |
| `test/e2e/provider.e2e-spec.ts` | Tambah ~3 availability tests |
| `test/e2e/flows.e2e-spec.ts` | Tambah 2 lifecycle flow tests |

### Estimasi Jumlah Test
| Area | Test Baru |
|------|-----------|
| Slot Calculator Unit | ~8 |
| CancellationPolicy Unit (service+controller) | ~12 |
| Booking Core Unit (service+controller) | ~25 |
| Provider Availability Unit | ~4 |
| E2E Tenant | ~6 |
| E2E Booking | ~16 |
| E2E Provider | ~3 |
| E2E Flows | ~2 |
| **Total** | **~76 test baru** |
