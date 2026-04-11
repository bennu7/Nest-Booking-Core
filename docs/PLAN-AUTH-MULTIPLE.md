# Plan — Multiple Auth Providers (Linked)

## Context

Saat ini login password hanya untuk `AuthProvider.LOCAL`. Dokumen ini merencanakan implementasi **linked auth providers** agar user bisa login via multiple method (Local + Google OAuth) dengan aman.

**Status:** Ditunda — bukan prioritas saat ini. Kembali ke sini setelah modul `booking`, `provider`, dan `payment` stabil.

---

## Pendekatan: Linked Providers (Recommended)

User bisa punya multiple auth provider tapi harus **di-link dulu secara eksplisit**. Tanpa link, email sama = beda akun.

### Mengapa?

- **Aman**: Mencegah account takeover — attacker yang punya akses email Google tidak bisa ambil alih akun Local orang lain
- **Fleksibel**: User bisa login via cara manapun yang sudah di-link
- **Audit-friendly**: Setiap provider tercatat, bisa di-unlink kapan saja

---

## 1. Schema Prisma

### Saat Ini (`user.prisma`)

```prisma
model User {
  authProvider   AuthProvider @default(LOCAL) @map("auth_provider")
  authProviderId String?      @map("auth_provider_id") @db.VarChar(255)
  // ...
}
```

### Rencana Perubahan

Pisah ke model terpisah `AuthProviderRecord`:

```prisma
model User {
  passwordHash    String?           @map("password_hash") @db.VarChar(255)
  primaryProvider AuthProvider      @default(LOCAL) @map("auth_provider")
  authProviders   AuthProviderRecord[]
  // ...
}

model AuthProviderRecord {
  id         String         @id @default(uuid())
  userId     String         @map("user_id")
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider   AuthProvider
  providerId String?        @map("provider_id") @db.VarChar(255)  // Google sub
  email      String         @db.VarChar(255)
  linkedAt   DateTime       @default(now()) @map("linked_at")

  @@unique([provider, providerId])   // Google sub unique
  @@unique([userId, provider])        // Satu user, satu Google
  @@map("auth_provider_records")
}
```

### Migration Strategy

- Saat migrate, semua user existing otomatis dapat 1 record `AuthProviderRecord(LOCAL)` via data migration script
- `passwordHash` tetap di `User` (bukan di `AuthProviderRecord`) karena hanya LOCAL yang pakai password
- Field `authProvider` dan `authProviderId` di `User` tetap ada sebagai fallback backward-compat (bisa dihapus nanti)

---

## 2. Flow Register / Login

| Scenario | Behavior |
|----------|----------|
| Register Local baru | Buat `User` + `AuthProviderRecord(LOCAL, email)` |
| Login Local | Cek `User` aktif + verify password |
| Login Google (email belum ada di sistem) | Buat `User` + `AuthProviderRecord(GOOGLE, providerId, email)` |
| Login Google (email ada, tapi **belum linked**) | **Tolak** — beri pesan: *"Email ini terdaftar via Local. Login dulu via Local, lalu hubungkan Google di pengaturan."* |
| Login Google (email ada + **already linked**) | Login sukses, generate token |

---

## 3. Flow Link / Unlink Provider

### Link Google Account

```
POST /api/v1/auth/link/google
→ Redirect ke Google OAuth (user harus sudah login via JWT)
→ Simpan session state untuk callback

GET /api/v1/auth/callback/google/link
→ Google redirect balik dengan code
→ Exchange code → dapatkan profile Google
→ Cek apakah user yang sedang login = email dari Google (atau user confirm)
→ Simpan AuthProviderRecord(GOOGLE, providerId)
→ Redirect ke frontend dengan status "linked"
```

### Unlink Provider

```
DELETE /api/v1/auth/providers/:provider  (provider = "GOOGLE" | "LOCAL")
→ Cek apakah ini satu-satunya provider → tolak jika ya
→ Hapus AuthProviderRecord record
```

### Lihat Linked Providers

```
GET /api/v1/auth/providers
→ Return list provider yang sudah di-link user ini
```

---

## 4. Perubahan di `AuthService`

| Method | Perubahan |
|--------|-----------|
| `register()` | Buat `User` + `AuthProviderRecord(LOCAL)` dalam transaction |
| `loginWithLocal()` | Cek `User` aktif + verify password (pastikan `AuthProviderRecord(LOCAL)` ada) |
| `handleGoogleLogin()` | **Baru** — cek `AuthProviderRecord(GOOGLE)`, resolve ke `User` atau tolak |
| `linkGoogleAccount()` | **Baru** — simpan `AuthProviderRecord(GOOGLE)` untuk user yang sudah login |
| `unlinkProvider()` | **Baru** — hapus `AuthProviderRecord` (validasi: minimal 1 provider tersisa) |
| `getLinkedProviders()` | **Baru** — return list provider user |

---

## 5. Perubahan di `GoogleStrategy`

Perlu **dua strategy/callback terpisah**:

1. **`/auth/google` → `/auth/callback/google`** — untuk login/register (tidak butuh auth guard)
2. **`/auth/link/google` → `/auth/callback/google/link`** — untuk link (butuh auth guard, ambil `userId` dari JWT)

Bisa pakai **satu `GoogleStrategy`** dengan membedakan berdasarkan `state` parameter atau path callback yang berbeda.

---

## 6. Security Considerations

| Risiko | Mitigasi |
|--------|----------|
| Account takeover via Google | Harus login Local dulu sebelum link → tidak bisa claim akun orang lain |
| User unlink semua provider | Validasi minimal 1 provider tersisa |
| Google `providerId` reuse | `@@unique([provider, providerId])` di Prisma |
| Email discrepancy | Saat link, confirm bahwa Google email = Local email (atau beri warning jika beda) |
| Token lama masih valid setelah unlink | Implementasi JWT revocation (sudah ada di backlog) |

---

## 7. Unit Tests yang Perlu Ditambahkan

- [ ] Register Local → cek `User` + `AuthProviderRecord(LOCAL)` tercipta
- [ ] Login Local berhasil / gagal (wrong password, inactive user, no LOCAL provider)
- [ ] Login Google → user baru tercipta
- [ ] Login Google → email ada tapi belum linked → ditolak
- [ ] Login Google → email sudah linked → berhasil
- [ ] Link Google → user belum auth → ditolak (401)
- [ ] Link Google → berhasil → `AuthProviderRecord(GOOGLE)` tercipta
- [ ] Unlink → satu-satunya provider → ditolak
- [ ] Unlink → masih ada provider lain → berhasil

---

## 8. Referensi File yang Akan Berubah

| File | Perubahan |
|------|-----------|
| `prisma/models/user.prisma` | Tambah relasi `authProviders` |
| `prisma/models/authProviderRecord.prisma` | **File baru** |
| `src/modules/auth/auth.service.ts` | Refactor + tambah method baru |
| `src/modules/auth/strategies/google.strategy.ts` | Tambah flow link |
| `src/modules/auth/auth.controller.ts` | Tambah endpoint link/unlink |
| `src/modules/auth/dto/` | DTO untuk link response |
| `src/modules/auth/__tests__/` | Unit tests baru |

---

## 9. Dependencies

Sebelum mulai kerja di sini:
- [ ] Modul `booking` stabil
- [ ] Modul `provider` stabil
- [ ] Modul `payment` stabil (atau minimal skeleton)
- [ ] JWT revocation sudah diimplement (sudah ada di backlog HANDOFF.md)

---

*Dokumen ini dibuat berdasarkan diskusi sesi 11 April 2026. Bisa diupdate sewaktu-waktu.*
