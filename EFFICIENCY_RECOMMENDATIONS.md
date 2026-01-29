# Efficiency & Performance Recommendations

*Generated: January 28, 2026*

This document outlines efficiency improvements and optimizations recommended for the SLP Caseload Tracker application.

---

## 🚀 High Impact Improvements

### 1. **Bulk Operations Efficiency** ⚠️ CRITICAL
**Current Issue:** `saveStudents`, `saveGoals`, `saveSessions`, etc. in `storage-api.ts` make sequential API calls in loops.

**Location:** `src/utils/storage-api.ts` (lines 43-58, 100-112, 155-167, etc.)

**Impact:**
- Very slow for large batches (100+ items = 100+ sequential requests)
- Poor error handling (one failure doesn't stop the rest)
- No progress feedback
- Network overhead

**Recommendation:**
1. **Backend:** Create bulk endpoints:
   ```typescript
   POST /api/students/bulk
   POST /api/goals/bulk
   POST /api/sessions/bulk
   ```
2. **Frontend:** Update `storage-api.ts` to use bulk endpoints:
   ```typescript
   export const saveStudents = async (students: Student[]): Promise<void> => {
     await api.students.bulkUpdate(students);
   };
   ```
3. **Alternative:** Use `Promise.all()` with batching (e.g., 10 at a time) if bulk endpoints aren't feasible

**Estimated Effort:** 2-3 hours (backend + frontend)
**Priority:** 🔴 HIGH

---

### 2. **Data Fetching & Caching** ⚠️ HIGH VALUE
**Current Issue:** No centralized data fetching library. Components fetch independently, causing:
- Duplicate requests
- No caching
- Stale data
- Manual refetching

**Impact:**
- Redundant network requests
- Slower perceived performance
- More complex state management

**Recommendation:** Add **React Query** (TanStack Query)
```bash
pnpm add @tanstack/react-query
```

**Benefits:**
- Automatic request deduplication
- Built-in caching (configurable TTL)
- Background refetching
- Optimistic updates
- Request cancellation
- Error retry logic

**Example Migration:**
```typescript
// Before
const [students, setStudents] = useState<Student[]>([]);
useEffect(() => {
  getStudents(school).then(setStudents);
}, [school]);

// After
const { data: students, isLoading } = useQuery({
  queryKey: ['students', school],
  queryFn: () => getStudents(school),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**Estimated Effort:** 4-6 hours (setup + migrate key components)
**Priority:** 🟡 MEDIUM-HIGH

---

### 3. **Request Deduplication** 
**Current Issue:** Multiple components may fetch the same data simultaneously (e.g., Dashboard and Students page both fetching students).

**Quick Fix:** Create a simple request cache:
```typescript
// src/utils/requestCache.ts
const pendingRequests = new Map<string, Promise<any>>();

export function dedupeRequest<T>(
  key: string,
  request: () => Promise<T>
): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }
  const promise = request().finally(() => {
    pendingRequests.delete(key);
  });
  pendingRequests.set(key, promise);
  return promise;
}
```

**Better Solution:** Use React Query (see #2)

**Estimated Effort:** 1 hour (quick fix) or included in React Query migration
**Priority:** 🟡 MEDIUM

---

### 4. **Search Input Debouncing**
**Current Issue:** Search inputs trigger filtering on every keystroke, causing unnecessary re-renders.

**Location:** `src/pages/Students.tsx`, `src/components/goal/GoalSearchBar.tsx`, etc.

**Recommendation:** Add debouncing to search inputs:
```typescript
import { useDebouncedValue } from './hooks/useDebouncedValue';

const [searchTerm, setSearchTerm] = useState('');
const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

// Use debouncedSearchTerm for filtering
```

**Create Hook:**
```typescript
// src/hooks/useDebouncedValue.ts
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

**Estimated Effort:** 1 hour
**Priority:** 🟡 MEDIUM

---

## 🎯 Medium Impact Improvements

### 5. **Optimistic Updates**
**Current Issue:** UI only updates after API success, causing perceived lag.

**Recommendation:** Implement optimistic updates for common operations:
- Toggle todo completion
- Update goal status
- Mark session as completed

**Example:**
```typescript
const updateGoal = async (id: string, updates: Partial<Goal>) => {
  // Optimistically update UI
  setGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  
  try {
    await api.goals.update(id, updates);
  } catch (error) {
    // Revert on error
    loadGoals();
    throw error;
  }
};
```

**Estimated Effort:** 2-3 hours
**Priority:** 🟢 LOW-MEDIUM

---

### 6. **Error Retry Logic**
**Current Issue:** Network errors fail immediately without retry.

