# React Query Migration Plan for Other Pages

**Status:** Students.tsx ✅ Completed | Other pages pending

## 🎯 Should You Migrate Other Pages?

**Short Answer: Yes, but prioritize based on impact.**

## Benefits of Migrating All Pages

1. **Consistent Data Fetching** - All pages use the same pattern
2. **Shared Cache** - Data fetched on one page is available on others
3. **Better Performance** - Fewer duplicate requests across the app
4. **Easier Maintenance** - One pattern to understand and maintain
5. **Better UX** - Instant data display when navigating between pages

## 📊 Migration Priority Matrix

### 🔴 High Priority (Migrate First)

These pages fetch data that's shared across multiple pages and would benefit most from caching and deduplication.

#### 1. **Dashboard.tsx** ⭐⭐⭐
**Why:** 
- Fetches students, sessions, goals (shared with many pages)
- First page users see - caching here helps entire app
- Likely has duplicate requests with Students page

**Current Pattern:**
- Uses `useAsyncOperation` hook (custom pattern)
- Fetches students, sessions, goals

**Migration Effort:** Medium (2-3 hours)
**Impact:** Very High - Dashboard is the entry point

**Benefits:**
- Students data cached for Students page
- Sessions data cached for Sessions page
- Goals data cached for Goals pages

---

#### 2. **Sessions.tsx** ⭐⭐⭐
**Why:**
- Fetches sessions (shared with SOAPNotes, Progress, StudentDetail)
- Users frequently navigate between Sessions and other pages
- Likely has duplicate requests

**Current Pattern:**
- Manual `useState` + `useEffect` for data loading
- Fetches sessions, students, goals

**Migration Effort:** Medium (2-3 hours)
**Impact:** High - Sessions are core data

**Benefits:**
- Sessions cached for SOAPNotes, Progress, StudentDetail pages
- Fewer duplicate requests

---

#### 3. **SOAPNotes.tsx** ⭐⭐⭐
**Why:**
- Fetches SOAP notes, sessions, students, goals (all shared data)
- Complex data dependencies
- Users navigate between SOAPNotes and Sessions frequently

**Current Pattern:**
```typescript
const [soapNotes, setSoapNotes] = useState<SOAPNote[]>([]);
const [sessions, setSessions] = useState<Session[]>([]);
const [students, setStudents] = useState<Student[]>([]);
const [goals, setGoals] = useState<Goal[]>([]);
useEffect(() => {
  loadData();
}, [selectedSchool]);
```

**Migration Effort:** Medium-High (3-4 hours)
**Impact:** High - Complex page with multiple data sources

**Benefits:**
- All data cached and shared with other pages
- Instant display when navigating from Sessions page

---

#### 4. **Progress.tsx** ⭐⭐
**Why:**
- Fetches students, sessions, goals (shared data)
- Complex data processing (timeline, goal progress)
- Users frequently switch between students

**Current Pattern:**
```typescript
const [students, setStudents] = useState<Student[]>([]);
useEffect(() => {
  const loadStudents = async () => {
    const allStudents = await getStudents(selectedSchool);
    setStudents(allStudents);
  };
  loadStudents();
}, [selectedSchool]);
```

**Migration Effort:** Medium-High (3-4 hours)
**Impact:** Medium-High - Complex page but benefits from caching

**Benefits:**
- Students cached from Students page
- Sessions cached from Sessions page
- Goals cached from other pages

---

### 🟡 Medium Priority (Migrate Next)

These pages would benefit but have less shared data or simpler patterns.

#### 5. **Teachers.tsx** ⭐⭐
**Why:**
- Similar pattern to Students.tsx (easy migration)
- Teachers data is shared with Students page
- Simple CRUD operations

**Current Pattern:**
- Similar to Students.tsx before migration
- Manual `useState` + `useEffect`

**Migration Effort:** Low-Medium (1-2 hours)
**Impact:** Medium - Less frequently used but easy to migrate

**Benefits:**
- Teachers cached for Students page dropdowns
- Consistent pattern with Students.tsx

---

#### 6. **CaseManagers.tsx** ⭐⭐
**Why:**
- Similar pattern to Teachers.tsx
- Case managers shared with Students page
- Simple CRUD operations

