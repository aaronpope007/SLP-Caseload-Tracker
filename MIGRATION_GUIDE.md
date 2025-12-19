# Migration Guide: localStorage to SQLite Backend

This guide will help you safely migrate your data from localStorage to the new SQLite backend **without losing any data**.

## ⚠️ Important: Backup First!

Before starting, make sure you have a backup of your data. The migration process is safe, but it's always good to have a backup.

## Step 1: Export Your Current Data

You have two options to export your localStorage data:

### Option A: Using Browser Console (Recommended)

1. Open your SLP Caseload Tracker in your browser
2. Open Developer Tools (F12)
3. Go to the Console tab
4. Copy and paste the entire contents of `export-localStorage-data.js` into the console
5. Press Enter
6. The script will:
   - Display a summary of your data
   - Show the JSON export in the console
   - Automatically download a backup file

### Option B: Manual Export

1. Open Developer Tools (F12)
2. Go to the Console tab
3. Run this code:

```javascript
const exportData = () => {
  const data = {
    students: JSON.parse(localStorage.getItem('slp_students') || '[]'),
    goals: JSON.parse(localStorage.getItem('slp_goals') || '[]'),
    sessions: JSON.parse(localStorage.getItem('slp_sessions') || '[]'),
    activities: JSON.parse(localStorage.getItem('slp_activities') || '[]'),
    evaluations: JSON.parse(localStorage.getItem('slp_evaluations') || '[]'),
    schools: JSON.parse(localStorage.getItem('slp_schools') || '[]'),
    lunches: JSON.parse(localStorage.getItem('slp_lunches') || '[]'),
    exportDate: new Date().toISOString(),
  };
  console.log(JSON.stringify(data, null, 2));
  return data;
};
exportData();
```

4. Copy the JSON output from the console
5. Save it to a file named `backup.json` in the `api` folder

## Step 2: Set Up the Backend

1. Navigate to the `api` folder:
```bash
cd api
```

2. Install dependencies:
```bash
npm install
```

3. Start the server to initialize the database:
```bash
npm run dev
```

4. Verify the server is running by visiting `http://localhost:3001/health`
   - You should see: `{"status":"ok","timestamp":"..."}`

5. Stop the server (Ctrl+C)

## Step 3: Import Your Data

1. Make sure your `backup.json` file is in the `api` folder (or provide the full path)

2. Run the migration script:
```bash
npm run migrate -- backup.json
```

3. The script will:
   - Clear any existing database data (if this is your first migration)
   - Import all your data from the JSON file
   - Show a summary of imported items

4. You should see output like:
```
🔄 Starting migration...
📚 Importing 3 schools...
✅ Imported 3 schools
👥 Importing 25 students...
✅ Imported 25 students
...
✨ Migration completed successfully!
```

## Step 4: Verify Your Data

1. Start the server again:
```bash
npm run dev
```

2. Test the API by visiting:
   - `http://localhost:3001/api/students` - Should show your students
   - `http://localhost:3001/api/goals` - Should show your goals
   - `http://localhost:3001/api/export/all` - Should show all your data

3. Compare the counts with your original data to ensure everything migrated

## Step 5: Update Frontend to Use API

The frontend can now use the API instead of localStorage. You have two options:

### Option A: Use API Storage (Recommended)

1. Update your imports in files that use storage:
   - Change `from './utils/storage'` to `from './utils/storage-api'`

2. Make sure the API server is running when you use the app

3. Update your `vite.config.ts` or create a `.env` file if you need to change the API URL:
```env
VITE_API_URL=http://localhost:3001/api
```

### Option B: Keep Using localStorage (Fallback)

- Your original `storage.ts` file still works
- You can switch back and forth by changing imports
- This is useful if the API server isn't running

## Step 6: Test Everything

1. Start the API server:
```bash
cd api
npm run dev
```

2. Start the frontend (in a new terminal):
```bash
npm run dev
```

3. Test all functionality:
   - View students
   - Create/edit/delete records
   - Verify data persists after refresh

## Troubleshooting

### Migration fails with "Student not found" errors
- This usually means foreign key constraints. Make sure schools are imported before students.

### API connection errors
- Make sure the API server is running on port 3001
- Check that CORS is enabled (it should be by default)
- Verify the API URL in your frontend config

### Data not showing up
- Check the browser console for errors
- Verify the API is returning data by visiting the endpoints directly
- Make sure you're using `storage-api.ts` instead of `storage.ts`

### Need to re-migrate
- The migration script clears existing data by default
- Just run it again with your backup file
- Or modify the script to append instead of replace

## Backup Strategy

Going forward, you can backup your data in two ways:

1. **Database file backup**: Copy `api/data/slp-caseload.db` to a safe location
2. **JSON export**: Use the export endpoint:
   ```bash
   curl http://localhost:3001/api/export/all > backup.json
   ```

## Rollback Plan

If you need to go back to localStorage:

1. Export data from the API: `http://localhost:3001/api/export/all`
2. Save the JSON
3. Use the import function in your frontend (if you have one)
4. Or manually restore to localStorage using browser console

## Support

If you encounter any issues:
1. Check the API server logs
2. Check the browser console
3. Verify your backup file is valid JSON
4. Make sure all dependencies are installed