**Recommendation:** Add retry logic with exponential backoff:
```typescript
// src/utils/retry.ts
export async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

**Better:** Use React Query (includes retry logic)

**Estimated Effort:** 1 hour (standalone) or included in React Query
**Priority:** 🟢 LOW-MEDIUM

---

### 7. **Request Cancellation**
**Current Issue:** Requests continue after component unmount, causing memory leaks and race conditions.

**Recommendation:** Use AbortController:
```typescript
useEffect(() => {
  const abortController = new AbortController();
  
  fetch('/api/students', { signal: abortController.signal })
    .then(res => res.json())
    .then(setStudents);
  
  return () => abortController.abort();
}, []);
```

**Better:** React Query handles this automatically

**Estimated Effort:** 2 hours (manual) or included in React Query
**Priority:** 🟢 LOW-MEDIUM

---

### 8. **Performance Optimizations**
**Current Status:** Some components already use `React.memo` and `useMemo` (see `CODE_QUALITY_IMPROVEMENTS.md`).

**Additional Opportunities:**
- Add `React.memo` to list item components that re-render frequently
- Use `useMemo` for expensive filter/sort operations
- Consider virtual scrolling for lists with 100+ items

**Files to Review:**
- `src/pages/Students.tsx` - Student list rendering
- `src/pages/Sessions.tsx` - Session list rendering
- `src/components/goal/GoalsList.tsx` - Goal list rendering

**Estimated Effort:** 2-3 hours
**Priority:** 🟢 LOW

---

## 📊 Code Quality Improvements

### 9. **Type Safety Enhancements**
**Current Status:** Good TypeScript usage, but API responses lack runtime validation.

**Recommendation:** Add Zod schemas for API response validation:
```typescript
import { z } from 'zod';

const StudentSchema = z.object({
  id: z.string(),
  name: z.string(),
  // ... etc
});

export async function getStudents(): Promise<Student[]> {
  const data = await api.students.getAll();
  return z.array(StudentSchema).parse(data);
}
```

**Estimated Effort:** 3-4 hours
**Priority:** 🟢 LOW

---

### 10. **Bulk API Endpoints (Backend)**
**Current Issue:** Backend doesn't have bulk endpoints for efficient batch operations.

**Recommendation:** Add bulk endpoints to backend:
- `POST /api/students/bulk` - Create/update multiple students
- `POST /api/goals/bulk` - Create/update multiple goals
- `POST /api/sessions/bulk` - Create/update multiple sessions

**Benefits:**
- Single transaction (all or nothing)
- Better performance
- Atomic operations

**Estimated Effort:** 3-4 hours (backend)
**Priority:** 🟡 MEDIUM

---

## 🔄 Migration Strategy

### Phase 1: Quick Wins (1-2 days)
1. ✅ Add search debouncing (#4)
2. ✅ Create request deduplication utility (#3)
3. ✅ Add optimistic updates for common operations (#5)

### Phase 2: High Impact (1 week)
1. ✅ Implement React Query (#2)
2. ✅ Migrate key components to React Query
3. ✅ Add bulk API endpoints (#10)

### Phase 3: Polish (Ongoing)
1. ✅ Performance optimizations (#8)
2. ✅ Type safety enhancements (#9)
3. ✅ Error retry logic (#6)

---

## 📈 Expected Impact

| Improvement | Performance Gain | User Experience | Effort |
|------------|------------------|-----------------|--------|
| Bulk Operations | 🔴 High | 🔴 High | Medium |
| React Query | 🟡 Medium | 🔴 High | Medium |
| Search Debouncing | 🟡 Medium | 🟡 Medium | Low |
| Optimistic Updates | 🟢 Low | 🔴 High | Low |
| Request Deduplication | 🟡 Medium | 🟢 Low | Low |

---

## 🎯 Priority Ranking

1. **Bulk Operations** (#1) - Critical for data import/export
2. **React Query** (#2) - High value, reduces complexity
3. **Search Debouncing** (#4) - Quick win, better UX
4. **Bulk API Endpoints** (#10) - Enables #1
5. **Optimistic Updates** (#5) - Better perceived performance
6. **Request Deduplication** (#3) - Quick fix until React Query
7. **Error Retry** (#6) - Better reliability
8. **Request Cancellation** (#7) - Prevents memory leaks
9. **Performance Optimizations** (#8) - Incremental improvements
10. **Type Safety** (#9) - Long-term maintainability

---

## 📝 Notes

- Most improvements are independent and can be implemented incrementally
- React Query (#2) provides the most comprehensive solution but requires more migration effort
- Bulk operations (#1) should be prioritized if users frequently import/export large datasets
- Search debouncing (#4) is a quick win with immediate UX improvement
