import { PaymentStatus } from '@generated/enums';

import {
  MidtransTransactionStatus,
  mapMidtransStatusToPaymentStatus,
  shouldAllowRetry,
} from '../../utils/midtrans-status-mapper.util';

describe('mapMidtransStatusToPaymentStatus', () => {
  // ── capture ────────────────────────────────────────────────────────────────

  describe('capture', () => {
    it('returns SUCCESS when fraudStatus is accept', () => {
      expect(
        mapMidtransStatusToPaymentStatus(
          MidtransTransactionStatus.CAPTURE,
          'accept',
        ),
      ).toBe(PaymentStatus.SUCCESS);
    });

    it('returns PENDING when fraudStatus is challenge (manual review needed)', () => {
      expect(
        mapMidtransStatusToPaymentStatus(
          MidtransTransactionStatus.CAPTURE,
          'challenge',
        ),
      ).toBe(PaymentStatus.PENDING);
    });

    it('returns SUCCESS when fraudStatus is undefined', () => {
      expect(
        mapMidtransStatusToPaymentStatus(MidtransTransactionStatus.CAPTURE),
      ).toBe(PaymentStatus.SUCCESS);
    });
  });

  // ── settlement ─────────────────────────────────────────────────────────────

  describe('settlement', () => {
    it('returns SUCCESS', () => {
      expect(
        mapMidtransStatusToPaymentStatus(MidtransTransactionStatus.SETTLEMENT),
      ).toBe(PaymentStatus.SUCCESS);
    });

    it('returns SUCCESS regardless of fraudStatus', () => {
      expect(
        mapMidtransStatusToPaymentStatus(
          MidtransTransactionStatus.SETTLEMENT,
          'challenge',
        ),
      ).toBe(PaymentStatus.SUCCESS);
    });
  });

  // ── deny ───────────────────────────────────────────────────────────────────

  describe('deny', () => {
    it('returns FAILED', () => {
      expect(
        mapMidtransStatusToPaymentStatus(MidtransTransactionStatus.DENY),
      ).toBe(PaymentStatus.FAILED);
    });
  });

  // ── expire ─────────────────────────────────────────────────────────────────

  describe('expire', () => {
    it('returns EXPIRED', () => {
      expect(
        mapMidtransStatusToPaymentStatus(MidtransTransactionStatus.EXPIRE),
      ).toBe(PaymentStatus.EXPIRED);
    });
  });

  // ── cancel ─────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('returns EXPIRED', () => {
      expect(
        mapMidtransStatusToPaymentStatus(MidtransTransactionStatus.CANCEL),
      ).toBe(PaymentStatus.EXPIRED);
    });
  });

  // ── refund ─────────────────────────────────────────────────────────────────

  describe('refund', () => {
    it('returns REFUNDED', () => {
      expect(
        mapMidtransStatusToPaymentStatus(MidtransTransactionStatus.REFUND),
      ).toBe(PaymentStatus.REFUNDED);
    });
  });

  describe('partial_refund', () => {
    it('returns REFUNDED', () => {
      expect(
        mapMidtransStatusToPaymentStatus(
          MidtransTransactionStatus.PARTIAL_REFUND,
        ),
      ).toBe(PaymentStatus.REFUNDED);
    });
  });

  // ── pending ────────────────────────────────────────────────────────────────

  describe('pending', () => {
    it('returns PENDING', () => {
      expect(
        mapMidtransStatusToPaymentStatus(MidtransTransactionStatus.PENDING),
      ).toBe(PaymentStatus.PENDING);
    });
  });

  // ── authorization ──────────────────────────────────────────────────────────

  describe('authorization', () => {
    it('returns PENDING (pre-auth, not yet captured)', () => {
      expect(
        mapMidtransStatusToPaymentStatus(
          MidtransTransactionStatus.AUTHORIZATION,
        ),
      ).toBe(PaymentStatus.PENDING);
    });
  });

  // ── default/unknown ────────────────────────────────────────────────────────

  describe('unknown status', () => {
    it('returns PENDING as safe default', () => {
      expect(
        mapMidtransStatusToPaymentStatus(
          'unknown_status' as MidtransTransactionStatus,
        ),
      ).toBe(PaymentStatus.PENDING);
    });
  });
});

// ─── shouldAllowRetry ─────────────────────────────────────────────────────────

describe('shouldAllowRetry', () => {
  it('returns true for deny', () => {
    expect(shouldAllowRetry(MidtransTransactionStatus.DENY)).toBe(true);
  });

  it('returns true for expire', () => {
    expect(shouldAllowRetry(MidtransTransactionStatus.EXPIRE)).toBe(true);
  });

  it('returns true for cancel', () => {
    expect(shouldAllowRetry(MidtransTransactionStatus.CANCEL)).toBe(true);
  });

  it('returns false for settlement (payment sudah selesai)', () => {
    expect(shouldAllowRetry(MidtransTransactionStatus.SETTLEMENT)).toBe(false);
  });

  it('returns false for capture', () => {
    expect(shouldAllowRetry(MidtransTransactionStatus.CAPTURE)).toBe(false);
  });

  it('returns false for pending (masih dalam proses)', () => {
    expect(shouldAllowRetry(MidtransTransactionStatus.PENDING)).toBe(false);
  });

  it('returns false for refund', () => {
    expect(shouldAllowRetry(MidtransTransactionStatus.REFUND)).toBe(false);
  });

  it('returns false for unknown string', () => {
    expect(shouldAllowRetry('totally_unknown')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(shouldAllowRetry('')).toBe(false);
  });
});