**Migration Effort:** Low-Medium (1-2 hours)
**Impact:** Medium - Less frequently used but easy to migrate

---

#### 7. **StudentDetail.tsx** ⭐⭐
**Why:**
- Uses custom hooks (`useStudentData`, `useSessionData`, `useGoalManagement`)
- Could benefit from React Query but already has abstraction
- Fetches student, sessions, goals

**Current Pattern:**
- Uses custom hooks (good abstraction)
- But hooks use manual state management

**Migration Effort:** Medium (2-3 hours)
**Impact:** Medium - Already has good abstraction, but React Query would be better

**Benefits:**
- Student data cached from Students page
- Sessions cached from Sessions page
- Goals cached from other pages

---

### 🟢 Low Priority (Migrate Later)

These pages have less shared data or simpler use cases.

#### 8. **TimeTracking.tsx** ⭐
**Why:**
- Fetches many data types (sessions, evaluations, screeners, students, communications)
- Complex but less frequently used
- Data less likely to be shared

**Migration Effort:** Medium-High (3-4 hours)
**Impact:** Low-Medium - Less frequently used page

---

#### 9. **ProgressReports.tsx** ⭐
**Why:**
- Fetches students, goals, progress reports
- Less frequently used
- Data partially shared

**Migration Effort:** Medium (2-3 hours)
**Impact:** Low-Medium

---

#### 10. **SessionCalendar.tsx** ⭐
**Why:**
- Very complex page (3000+ lines)
- Fetches sessions, students, scheduled sessions
- Would benefit but migration is complex

**Migration Effort:** High (4-6 hours)
**Impact:** Medium - Complex page, migration is risky

---

#### 11. **Evaluations.tsx** ⭐
**Why:**
- Large page (1700+ lines)
- Fetches evaluations, students
- Less frequently used

**Migration Effort:** High (4-6 hours)
**Impact:** Low-Medium

---

#### 12. **DueDateItems.tsx** ⭐
**Why:**
- Fetches various data types
- Less frequently used
- Medium complexity

**Migration Effort:** Medium (2-3 hours)
**Impact:** Low

---

#### 13. **Communications.tsx** ⭐
**Why:**
- Fetches communications, students
- Less frequently used
- Simple pattern

**Migration Effort:** Low-Medium (1-2 hours)
**Impact:** Low

---

#### 14. **Schools.tsx** ⭐
**Why:**
- Simple CRUD page
- Schools data is rarely shared
- Less benefit from caching

**Migration Effort:** Low (1 hour)
**Impact:** Low - Schools rarely change

---

## 📋 Recommended Migration Order

### Phase 1: High Impact (1-2 weeks)
1. ✅ **Students.tsx** - DONE
2. **Dashboard.tsx** - Entry point, high impact
3. **Sessions.tsx** - Core data, shared with many pages
4. **SOAPNotes.tsx** - Complex, benefits from caching

### Phase 2: Medium Impact (1 week)
5. **Progress.tsx** - Complex but benefits from shared cache
6. **Teachers.tsx** - Easy migration, consistent with Students
7. **CaseManagers.tsx** - Easy migration, consistent with Students
8. **StudentDetail.tsx** - Already has hooks, migrate hooks to React Query

### Phase 3: Low Impact (As needed)
9. **TimeTracking.tsx** - Less frequently used
10. **ProgressReports.tsx** - Less frequently used
11. **SessionCalendar.tsx** - Complex, migrate carefully
12. **Evaluations.tsx** - Large page, migrate carefully
13. **DueDateItems.tsx** - Low priority
14. **Communications.tsx** - Low priority
15. **Schools.tsx** - Low priority

## 🎯 Quick Wins (Do These First)

After Students.tsx, these are the easiest and highest impact:

1. **Teachers.tsx** - Copy Students.tsx pattern (1-2 hours)
2. **CaseManagers.tsx** - Copy Students.tsx pattern (1-2 hours)
3. **Dashboard.tsx** - High impact, medium effort (2-3 hours)

## 💡 Migration Strategy

### For Each Page:

