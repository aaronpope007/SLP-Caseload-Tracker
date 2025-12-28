# Refactoring Priority - Before New Features

## 🎯 High Priority (Do Before New Features)

### 1. Update REFACTORING_OPPORTUNITIES.md ✅ COMPLETED
- ✅ Marked `storage.ts` as deleted
- ✅ Updated status of all completed items
- ✅ Documented hook refactoring progress
- ✅ Updated line counts for StudentDetail.tsx (768) and Sessions.tsx (969)

### 2. Replace Remaining Console Statements ✅ COMPLETED
**Impact:** Better error handling and debugging experience
**Status:** ✅ All console statements replaced with centralized logger utility
- ✅ All 24 frontend component files updated
- ✅ Environment-aware logging implemented
- ✅ Proper error reporting with `logError`, `logWarn`, `logInfo`, `logDebug`

### 3. Break Down Large Components 🔄 PARTIALLY COMPLETE (High Effort, High Value)
**Impact:** Better maintainability, easier to add features, better testability

#### StudentDetail.tsx - **614 lines** (reduced from 1,013, target: 400-500) 🔄 ~40% COMPLETE
**Completed:**
- ✅ Goal management logic → `useGoalManagement` hook
- ✅ Dialog state management → `useDialog` hooks
- ✅ AI feature handlers → `useAIFeatures` hook
- ✅ Form state management → `useGoalForm` hook
- ✅ Snackbar → `useSnackbar` hook
- ✅ Template selection logic → `useGoalTemplate` hook
- ✅ Copy subtree logic → `useGoalSubtree` hook
- ✅ Quick goals logic → `useQuickGoals` hook

**Remaining work:**
- Extract goal list rendering into separate component (already uses `GoalsList`, but could extract handlers)
- Further optimize handlers and reduce inline logic

#### Sessions.tsx - **883 lines** (reduced from 1,103, target: 400-500) 🔄 ~20% COMPLETE
**Completed:**
- ✅ Session form logic → `useSessionForm` hook
- ✅ SOAP note management → `useSOAPNoteManagement` hook
- ✅ Session planning → `useSessionPlanning` hook
- ✅ Session management → `useSessionManagement` hook
- ✅ Dialog state → `useDialog` hooks
- ✅ Snackbar → `useSnackbar` hook
- ✅ Session organization and rendering → `SessionsList` component

**Remaining work:**
- Extract large handler functions (handleOpenDialog, handleSave, handleGenerateSOAP, etc.)
- Extract session form handlers (handleStudentToggle, handleGoalToggle, etc.)
- Further optimize and reduce inline logic

**Estimated Time Remaining:** 2-3 hours per file to reach target

### 4. Enhance API Error Handling ✅ COMPLETED
**Location:** `src/utils/api.ts`
**Action:** Created custom `ApiError` class with status codes, endpoint tracking, and user-friendly messages
**Status:** ✅ Complete - Added `ApiError` class with `getUserMessage()`, `isNetworkError()`, `isClientError()`, and `isServerError()` methods

---

## 🟡 Medium Priority (Can Do Incrementally)

### 1. Adopt New Hooks in Existing Components ✅ MOSTLY COMPLETE
**Impact:** Reduce code duplication, standardize patterns
**Status:**
- ✅ Updated `Layout.tsx` to use `useDialog` hooks
- ✅ Updated `StudentDetail.tsx` to use all new hooks
- ✅ Updated `Sessions.tsx` to use all new hooks
- ✅ Updated `Students.tsx` to use `useDialog` and `useSnackbar`
- ✅ Updated `Teachers.tsx` to use `useDialog` and `useSnackbar`
- ✅ Updated `CaseManagers.tsx` to use `useDialog` and `useSnackbar`
- ✅ Updated `Schools.tsx` to use `useDialog` and `useSnackbar`

**Remaining work:**
- Update remaining page components (Dashboard, Progress, Evaluations, etc.) if they have manual dialog/snackbar state
- Update components with manual loading/error states to use `useAsyncOperation` (lower priority)

**Estimated Time Remaining:** 30-60 minutes (optional)

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
1. ✅ Update documentation (5 min) - **COMPLETED**
2. ✅ Replace console statements in key files (2-3 hours) - **COMPLETED**
3. 🔄 Break down StudentDetail.tsx (4-6 hours) - **~30% COMPLETE** (768 lines, target: 400-500)
4. 🔄 Break down Sessions.tsx (4-6 hours) - **~30% COMPLETE** (969 lines, target: 400-500)
5. ✅ Enhance API error handling (30 min) - **COMPLETED**

**Total Estimated Time:** 11-16 hours
**Time Spent:** ~8-10 hours
**Time Remaining:** ~3-4 hours to complete component breakdowns

**Recommendation:** 
- ✅ Items 1, 2, 4, and 5 completed (quick wins)
- ✅ Hook adoption mostly complete (7 components updated)
- 🔄 Items 3 partially complete - hooks extracted, need to extract more sub-components
- **Next: Continue component breakdowns to reach 400-500 line targets**
- This will make adding new features much easier

---

## ✅ Already Completed (Don't Need to Do)

- ✅ All API routes refactored
- ✅ Type safety in API routes
- ✅ Reusable hooks created (10 hooks total)
- ✅ Critical logging files updated
- ✅ storage.ts removed
- ✅ Dead code removed
- ✅ Console statements replaced with logger utility (all 24 files)
- ✅ API error handling enhanced with ApiError class
- ✅ StudentDetail.tsx partially refactored (768 lines, down from 1,013)
- ✅ Sessions.tsx partially refactored (969 lines, down from 1,103)
- ✅ Layout.tsx updated to use hooks
- ✅ Students.tsx, Teachers.tsx, CaseManagers.tsx, Schools.tsx updated to use hooks

