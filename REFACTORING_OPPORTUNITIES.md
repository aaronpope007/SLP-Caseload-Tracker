# Refactoring Opportunities & Cleanup

This document identifies cleanup and refactoring opportunities found in the codebase.

## ✅ Completed Improvements

The following improvements have been implemented:

1. **Removed Dead Code** ✅
   - Deleted `src/hooks/useStorageSync.ts`
   - Deleted `src/utils/storageSync.ts`
   - Deleted `src/main-simple.tsx`

2. **Created Utility Functions** ✅
   - `api/src/middleware/asyncHandler.ts` - Async error handler middleware
   - `api/src/middleware/errorHandler.ts` - Global error handler
   - `api/src/utils/jsonHelpers.ts` - JSON parsing utilities
   - `src/utils/queryHelpers.ts` - Query string builder
   - `src/utils/logger.ts` - Centralized logging utility

3. **Improved API Client** ✅
   - Replaced all URLSearchParams usage with `buildQueryString` helper
   - Replaced console.error with `logError` from logger utility

4. **Improved API Routes** ✅
   - **ALL 16 API routes** now use async handler pattern
   - All routes use JSON helpers for safe parsing/stringifying
   - All routes have proper TypeScript types (removed `any` types)
   - Added global error handler middleware to server
   - Routes updated: students, goals, sessions, activities, evaluations, schools, teachers, case-managers, soap-notes, progress-reports, progress-report-templates, due-date-items, reminders, email, communications, export, scheduled-sessions

5. **Migrated Scheduled Sessions to API** ✅
   - Added `scheduled_sessions` table to database schema
   - Created `api/src/routes/scheduled-sessions.ts` route
   - Added API client methods for scheduled sessions
   - Added storage-api functions for scheduled sessions
   - Updated `EmailTeacherDialog.tsx` and `SessionCalendar.tsx` to use API
   - **Note:** `storage.ts` can now be removed after verification

6. **Created Reusable React Hooks** ✅
   - `src/hooks/useDialog.ts` - Simple dialog open/close state management
   - `src/hooks/useAsyncOperation.ts` - Async operations with loading/error/data states
   - `src/hooks/useSnackbar.ts` - Snackbar notification management
   - `src/hooks/index.ts` - Centralized hook exports
   - These hooks reduce code duplication across components

7. **Improved Logging** ✅
   - Replaced console statements in critical files:
     - `src/utils/storage-api.ts` - All 39 console.error statements replaced
     - `src/main.tsx` - Error logging updated
     - `src/components/ErrorBoundary.tsx` - Error logging updated
   - All API routes now use centralized error handling

---

## Remaining Opportunities

## 🗑️ Dead/Unused Code

### 1. Legacy Storage Files
The app has migrated to an API backend, but old localStorage-based files remain:

- **`src/utils/storage.ts`** (433 lines) - Legacy localStorage implementation
  - Status: **PARTIALLY USED** - Still imported by 2 files:
    - `src/components/EmailTeacherDialog.tsx` - uses `getScheduledSessions`
    - `src/pages/SessionCalendar.tsx` - uses scheduled session functions
  - **Issue:** Scheduled sessions are not yet migrated to API backend
  - Action: 
    1. Create API endpoints for scheduled sessions
    2. Migrate `EmailTeacherDialog.tsx` and `SessionCalendar.tsx` to use API
    3. Then remove `storage.ts`

- **`src/hooks/useStorageSync.ts`** (30 lines) - Cross-tab sync hook
  - Status: **UNUSED** - Defined but never imported anywhere
  - Action: Safe to remove

- **`src/utils/storageSync.ts`** (107 lines) - Cross-tab synchronization
  - Status: **UNUSED** - Only used by `useStorageSync.ts` which is itself unused
  - Action: Safe to remove

### 2. Test/Debug Files
- **`src/main-simple.tsx`** - Simple test file
  - Status: Appears to be a debugging file
  - Action: Remove or move to test directory

## 🔄 Code Duplication

### 1. API Route Error Handling ✅ COMPLETED
**Location:** `api/src/routes/*.ts`

**Status:** All routes now use `asyncHandler` middleware. No more repetitive try-catch blocks!

### 2. Query Parameter Building ✅ COMPLETED
**Location:** `src/utils/api.ts`

**Status:** All query parameter building now uses `buildQueryString` helper from `src/utils/queryHelpers.ts`

**Issue:** Repetitive URLSearchParams building across multiple API methods:
```typescript
const params = new URLSearchParams();
if (studentId) params.append('studentId', studentId);
if (school) params.append('school', school);
return request<Goal[]>(`/goals${params.toString() ? `?${params}` : ''}`);
```

**Recommendation:** Create a helper function:
```typescript
function buildQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}
```

### 3. JSON Parsing in API Routes ✅ COMPLETED
**Location:** `api/src/routes/*.ts`

**Status:** All routes now use `parseJsonField` and `stringifyJsonField` from `api/src/utils/jsonHelpers.ts`