1. **Create Query Hooks** (if needed)
   - Add to `src/hooks/useQueries.ts`
   - Follow Students.tsx pattern

2. **Replace useState + useEffect**
   ```typescript
   // Before
   const [data, setData] = useState([]);
   useEffect(() => {
     loadData().then(setData);
   }, [deps]);
   
   // After
   const { data = [] } = useQuery({
     queryKey: ['data', deps],
     queryFn: () => loadData(),
   });
   ```

3. **Replace Manual Mutations**
   ```typescript
   // Before
   const handleSave = async () => {
     await saveData(data);
     await loadData(); // Manual refetch
   };
   
   // After
   const mutation = useMutation({
     mutationFn: saveData,
     onSuccess: () => {
       queryClient.invalidateQueries(['data']);
     },
   });
   ```

4. **Remove Manual Loading States**
   - Use `isLoading` from `useQuery`
   - Remove manual `loading` state

5. **Test Thoroughly**
   - Use Students.tsx testing checklist as template
   - Verify caching works
   - Verify deduplication works

## 📊 Expected Benefits Summary

| Page | Effort | Impact | Shared Data | Priority |
|------|--------|--------|-------------|----------|
| Students.tsx | ✅ Done | High | Students | ✅ Done |
| Dashboard.tsx | Medium | Very High | Students, Sessions, Goals | 🔴 1 |
| Sessions.tsx | Medium | High | Sessions | 🔴 2 |
| SOAPNotes.tsx | Medium-High | High | SOAP, Sessions, Students, Goals | 🔴 3 |
| Progress.tsx | Medium-High | Medium-High | Students, Sessions, Goals | 🟡 4 |
| Teachers.tsx | Low-Medium | Medium | Teachers | 🟡 5 |
| CaseManagers.tsx | Low-Medium | Medium | Case Managers | 🟡 6 |
| StudentDetail.tsx | Medium | Medium | Student, Sessions, Goals | 🟡 7 |
| TimeTracking.tsx | Medium-High | Low-Medium | Various | 🟢 8 |
| ProgressReports.tsx | Medium | Low-Medium | Students, Goals | 🟢 9 |
| SessionCalendar.tsx | High | Medium | Sessions, Students | 🟢 10 |
| Evaluations.tsx | High | Low-Medium | Evaluations | 🟢 11 |
| DueDateItems.tsx | Medium | Low | Various | 🟢 12 |
| Communications.tsx | Low-Medium | Low | Communications | 🟢 13 |
| Schools.tsx | Low | Low | Schools | 🟢 14 |

## 🚀 Getting Started

### Next Steps:

1. **Test Students.tsx thoroughly** - Make sure it works perfectly
2. **Migrate Dashboard.tsx** - High impact, good test case
3. **Migrate Sessions.tsx** - Core data, shared with many pages
4. **Migrate Teachers.tsx & CaseManagers.tsx** - Easy wins, consistent pattern

### For Each Migration:

1. Create query hooks in `useQueries.ts`
2. Replace useState/useEffect with useQuery
3. Replace mutations with useMutation
4. Test using Students.tsx checklist
5. Update this document with completion status

## 📝 Notes

- **Don't migrate everything at once** - Do it incrementally
- **Test each migration thoroughly** - Use Students.tsx as the template
- **Focus on high-impact pages first** - Dashboard, Sessions, SOAPNotes
- **Easy wins are good** - Teachers.tsx and CaseManagers.tsx are quick
- **Complex pages can wait** - SessionCalendar.tsx and Evaluations.tsx are lower priority

## ✅ Completion Tracker

- [x] Students.tsx - ✅ Completed January 28, 2026
- [ ] Dashboard.tsx
- [ ] Sessions.tsx
- [ ] SOAPNotes.tsx
- [ ] Progress.tsx
- [ ] Teachers.tsx
- [ ] CaseManagers.tsx
- [ ] StudentDetail.tsx
- [ ] TimeTracking.tsx
- [ ] ProgressReports.tsx
- [ ] SessionCalendar.tsx
- [ ] Evaluations.tsx
- [ ] DueDateItems.tsx
- [ ] Communications.tsx
- [ ] Schools.tsx
