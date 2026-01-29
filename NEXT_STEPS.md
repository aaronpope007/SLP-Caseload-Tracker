# What to Tackle Next - Action Plan

**Current Status:** React Query migration started, Students.tsx completed ✅

## 🎯 Recommended Order (Based on Impact & Effort)

### Step 1: Test & Validate (30 minutes) ⚠️ DO THIS FIRST

**Before migrating more pages, ensure Students.tsx works perfectly:**

- [ ] Run through `STUDENTS_PAGE_TESTING_CHECKLIST.md`
- [ ] Verify React Query caching works (navigate away and back)
- [ ] Verify request deduplication (check Network tab)
- [ ] Test all CRUD operations (create, update, delete, archive)
- [ ] Fix any bugs found

**Why:** Don't migrate more pages if the pattern has issues.

---

### Step 2: Quick Wins - React Query Migration (2-4 hours) ⭐ RECOMMENDED

**Migrate Teachers.tsx and CaseManagers.tsx** - Easy copy-paste from Students.tsx pattern

**Benefits:**
- ✅ Very easy (same pattern as Students.tsx)
- ✅ Consistent pattern across similar pages
- ✅ Teachers/CaseManagers cached for Students page dropdowns
- ✅ Low risk (simple CRUD pages)

**Effort:** 1-2 hours each

**Files to update:**
1. `src/hooks/useQueries.ts` - Add `useTeachers()` and `useCaseManagers()` hooks
2. `src/pages/Teachers.tsx` - Replace manual state with React Query
3. `src/pages/CaseManagers.tsx` - Replace manual state with React Query

**Pattern:** Copy Students.tsx migration exactly, just change the data type.

---

### Step 3: High Impact - Optimistic Updates (2-3 hours) 🚀 HIGH UX VALUE

**Add optimistic updates to Students.tsx** - UI updates instantly, rolls back on error

**Why:**
- ✅ Quick win (2-3 hours)
- ✅ High UX impact (feels instant)
- ✅ Can be done incrementally (one operation at a time)
- ✅ Works with existing React Query setup

**What to add:**
- Optimistic updates for:
  - Create student
  - Update student
  - Delete student
  - Archive/unarchive student

**Example Pattern:**
```typescript
const mutation = useMutation({
  mutationFn: updateStudent,
  onMutate: async (newStudent) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['students']);
    
    // Snapshot previous value
    const previousStudents = queryClient.getQueryData(['students', school]);
    
    // Optimistically update
    queryClient.setQueryData(['students', school], (old) => 
      old.map(s => s.id === newStudent.id ? newStudent : s)
    );
    
    return { previousStudents };
  },
  onError: (err, newStudent, context) => {
    // Rollback on error
    queryClient.setQueryData(['students', school], context.previousStudents);
  },
});
```

**Files to update:**
- `src/hooks/useQueries.ts` - Add optimistic update logic to mutations
- `src/pages/Students.tsx` - No changes needed (uses hooks)

---

### Step 4: High Impact - Dashboard Migration (2-3 hours) ⭐⭐⭐

**Migrate Dashboard.tsx to React Query** - Entry point, caches data for entire app

**Why:**
- ✅ Very high impact (first page users see)
- ✅ Caches students, sessions, goals for other pages
- ✅ Reduces duplicate requests across app
- ✅ Medium effort (2-3 hours)

**What to do:**
1. Create query hooks for Dashboard data:
   - `useDashboardStats()` - Students count, goals count
   - `useUpcomingReports()` - Progress reports
   - `useUpcomingItems()` - Due date items
   - `useUpcomingPlans()` - Reassessment plans
   - `useUpcomingMeetings()` - Meetings

2. Replace `useAsyncOperation` with React Query hooks

**Files to update:**
- `src/hooks/useQueries.ts` - Add Dashboard query hooks
- `src/pages/Dashboard.tsx` - Replace `useAsyncOperation` with React Query

---

### Step 5: Core Data - Sessions Migration (2-3 hours)

**Migrate Sessions.tsx to React Query** - Core data shared with many pages

**Why:**
- ✅ Sessions are core data (used by SOAPNotes, Progress, StudentDetail)
- ✅ High impact on reducing duplicate requests
- ✅ Medium effort (2-3 hours)

**Files to update:**
- `src/hooks/useQueries.ts` - Add `useSessions()` hook
- `src/pages/Sessions.tsx` - Replace manual state with React Query

