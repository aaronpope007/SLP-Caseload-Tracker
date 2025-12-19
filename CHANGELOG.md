# Changelog

## [Backend Migration] - 2025-12-19

### Major Changes

#### 🚀 Added Express + SQLite Backend
- Created new `api/` directory with Express.js server
- Implemented SQLite database for persistent data storage
- Database file: `api/data/slp-caseload.db`
- All data now stored in database instead of browser localStorage

#### 📡 API Endpoints
Created RESTful API endpoints for all data operations:
- `/api/students` - CRUD operations for students
- `/api/goals` - CRUD operations for goals
- `/api/sessions` - CRUD operations for sessions
- `/api/activities` - CRUD operations for activities
- `/api/evaluations` - CRUD operations for evaluations
- `/api/schools` - CRUD operations for schools
- `/api/lunches` - CRUD operations for lunches
- `/api/export/all` - Export all data as JSON

#### 🔄 Frontend Migration
- Updated all components to use `storage-api.ts` instead of `storage.ts`
- Converted all storage functions to async/await pattern
- Removed `useStorageSync` hooks (no longer needed with API)
- Fixed all async/await issues across all pages:
  - Dashboard.tsx
  - Students.tsx
  - StudentDetail.tsx
  - Sessions.tsx
  - Progress.tsx
  - Evaluations.tsx
  - TreatmentIdeas.tsx
  - TimeTracking.tsx
  - Schools.tsx
  - ExportDialog.tsx
  - SchoolContext.tsx

#### 🗄️ Database Schema
- Created comprehensive database schema matching all TypeScript types
- Added proper indexes for performance
- Removed foreign key constraints (handled in application code)
- Automatic school creation when students reference non-existent schools

#### 📦 Data Migration
- Created migration script (`api/src/migrate.ts`)
- Successfully migrated all existing localStorage data:
  - 38 students
  - 65 goals
  - 62 sessions
  - 2 activities
  - 2 schools
  - 1 lunch
- Created browser console script for easy data export (`export-localStorage-data.js`)

#### 🛠️ Developer Experience
- Added `concurrently` to run both frontend and API with single command
- Updated `pnpm dev` to automatically start both servers
- Added color-coded output for API and Frontend logs
- Created comprehensive migration guide (`MIGRATION_GUIDE.md`)
- Created quick start guide (`START.md`)
- Added export instructions (`EXPORT_INSTRUCTIONS.md`)

#### 🐛 Bug Fixes
- Fixed foreign key constraint issues with automatic school creation
- Fixed all async/await errors in components
- Improved error handling with better error messages
- Fixed case-sensitivity issues with school name matching

#### 📝 Documentation
- Updated README.md with backend setup instructions
- Created MIGRATION_GUIDE.md for safe data migration
- Created BACKEND_QUICK_START.md for quick reference
- Created EXPORT_INSTRUCTIONS.md for data export
- Created START.md for getting started

### Technical Details

#### Backend Stack
- Express.js 4.19.2
- better-sqlite3 11.7.0
- TypeScript
- CORS enabled for frontend communication

#### API Features
- Automatic school creation when students reference new schools
- Case-insensitive school name matching
- JSON field serialization for arrays and objects
- Proper error handling and status codes
- Health check endpoint

#### Database Location
- `api/data/slp-caseload.db` - SQLite database file
- Automatically created on first server start
- Can be backed up by copying the file

### Breaking Changes
- ⚠️ Frontend now requires API server to be running
- ⚠️ All storage functions are now async (require await)
- ⚠️ localStorage is no longer used (data in SQLite)

### Migration Notes
- Existing localStorage data was successfully migrated
- All data preserved during migration
- No data loss occurred
- Original localStorage data remains untouched (as backup)

### Next Steps for Users
1. Always run `pnpm dev` to start both servers
2. Backup database file: `api/data/slp-caseload.db`
3. All new data automatically saves to database
4. No need to export/import manually anymore

