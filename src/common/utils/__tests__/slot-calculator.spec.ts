import {
  calculateAvailableSlots,
  SlotCalculatorInput,
} from '../slot-calculator.util';

describe('SlotCalculator Utility', () => {
  const baseDate = new Date('2025-06-15T00:00:00Z'); // Sunday
  const defaultSchedule = {
    startTime: new Date('1970-01-01T08:00:00Z'),
    endTime: new Date('1970-01-01T17:00:00Z'),
    isActive: true,
  };

  const defaultInput: SlotCalculatorInput = {
    date: baseDate,
    schedule: defaultSchedule,
    breaks: [],
    existingBookings: [],
    existingHolds: [],
    serviceDurationMinutes: 60,
    bufferMinutes: 0,
  };

  it('should return empty array if schedule is null', () => {
    const result = calculateAvailableSlots({ ...defaultInput, schedule: null });
    expect(result).toEqual([]);
  });

  it('should return empty array if schedule is not active', () => {
    const result = calculateAvailableSlots({
      ...defaultInput,
      schedule: { ...defaultSchedule, isActive: false },
    });
    expect(result).toEqual([]);
  });

  it('should return correct slots for simple schedule (08:00-17:00, 60m duration)', () => {
    const result = calculateAvailableSlots(defaultInput);
    expect(result).toHaveLength(9); // 08:00, 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00
    expect(result[0].startTime.toISOString()).toBe('2025-06-15T08:00:00.000Z');
    expect(result[0].endTime.toISOString()).toBe('2025-06-15T09:00:00.000Z');
    expect(result[8].startTime.toISOString()).toBe('2025-06-15T16:00:00.000Z');
    expect(result[8].endTime.toISOString()).toBe('2025-06-15T17:00:00.000Z');
  });

  it('should remove slots overlapping with breaks', () => {
    const result = calculateAvailableSlots({
      ...defaultInput,
      breaks: [
        {
          breakStart: new Date('1970-01-01T12:00:00Z'),
          breakEnd: new Date('1970-01-01T13:00:00Z'),
        },
      ],
    });
    // Slots at 11:00 (ends 12:00) and 13:00 (starts 13:00) should be fine?
    // Wait, if break is 12:00-13:00, the 12:00-13:00 slot overlaps.
    // 08, 09, 10, 11, 13, 14, 15, 16 = 8 slots
    expect(result).toHaveLength(8);
    expect(
      result.find((s) => s.startTime.getUTCHours() === 12),
    ).toBeUndefined();
  });

  it('should remove slots overlapping with existing bookings', () => {
    const result = calculateAvailableSlots({
      ...defaultInput,
      existingBookings: [
        {
          startTime: new Date('2025-06-15T09:30:00Z'),
          endTime: new Date('2025-06-15T10:30:00Z'),
        },
      ],
    });
    // Slot 09:00-10:00 overlaps (ends at 10:00, booking starts at 09:30)
    // Slot 10:00-11:00 overlaps (starts at 10:00, booking ends at 10:30)
    expect(result.find((s) => s.startTime.getUTCHours() === 9)).toBeUndefined();
    expect(
      result.find((s) => s.startTime.getUTCHours() === 10),
    ).toBeUndefined();
    expect(result).toHaveLength(7);
  });

  it('should remove slots overlapping with active holds', () => {
    const result = calculateAvailableSlots({
      ...defaultInput,
      existingHolds: [
        {
          startTime: new Date('2025-06-15T14:00:00Z'),
          endTime: new Date('2025-06-15T15:00:00Z'),
        },
      ],
    });
    expect(
      result.find((s) => s.startTime.getUTCHours() === 14),
    ).toBeUndefined();
    expect(result).toHaveLength(8);
  });

  it('should handle buffer minutes correctly', () => {
    const result = calculateAvailableSlots({
      ...defaultInput,
      serviceDurationMinutes: 45,
      bufferMinutes: 15,
    });
    // (45 + 15) = 60m total. Should be the same number of slots as 60m service.
    expect(result).toHaveLength(9);
    expect(result[0].startTime.toISOString()).toBe('2025-06-15T08:00:00.000Z');
    expect(result[0].endTime.toISOString()).toBe('2025-06-15T08:45:00.000Z');

    // Check if overlap logic works with buffer
    const resultWithBooking = calculateAvailableSlots({
      ...defaultInput,
      serviceDurationMinutes: 45,
      bufferMinutes: 15,
      existingBookings: [
        {
          startTime: new Date('2025-06-15T08:50:00Z'),
          endTime: new Date('2025-06-15T09:30:00Z'),
        },
      ],
    });
    // Slot 08:00-08:45 has buffer until 09:00. Booking 08:50-09:30 overlaps with the buffer (08:00-09:00).
    // So 08:00 slot should be removed.
    expect(
      resultWithBooking.find((s) => s.startTime.getUTCHours() === 8),
    ).toBeUndefined();
  });

  it('should return empty array when all slots are full', () => {
    const result = calculateAvailableSlots({
      ...defaultInput,
      existingBookings: [
        {
          startTime: new Date('2025-06-15T08:00:00Z'),
          endTime: new Date('2025-06-15T17:00:00Z'),
        },
      ],
    });
    expect(result).toEqual([]);
  });
});
