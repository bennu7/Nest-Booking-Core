import {
  addMinutes,
  isAfter,
  isBefore,
  isEqual,
  startOfDay,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from 'date-fns';

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
}

export interface SlotCalculatorInput {
  date: Date; // Tanggal untuk menghitung slot
  schedule: {
    // Jadwal provider untuk hari ini (day-of-week)
    startTime: Date; // Hanya waktu (1970-01-01T08:00:00Z)
    endTime: Date; // Hanya waktu (1970-01-01T17:00:00Z)
    isActive: boolean;
  } | null;
  breaks: Array<{
    // Waktu istirahat berulang untuk hari ini
    breakStart: Date | null; // Hanya waktu
    breakEnd: Date | null; // Hanya waktu
  }>;
  existingBookings: Array<{
    // Booking yang aktif pada tanggal ini
    startTime: Date;
    endTime: Date;
  }>;
  existingHolds: Array<{
    // Hold yang aktif (belum expired, belum diconvert)
    startTime: Date;
    endTime: Date;
  }>;
  serviceDurationMinutes: number;
  bufferMinutes: number;
}

/**
 * Helper to combine a date and a time-only Date object
 */
function combineDateAndTime(date: Date, time: Date): Date {
  return setMilliseconds(
    setSeconds(
      setMinutes(
        setHours(startOfDay(date), time.getUTCHours()),
        time.getUTCMinutes(),
      ),
      time.getUTCSeconds(),
    ),
    0,
  );
}

/**
 * Check if two time ranges overlap
 */
function isOverlapping(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return isBefore(startA, endB) && isAfter(endA, startB);
}

export function calculateAvailableSlots(
  input: SlotCalculatorInput,
): TimeSlot[] {
  const {
    date,
    schedule,
    breaks,
    existingBookings,
    existingHolds,
    serviceDurationMinutes,
    bufferMinutes,
  } = input;

  // 1. Jika schedule adalah null atau !schedule.isActive, kembalikan []
  if (!schedule || !schedule.isActive) {
    return [];
  }

  const slots: TimeSlot[] = [];
  const scheduleStart = combineDateAndTime(date, schedule.startTime);
  const scheduleEnd = combineDateAndTime(date, schedule.endTime);
  const totalDuration = serviceDurationMinutes + bufferMinutes;

  // 2. Generate kandidat slot dari jadwal start→end menggunakan serviceDurationMinutes + bufferMinutes sebagai step
  let currentStart = scheduleStart;
  while (
    isBefore(addMinutes(currentStart, serviceDurationMinutes), scheduleEnd) ||
    isEqual(addMinutes(currentStart, serviceDurationMinutes), scheduleEnd)
  ) {
    const currentEnd = addMinutes(currentStart, serviceDurationMinutes);
    const slotWithBufferEnd = addMinutes(currentStart, totalDuration);

    // Pastikan slot (termasuk buffer) tidak melewati batas akhir jadwal
    // Namun, sesuai instruksi, kita hanya perlu mengecek apakah slot itu sendiri (tanpa buffer di akhir) melewati scheduleEnd?
    // Biasanya buffer diletakkan setelah slot. Jika slot + buffer > scheduleEnd, maka slot tersebut tidak valid.
    if (isAfter(slotWithBufferEnd, scheduleEnd)) {
      break;
    }

    const candidateSlot: TimeSlot = {
      startTime: currentStart,
      endTime: currentEnd,
    };

    // 3. Hapus slot yang tumpang tindih (overlap) dengan waktu istirahat (break)
    const overlapsWithBreak = breaks.some((b) => {
      if (!b.breakStart || !b.breakEnd) return false;
      const bStart = combineDateAndTime(date, b.breakStart);
      const bEnd = combineDateAndTime(date, b.breakEnd);
      return isOverlapping(
        candidateSlot.startTime,
        slotWithBufferEnd,
        bStart,
        bEnd,
      );
    });

    // 4. Hapus slot yang tumpang tindih dengan booking yang sudah ada
    const overlapsWithBooking = existingBookings.some((b) =>
      isOverlapping(
        candidateSlot.startTime,
        slotWithBufferEnd,
        b.startTime,
        b.endTime,
      ),
    );

    // 5. Hapus slot yang tumpang tindih dengan hold yang aktif
    const overlapsWithHold = existingHolds.some((h) =>
      isOverlapping(
        candidateSlot.startTime,
        slotWithBufferEnd,
        h.startTime,
        h.endTime,
      ),
    );

    if (!overlapsWithBreak && !overlapsWithBooking && !overlapsWithHold) {
      slots.push(candidateSlot);
    }

    // Pindah ke slot berikutnya (termasuk buffer)
    currentStart = slotWithBufferEnd;
  }

  return slots;
}
