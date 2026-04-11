# Case Study — Nest Booking Core

## The Problem

Banyak bisnis layanan berbasis jadwal — barbershop, studio foto, klinik, konsultan — masih mengelola booking secara manual: lewat WhatsApp, telepon, atau datang langsung. Ini menimbulkan beberapa masalah:

### 1. Double Booking

Dua pelanggan booking di jam yang sama karena pemilik bisnis tidak punya cara real-time untuk cek ketersediaan slot. Hasilnya: satu pelanggan kecewa, reputasi bisnis rusak.

### 2. Tidak Ada Sistem Cancel yang Jelas

Pelanggan batal tanpa kabar, slot kosong terbuang. Bisnis tidak punya aturan kapan cancel gratis dan kapan kena biaya.

### 3. Data Terpusat tapi Tidak Terpisah

Ketika platform booking digunakan banyak bisnis, data pelanggan, jadwal, dan pendapatan sering tercampur. Tidak ada batas jelas antara tenant satu dan lainnya.

### 4. Tidak Ada Notifikasi Otomatis

Pelanggan lupa jadwal booking karena tidak ada reminder. Provider tidak tahu ada booking baru sampai mengecek manual.

---

## The Solution

**Nest Booking Core** adalah backend API yang menjawab semua masalah di atas. Satu platform bisa melayani banyak bisnis (multi-tenant), dengan masing-masing memiliki:

- Data terisolasi — pelanggan, provider, jadwal, dan booking tidak bocor ke tenant lain
- Sistem slot real-time — slot yang sedang dipilih dikunci sementara (15 menit), mencegah double booking
- Kebijakan pembatalan fleksibel — setiap bisnis bisa atur sendiri: "Free cancel 24 jam sebelumnya, setelah itu kena 50%"
- Notifikasi otomatis — email, SMS, push notification saat booking dibuat, dikonfirmasi, atau dibatalkan
- Audit trail — setiap perubahan status booking tercatat: siapa yang mengubah, kapan, dan alasannya

---

## Who Benefits


| Role               | Sebelum Booking Core                                                                   | Setelah Booking Core                                                                           |
| ------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Pelanggan**      | Harus WA/telepon, tidak tahu slot kosong jam berapa, sering ditolak karena sudah penuh | Bisa lihat slot kosong real-time, booking langsung, dapat konfirmasi otomatis                  |
| **Provider**       | Catat manual di buku/kalender, sering bentrok jadwal, tidak ada reminder               | Jadwal rapi di sistem, dapat notifikasi booking baru, tahu kapan tersedia/tidak                |
| **Pemilik Bisnis** | Tidak bisa pantau pendapatan & okupansi real-time, data tercampur jika punya cabang    | Dashboard terpisah per cabang/bisnis, laporan otomatis, bisa atur banyak bisnis dari satu akun |


---

## Why This Project Exists

Bukan sekadar tech showcase. Project ini dibangun karena:

1. **Masalah nyata.** Hampir setiap bisnis jasa mengalami double booking atau no-show. Solusi yang ada (seperti Calendly) terlalu umum dan tidak bisa dikustomisasi untuk kebutuhan spesifik (buffer antar booking, kapasitas per slot, kebijakan cancel khusus).
2. **Multi-tenant itu sulit.** Banyak developer bisa buat CRUD booking untuk satu bisnis. Tapi membuat satu sistem yang bisa melayani ratusan bisnis dengan data terisolasi, policy berbeda, dan performa stabil — itu level yang berbeda.
3. **Concurrency itu nyata.** Dua orang menekan "Book Now" di detik yang sama untuk slot yang sama. Tanpa mekanisme lock yang tepat, keduanya dapat konfirmasi — dan bisnis yang kena masalah.

---

## Technical Decisions


| Keputusan                          | Alasan Bisnis                                                                  | Bukan Karena Trend                                              |
| ---------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **Multi-tenant di satu database**  | Lebih hemat biaya operasional, mudah backup, scaling terpusat | Daripada satu DB per tenant yang mahal dan ribet maintain       |
| **Slot locking (15 menit TTL)**    | Mencegah double booking tanpa memaksa user terburu-buru                        | Daripada "first come first serve" tanpa mekanisme lock          |
| **Queue system untuk notifikasi**  | Email/SMS tidak boleh memperlambat response booking                            | Daripada kirim email synchronous yang bikin user nunggu 5 detik |
| **Audit trail setiap perubahan**   | Saat ada sengketa booking, bisa dilacak siapa yang mengubah                    | Daripada tidak ada bukti saat customer komplain                 |
| **Cancellation policy per tenant** | Setiap bisnis punya aturan berbeda — barbershop vs klinik pasti beda toleransi | Daripada hardcode satu policy untuk semua                       |


---

## What Makes It Stand Out


| Aspek              | Kebanyakan Project                                    | Booking Core                                                                      |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Double Booking** | Tidak ditangani, atau pakai database lock yang lambat | SlotHold dengan TTL + optimistic locking (version column)                         |
| **Multi-Tenant**   | Hanya `tenantId` di tabel, tanpa isolation            | Tenant-scoped queries, tenant-level authorization, tenant activation/deactivation |
| **Notifikasi**     | Kirim langsung di controller                          | BullMQ queue dengan retry, terpisah dari request-response cycle                   |
| **Audit**          | Tidak ada                                             | Setiap perubahan status booking dicatat di `BookingStatusLog`                     |
| **Security**       | Hanya JWT                                             | JWT + Refresh Token rotation + device tracking + tenant context validation        |
| **Idempotency**    | Tidak ada                                             | Idempotency keys mencegah double-processing pada endpoint kritis                  |


---

## Summary

Nest Booking Core adalah jawaban atas pertanyaan: **"Bagaimana membangun sistem booking yang bisa dipakai banyak bisnis, aman dari double booking, dan scalable?"**

Project ini bukan tentang menggunakan teknologi terbaru. Ini tentang menyelesaikan masalah bisnis nyata dengan arsitektur yang bisa dipercaya.

---

> **Untuk Interviewer/Client:** Repository ini berisi backend API. Lihat [README.md](./README.md) untuk gambaran umum, atau [docs/](./docs/) untuk diagram arsitektur dan dokumentasi teknis.

