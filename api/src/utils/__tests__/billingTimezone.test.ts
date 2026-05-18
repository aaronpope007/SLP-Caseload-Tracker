import { describe, it, expect } from '@jest/globals';
import { calendarYmdInBillingTz, isYmdInRange } from '../billingTimezone';

describe('billingTimezone', () => {
  it('maps late-evening Central ISO to same calendar day (not UTC next day)', () => {
    // 9 PM Central on 2026-05-17 (CDT, UTC-5) = 2026-05-18T02:00:00.000Z
    expect(calendarYmdInBillingTz('2026-05-18T02:00:00.000Z')).toBe('2026-05-17');
  });

  it('passes through plain YYYY-MM-DD', () => {
    expect(calendarYmdInBillingTz('2026-05-17')).toBe('2026-05-17');
  });

  it('isYmdInRange is inclusive', () => {
    expect(isYmdInRange('2026-05-17', '2026-05-15', '2026-05-17')).toBe(true);
    expect(isYmdInRange('2026-05-18', '2026-05-15', '2026-05-17')).toBe(false);
  });
});