## 🐛 Error Handling Improvements

### 1. Inconsistent Error Handling ⚠️ PARTIALLY COMPLETED
**Location:** Throughout `src/` components

**Status:**
- ✅ Created centralized logger utility (`src/utils/logger.ts`)
- ✅ Updated critical files: `storage-api.ts`, `main.tsx`, `ErrorBoundary.tsx`
- ⚠️ ~24 frontend component files still have console statements (can be updated incrementally)
- ✅ All API routes use centralized error handling

**Recommendation:**
- Create a centralized error handling utility
- Replace console.error with user-facing error notifications
- Use a toast/notification system consistently

### 2. API Error Handling
**Location:** `src/utils/api.ts`

**Issue:** Error handling in `request()` function could be more robust:
- Network errors are handled, but other error types could be improved
- Error messages could be more specific

**Recommendation:** Enhance error types and messages:
```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

## 📝 Type Safety Improvements

### 1. `any` Types in API Routes ✅ COMPLETED
**Location:** `api/src/routes/*.ts`

**Status:** All 16 API routes now have proper TypeScript interfaces for database rows. No more `any` types!

### 2. Type Assertions
**Location:** Multiple files

**Issue:** Some unsafe type assertions that could be validated

**Recommendation:** Add runtime validation where needed, especially for API responses

## 🏗️ Code Organization

### 1. Large Component Files
**Location:** `src/pages/StudentDetail.tsx` (1010 lines)

**Issue:** Very large component with multiple responsibilities

**Recommendation:** 
- Extract goal management logic into custom hooks
- Split into smaller sub-components
- Extract dialog state management

### 2. Reusable Patterns
**Location:** Multiple components

**Issue:** Similar patterns repeated across components:
- Dialog state management (open/close, form data)
- Loading states
- Error states
- Snackbar notifications

**Recommendation:** Create reusable hooks:
- `useDialog()` - for dialog state management
- `useAsyncOperation()` - for async operations with loading/error states
- `useSnackbar()` - for notifications

## 🧹 Console Statements

### 1. Development Console Logs
**Location:** 30 files contain console statements

**Issue:** Many console.log/error statements throughout codebase

**Recommendation:**
- Remove or replace with proper logging utility
- Use environment-based logging (only in development)
- Replace console.error with proper error reporting

**Files to review:**
- `src/utils/gemini.ts` - Multiple console.log statements
- `src/utils/api.ts` - console.error
- `src/utils/storage-api.ts` - console.error
- Many component files

## 🔧 API Client Improvements

### 1. Repetitive CRUD Patterns
**Location:** `src/utils/api.ts`

**Issue:** Very repetitive structure for each resource:
```typescript
students: {
  getAll: (school?: string) => ...,
  getById: (id: string) => ...,
  create: (student: ...) => ...,
  update: (id: string, updates: ...) => ...,
  delete: (id: string) => ...,
}
```

**Recommendation:** Consider generating these or using a more generic approach (though current approach is readable)

## 📦 Dependencies

### 1. Unused Dependencies
**Recommendation:** Run `npm audit` and check for unused dependencies

## ✅ Priority Recommendations

### High Priority
1. **Migrate scheduled sessions to API** - Create API endpoints and migrate remaining 2 files using `storage.ts`
2. **Remove dead code** - `useStorageSync.ts`, `storageSync.ts`, `main-simple.tsx` (after scheduled sessions migration)
3. **Create async error handler middleware** for API routes
4. **Replace console statements** with proper logging/error handling
5. **Improve type safety** in API routes (remove `any` types)

### Medium Priority
1. **Extract reusable hooks** for common patterns (dialogs, async operations)
2. **Create query parameter helper** for API client
3. **Split large components** (StudentDetail.tsx)
4. **Standardize error handling** across components

### Low Priority
1. **Create JSON parsing utilities** for API routes
2. **Consider code generation** for repetitive API patterns (if it becomes a maintenance burden)

## 🔍 Verification Results

### Files Still Using `storage.ts`:
- ✅ `src/components/EmailTeacherDialog.tsx` - uses `getScheduledSessions`
- ✅ `src/pages/SessionCalendar.tsx` - uses scheduled session functions

### Files Safe to Remove:
- ✅ `src/hooks/useStorageSync.ts` - not imported anywhere
- ✅ `src/utils/storageSync.ts` - only used by unused hook
- ✅ `src/main-simple.tsx` - test file, not referenced

### Migration Needed:
**Scheduled Sessions API** - Currently missing from backend:
- No API route file for scheduled sessions
- No API client methods for scheduled sessions
- Need to create:
  - `api/src/routes/scheduled-sessions.ts`
  - API client methods in `src/utils/api.ts`
  - Storage API functions in `src/utils/storage-api.ts`

## 📊 Metrics

- **Total files with console statements:** 30
- **Largest component:** StudentDetail.tsx (1010 lines)
- **API route files:** 16 (all with similar patterns)
- **Dead code candidates:** 4 files