---

## 📊 Decision Matrix

| Task | Effort | Impact | Risk | Priority |
|------|--------|--------|------|----------|
| **Test Students.tsx** | 30 min | High | Low | 🔴 1 |
| **Teachers.tsx Migration** | 1-2 hrs | Medium | Low | 🟡 2 |
| **CaseManagers.tsx Migration** | 1-2 hrs | Medium | Low | 🟡 3 |
| **Optimistic Updates** | 2-3 hrs | High UX | Low | 🟡 4 |
| **Dashboard Migration** | 2-3 hrs | Very High | Medium | 🔴 5 |
| **Sessions Migration** | 2-3 hrs | High | Medium | 🔴 6 |

## 🎯 My Recommendation: Two Paths

### Path A: "Quick Wins First" (Recommended for momentum)
1. ✅ Test Students.tsx (30 min)
2. ✅ Migrate Teachers.tsx (1-2 hrs)
3. ✅ Migrate CaseManagers.tsx (1-2 hrs)
4. ✅ Add Optimistic Updates (2-3 hrs)
5. ✅ Migrate Dashboard.tsx (2-3 hrs)

**Total:** ~7-11 hours | **Result:** 4 pages migrated + optimistic updates

### Path B: "High Impact First" (Recommended for maximum benefit)
1. ✅ Test Students.tsx (30 min)
2. ✅ Migrate Dashboard.tsx (2-3 hrs) - Caches data for entire app
3. ✅ Migrate Sessions.tsx (2-3 hrs) - Core data
4. ✅ Add Optimistic Updates (2-3 hrs)
5. ✅ Migrate Teachers/CaseManagers (2-4 hrs)

**Total:** ~7-13 hours | **Result:** 4 pages migrated + optimistic updates

## 💡 What I'd Do Right Now

**If I were you, I'd:**

1. **First (30 min):** Test Students.tsx thoroughly
   - Make sure everything works
   - Verify caching and deduplication
   - Fix any bugs

2. **Then (2-3 hours):** Add Optimistic Updates to Students.tsx
   - Quick win, high UX impact
   - Users will notice the improvement immediately
   - Low risk, incremental improvement

3. **Next (1-2 hours):** Migrate Teachers.tsx
   - Easy copy-paste from Students.tsx
   - Builds momentum
   - Consistent pattern

4. **After (1-2 hours):** Migrate CaseManagers.tsx
   - Same as Teachers.tsx
   - Completes the "easy wins"

5. **Finally (2-3 hours):** Migrate Dashboard.tsx
   - High impact
   - Caches data for entire app
   - Sets up for Sessions migration later

**Total Time:** ~6-10 hours
**Result:** 4 pages migrated + optimistic updates + solid foundation

## 🚀 Quick Start Commands

### To migrate Teachers.tsx:
1. Add to `src/hooks/useQueries.ts`:
   ```typescript
   export function useTeachers(school?: string) {
     return useQuery({
       queryKey: queryKeys.teachers.bySchool(school),
       queryFn: async () => {
         if (!school) return [];
         const teachers = await getTeachers(school);
         return [...teachers].sort((a, b) => 
           a.name.toLowerCase().localeCompare(b.name.toLowerCase())
         );
       },
       enabled: !!school,
       staleTime: 5 * 60 * 1000,
     });
   }
   ```

2. Update `src/pages/Teachers.tsx`:
   - Replace `useState` + `useEffect` with `useTeachers(selectedSchool)`
   - Replace mutations with `useCreateTeacher()`, `useUpdateTeacher()`, `useDeleteTeacher()`
   - Remove manual `loadTeachers()` function

3. Test using Students.tsx checklist as template

## 📝 Notes

- **Don't rush** - Test each migration thoroughly
- **One at a time** - Don't migrate multiple pages simultaneously
- **Use Students.tsx as template** - Copy the pattern exactly
- **Focus on high-impact pages** - Dashboard and Sessions are most important
- **Optimistic updates are quick wins** - High UX value for low effort

## ✅ Completion Tracker

- [x] Students.tsx migration - ✅ Completed
- [ ] Students.tsx testing - ⏳ Next
- [x] Teachers.tsx migration - ✅ Completed
- [x] CaseManagers.tsx migration - ✅ Completed
- [x] Optimistic updates (Students) - ✅ Completed
- [ ] Dashboard.tsx migration
- [ ] Sessions.tsx migration
