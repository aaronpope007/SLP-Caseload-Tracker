import { describe, it, expect } from '@jest/globals';
import { createStudentSchema, updateStudentSchema } from '../index';

describe('icd10CodesSchema', () => {
  const base = { name: 'Test', age: 8, grade: '2', school: 'School' };

  it('coerces legacy string[] to object entries', () => {
    const r = createStudentSchema.safeParse({
      ...base,
      icd10Codes: ['F80.0', 'F80.1'],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.icd10Codes).toEqual([
      { code: 'F80.0', description: '', primary: false },
      { code: 'F80.1', description: '', primary: false },
    ]);
  });

  it('merges parallel icd10Descriptions into legacy string[]', () => {
    const r = createStudentSchema.safeParse({
      ...base,
      icd10Codes: ['F80.0'],
      icd10Descriptions: ['Phonological disorder'],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.icd10Codes?.[0]).toEqual({
      code: 'F80.0',
      description: 'Phonological disorder',
      primary: false,
    });
  });

  it('accepts new object array shape', () => {
    const r = createStudentSchema.safeParse({
      ...base,
      icd10Codes: [
        { code: 'F80.1', description: 'Expressive', primary: true, startDate: '2024-01-01' },
      ],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.icd10Codes?.[0].primary).toBe(true);
    expect(r.data.icd10Codes?.[0].startDate).toBe('2024-01-01');
  });

  it('partial update coerces string[]', () => {
    const r = updateStudentSchema.safeParse({ icd10Codes: ['F82'] });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.icd10Codes).toEqual([{ code: 'F82', description: '', primary: false }]);
  });
});
