# Refactoring Priority - Before New Features

## 🎯 High Priority (Do Before New Features)

### 1. Update REFACTORING_OPPORTUNITIES.md ✅
- Mark `storage.ts` as already deleted (it was removed in the last commit)
- Update status of completed items

### 2. Replace Remaining Console Statements (Medium Effort, High Value)
**Impact:** Better error handling and debugging experience
**Files:** ~25 frontend component files with 102 console statements
**Approach:** Replace incrementally as files are touched, or do a focused pass

**Priority Files:**
- `src/pages/StudentDetail.tsx` (11 statements) - Large file, high visibility
- `src/pages/Sessions.tsx` (9 statements) - Large file, high visibility  
- `src/pages/Students.tsx` (8 statements) - Frequently used
- `src/pages/CaseManagers.tsx` (10 statements)
- `src/pages/ProgressReports.tsx` (5 statements)
- `src/utils/gemini.ts` (6 statements) - Utility file

**Estimated Time:** 2-3 hours for all files

### 3. Break Down Large Components (High Effort, High Value)
**Impact:** Better maintainability, easier to add features, better testability

#### StudentDetail.tsx (1012 lines)
**Extract:**
- Goal management logic → `useGoalManagement` hook
- Dialog state management → Use `useDialog` hook
- AI feature handlers → Separate hooks or components
- Form state management → Custom hook

**Target:** Reduce to ~400-500 lines

#### Sessions.tsx (1102 lines)
**Extract:**
- Session form logic → `useSessionForm` hook
- SOAP note management → Separate component or hook
- Session planning → Already partially extracted, complete it
- Group session logic → Separate component

**Target:** Reduce to ~400-500 lines

**Estimated Time:** 4-6 hours per file

### 4. Enhance API Error Handling (Low Effort, Medium Value)
**Location:** `src/utils/api.ts`
**Action:** Create custom `ApiError` class for better error messages
**Estimated Time:** 30 minutes

---

## 🟡 Medium Priority (Can Do Incrementally)

### 1. Adopt New Hooks in Existing Components
**Impact:** Reduce code duplication, standardize patterns
**Action:** Update components to use `useDialog`, `useAsyncOperation`, `useSnackbar`
**Files to update:**
- Components with manual dialog state management
- Components with manual loading/error states
- Components with manual snackbar state

**Estimated Time:** 1-2 hours

### 2. Type Safety Improvements
**Location:** Frontend components
**Action:** Add runtime validation for API responses where needed
**Estimated Time:** 2-3 hours

---

## 🟢 Low Priority (Nice to Have)

### 1. Code Generation for API Patterns
**Location:** `src/utils/api.ts`
**Action:** Consider if repetitive CRUD patterns become maintenance burden
**Note:** Current approach is readable, only do if it becomes a problem

### 2. Dependency Audit
**Action:** Run `npm audit` and check for unused dependencies
**Estimated Time:** 30 minutes

---

## 📊 Summary

**Before New Features, Focus On:**
1. ✅ Update documentation (5 min)
2. 🔄 Replace console statements in key files (2-3 hours)
3. 🔄 Break down StudentDetail.tsx (4-6 hours)
4. 🔄 Break down Sessions.tsx (4-6 hours)
5. 🔄 Enhance API error handling (30 min)

**Total Estimated Time:** 11-16 hours

**Recommendation:** 
- Do items 1, 2, and 5 first (quick wins, ~3 hours)
- Then tackle large component breakdowns (items 3-4) when you have focused time
- This will make adding new features much easier

---

## ✅ Already Completed (Don't Need to Do)

- ✅ All API routes refactored
- ✅ Type safety in API routes
- ✅ Reusable hooks created
- ✅ Critical logging files updated
- ✅ storage.ts removed
- ✅ Dead code removed

