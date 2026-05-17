import { describe, it, expect } from '@jest/globals';
import { parseStoredIcd10Codes, serializeIcd10ForDb } from '../icd10Codes';

describe('icd10Codes utils', () => {
  it('coerces legacy string[] with parallel descriptions', () => {
    const codes = parseStoredIcd10Codes(
      JSON.stringify(['F80.0', 'F80.1']),
      JSON.stringify(['Phonological disorder', 'Expressive language disorder'])
    );
    expect(codes).toEqual([
      { code: 'F80.0', description: 'Phonological disorder', primary: false, startDate: undefined },
      { code: 'F80.1', description: 'Expressive language disorder', primary: false, startDate: undefined },
    ]);
  });

  it('serializes object array and primary entry', () => {
    const { icd10CodesJson, icd10PrimaryJson } = serializeIcd10ForDb([
      { code: 'F80.1', description: 'Expressive', primary: true, startDate: '2024-01-01' },
      { code: 'F80.9', description: 'Other', primary: false, startDate: undefined },
    ]);
    expect(JSON.parse(icd10CodesJson)).toHaveLength(2);
    expect(JSON.parse(icd10PrimaryJson!)).toMatchObject({
      code: 'F80.1',
      primary: true,
    });
  });

  it('returns null icd10Primary when none marked primary', () => {
    const { icd10PrimaryJson } = serializeIcd10ForDb([
      { code: 'F80.0', description: '', primary: false, startDate: undefined },
    ]);
    expect(icd10PrimaryJson).toBeNull();
  });

  it('round-trips import-codes payload object shape (new + legacy)', () => {
    const newShape = [
      { code: 'F80.0', description: 'Phonological disorder', primary: true },
      { code: 'F80.2', description: 'Mixed receptive-expressive language disorder', primary: false },
    ];
    const { icd10CodesJson, icd10PrimaryJson } = serializeIcd10ForDb(
      parseStoredIcd10Codes(JSON.stringify(newShape), null)
    );
    const roundTrip = parseStoredIcd10Codes(icd10CodesJson, null);
    expect(roundTrip).toEqual([
      { code: 'F80.0', description: 'Phonological disorder', primary: true, startDate: undefined },
      {
        code: 'F80.2',
        description: 'Mixed receptive-expressive language disorder',
        primary: false,
        startDate: undefined,
      },
    ]);
    expect(JSON.parse(icd10PrimaryJson!)).toMatchObject({ code: 'F80.0', primary: true });

    const legacy = parseStoredIcd10Codes(
      JSON.stringify(['F80.1']),
      JSON.stringify(['Expressive language disorder'])
    );
    const legacyDb = serializeIcd10ForDb(legacy);
    expect(parseStoredIcd10Codes(legacyDb.icd10CodesJson, null)).toEqual(legacy);
  });
});
