<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# Nest Booking Core

Mesin booking multi-tenant yang dibangun dengan [NestJS](https://nestjs.com/) dan PostgreSQL. Dirancang untuk bisnis yang menawarkan layanan berbasis jadwal dan reservasi.

> **Kenapa project ini ada?** Lihat [CASE-STUDY.md](./CASE-STUDY.md) untuk latar belakang masalah dan keputusan desain.

## Apa yang Dilakukan

Nest Booking Core memungkinkan banyak bisnis (tenant) berjalan di satu platform, masing-masing dengan data terisolasi: layanan, provider, jadwal, dan booking. Pelanggan bisa melihat layanan yang tersedia, memilih waktu, membayar, dan menerima notifikasi di setiap langkah.

## Alur Booking

```mermaid
flowchart TD
    START((Pelanggan Booking)) --> HOLD[Slot Dikunci Sementara 15 menit]
    HOLD --> CHECK{Slot Tersedia?}
    CHECK -->|Ya| CREATE[Booking Dibuat - PENDING]
    CHECK -->|Tidak| EXPIRE[Slot Dilepas - Coba Lagi]
    EXPIRE --> START

    CREATE --> PAY{Metode Bayar?}
    PAY -->|Online| PAY_URL[Redirect ke Payment Gateway]
    PAY -->|Tunai di Tempat| KONFIRMASI[Provider Konfirmasi]

    PAY_URL --> TUNGGU{Pembayaran Berhasil?}
    TUNGGU -->|Ya| BERHASIL[Pembayaran Berhasil]
    TUNGGU -->|Tidak| COBA{Coba Lagi?}
    COBA -->|Ya| PAY_URL
    COBA -->|Tidak| BATAL[Booking Dibatalkan]
    BATAL --> START

    BERHASIL --> KONFIRMASI
    KONFIRMASI --> SELESAI{Provider Tandai Selesai}
    SELESAI -->|Ya| DONE[Booking Selesai]
    SELESAI -->|Tidak| TUNGGU_LAYANAN[Menunggu Provider]

    TUNGGU_LAYANAN --> BATL{Pelanggan Batal?}
    BATL -->|Ya| KEBIJAKAN{Dalam Periode Gratis?}
    KEBIJAKAN -->|Ya| GRATIS[Batal Tanpa Biaya]
    KEBIJAKAN -->|Tidak| DENDA[Denda Keterlambatan]
    BATL -->|Tidak| SELESAI

    DONE --> NOTIF[Kirim Konfirmasi]
    GRATIS --> NOTIF
    DENDA --> NOTIF
    NOTIF --> END((Selesai))
```

## Fitur Utama

**Multi-Tenant** — Banyak bisnis dalam satu platform, masing-masing dengan data, pengaturan, dan kebijakan terpisah.

**Manajemen Layanan & Provider** — Tenant bisa mengatur provider dengan jadwal, jam istirahat, dan layanan yang ditawarkan.

**Ketersediaan Slot Cerdas** — Slot waktu dihitung dari jadwal provider, booking yang sudah ada, hold sementara, dan jam istirahat.

**Penguncian Slot Sementara** — Saat pelanggan memilih slot, slot dikunci sementara untuk mencegah double booking.

**Pelacakan Pembayaran** — Mendukung payment gateway online dan pembayaran tunai, dengan update status via webhook.

**Kebijakan Pembatalan** — Aturan fleksibel per tenant untuk periode bebas biaya dan denda keterlambatan.

**Notifikasi Real-Time** — Email, SMS, push, dan WebSocket notification yang terpicu oleh setiap event booking.

**Audit Trail** — Setiap perubahan status booking dicatat: siapa yang mengubah, kapan, dan alasannya.

## Peran Pengguna

| Peran | Tugas |
|-------|-------|
| **Pelanggan** | Lihat layanan, booking slot, bayar, batal atau reschedule |
| **Provider** | Atur ketersediaan, konfirmasi booking, berikan layanan, tandai selesai |
| **Admin** | Kelola pengaturan tenant, provider, layanan, dan pantau semua booking |
| **Super Admin** | Manajemen level platform — buat tenant, kelola user lintas tenant |

## Diagram Arsitektur

Untuk diagram arsitektur lengkap (system overview, alur auth, alur booking, database ER diagram, dll.), lihat [docs/mermaid/](docs/mermaid/).

<p align="center">
  MIT licensed. Dibangun dengan NestJS, Prisma, dan PostgreSQL.
</p>
