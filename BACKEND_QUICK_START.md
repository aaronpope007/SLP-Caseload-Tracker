# Backend Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Install Backend Dependencies
```bash
cd api
npm install
```

### 2. Start the Server
```bash
npm run dev
```

The server will run on `http://localhost:3001`

### 3. Migrate Your Data (Important!)

**Before migrating, export your localStorage data:**

1. Open your browser console on the SLP Caseload Tracker page
2. Copy and paste the contents of `export-localStorage-data.js`
3. This will download a backup file automatically

**Then import it:**
```bash
npm run migrate -- path/to/your/backup.json
```

### 4. Verify It Works
Visit `http://localhost:3001/api/students` - you should see your students!

## 📁 File Structure

```
api/
├── src/
│   ├── db.ts              # Database setup and schema
│   ├── server.ts          # Express server
│   ├── migrate.ts         # Migration script
│   └── routes/            # API endpoints
│       ├── students.ts
│       ├── goals.ts
│       ├── sessions.ts
│       ├── activities.ts
│       ├── evaluations.ts
│       ├── schools.ts
│       ├── lunches.ts
│       └── export.ts
├── data/                  # SQLite database (created automatically)
│   └── slp-caseload.db
└── package.json
```

## 🔌 API Endpoints

All endpoints are prefixed with `/api`:

- **Students**: `/api/students` (GET, POST, PUT, DELETE)
- **Goals**: `/api/goals` (GET, POST, PUT, DELETE)
- **Sessions**: `/api/sessions` (GET, POST, PUT, DELETE)
- **Activities**: `/api/activities` (GET, POST, PUT, DELETE)
- **Evaluations**: `/api/evaluations` (GET, POST, PUT, DELETE)
- **Schools**: `/api/schools` (GET, POST, PUT, DELETE)
- **Lunches**: `/api/lunches` (GET, POST, PUT, DELETE)
- **Export**: `/api/export/all` (GET - exports all data)

## 🔄 Switching Frontend to Use API

To use the API instead of localStorage, update your imports:

**Before:**
```typescript
import { getStudents, addStudent } from './utils/storage';
```

**After:**
```typescript
import { getStudents, addStudent } from './utils/storage-api';
```

**Note:** Functions in `storage-api.ts` are async, so you'll need to `await` them:
```typescript
const students = await getStudents();
await addStudent(newStudent);
```

## 💾 Backup Your Data

### Option 1: Copy Database File
```bash
cp api/data/slp-caseload.db ~/backups/slp-backup-$(date +%Y%m%d).db
```

### Option 2: Export as JSON
```bash
curl http://localhost:3001/api/export/all > backup.json
```

## 🛠️ Troubleshooting

### Port Already in Use
Change the port in `api/src/server.ts` or set `PORT` environment variable:
```bash
PORT=3002 npm run dev
```

### Database Locked
- Make sure only one instance of the server is running
- Close any database viewers that might have the file open

### Migration Fails
- Check that your backup.json is valid JSON
- Make sure the server isn't running during migration
- Verify file paths are correct

### Frontend Can't Connect
- Verify server is running: `curl http://localhost:3001/health`
- Check CORS settings (should be enabled by default)
- Verify API URL in frontend config

## 📚 More Information

- **Full Migration Guide**: See [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md)
- **API Documentation**: See [api/README.md](./README.md)
- **Backend Details**: Check the code in `api/src/`

## ✅ Checklist

- [ ] Backend dependencies installed
- [ ] Server starts successfully
- [ ] localStorage data exported to backup.json
- [ ] Migration completed successfully
- [ ] Data verified in API endpoints
- [ ] Frontend updated to use API (optional)
- [ ] Backup strategy in place

