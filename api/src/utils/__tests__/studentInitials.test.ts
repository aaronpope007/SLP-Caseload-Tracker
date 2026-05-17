import { describe, it, expect } from '@jest/globals';
import { generateInitialsList } from '../studentInitials';

describe('generateInitialsList', () => {
  it('resolves initials+grade collisions by expanding first name', () => {
    const map = generateInitialsList([
      { studentId: '1', name: 'John Smith', grade: '3' },
      { studentId: '2', name: 'Jane Smith', grade: '3' },
    ]);
    expect(map.get('1')).toBe('JOS');
    expect(map.get('2')).toBe('JAS');
  });

  it('starts with first+last initial when unique', () => {
    const map = generateInitialsList([
      { studentId: '1', name: 'Emerie Lee', grade: '2' },
      { studentId: '2', name: 'Charlie Vang', grade: '4' },
    ]);
    expect(map.get('1')).toBe('EL');
    expect(map.get('2')).toBe('CV');
  });
});
