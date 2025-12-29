# Recovering Scheduled Sessions from localStorage

If you had recurring scheduled sessions that were lost during the migration from localStorage to SQLite, follow these steps to recover them:

## Step 1: Extract Scheduled Sessions from localStorage

If you still have the data in localStorage (it may have been cleared if you already migrated), you can extract it:

1. **Open your SLP Caseload Tracker** in your browser (even if using the new SQLite backend)
2. **Open Developer Tools** (F12)
3. **Go to the Console tab**
4. **Copy and paste the contents of `extract-scheduled-sessions.js`** into the console
5. **Press Enter**

The script will:
- Search for scheduled sessions in localStorage
- Display the data in the console
- Download a JSON file with the scheduled sessions

### Alternative: Manual Extraction

If the script doesn't find them automatically:

1. **Open Developer Tools** (F12)
2. **Go to the Application tab** (Chrome) or **Storage tab** (Firefox)
3. **Expand "Local Storage"** in the left sidebar
4. **Click on your site's URL**
5. **Look for a key containing "scheduled"** (common names: `slp_scheduled_sessions`, `slp_scheduledSessions`)
6. **Right-click the key** → **Copy value**
7. **Save it to a file** named `scheduled-sessions.json`

## Step 2: Format the Data

If you manually copied the data, create a JSON file with this structure:

```json
[
  {
    "id": "...",
    "studentIds": ["..."],
    "startTime": "09:00",
    "endTime": "09:30",
    "recurrencePattern": "weekly",
    "dayOfWeek": [1, 3],
    "startDate": "2025-01-01",
    "endDate": null,
    "goalsTargeted": [],
    "notes": "",
    "isDirectServices": true,
    "dateCreated": "2025-01-01T00:00:00.000Z",
    "dateUpdated": "2025-01-01T00:00:00.000Z",
    "active": true
  }
]
```

## Step 3: Import Scheduled Sessions

### Option A: Add to Existing Migration File

If you have a backup JSON file with other data:

1. **Open your backup JSON file** (e.g., `api/slp-caseload-backup-2025-12-19.json`)
2. **Add a `scheduledSessions` property** with your scheduled sessions array:
   ```json
   {
     "students": [...],
     "goals": [...],
     "scheduledSessions": [/* your scheduled sessions */]
   }
   ```
3. **Run the migration script**:
   ```bash
   cd api
   npm run migrate -- slp-caseload-backup-2025-12-19.json
   ```

⚠️ **Warning**: This will delete and re-import ALL data. Only do this if you want to reset everything.

### Option B: Import Only Scheduled Sessions (Recommended)

Create a new migration script that only imports scheduled sessions:

1. **Create a JSON file** with your scheduled sessions:
   ```json
   {
     "scheduledSessions": [
       /* your scheduled sessions array */
     ]
   }
   ```

2. **Run the migration script** with this file - the script will now import scheduled sessions:
   ```bash
   cd api
   npm run migrate -- scheduled-sessions.json
   ```

⚠️ **Note**: The migration script will try to delete existing data. If you only want to add scheduled sessions without deleting other data, you'll need to modify the script temporarily (comment out the DELETE statements for other tables).

## Step 3 (Alternative): Use the API Directly

If you want to add scheduled sessions without using the migration script:

1. **Make sure your API server is running**
2. **Use the API endpoint** to add each scheduled session:

```javascript
// In browser console or using curl/Postman
fetch('http://localhost:3001/api/scheduled-sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: '...',
    studentIds: [...],
    startTime: '09:00',
    // ... other fields
  })
})
```

## Troubleshooting

### "No scheduled sessions found in localStorage"

This means the data has already been cleared from localStorage. Your options:
- Check if you have any other backup files
- Recreate the scheduled sessions manually in the Calendar page
- Check if the data exists in a different browser/device

### "Migration script errors"

- Make sure your JSON file is valid JSON
- Check that all required fields are present (id, studentIds, startTime, recurrencePattern, startDate, dateCreated, dateUpdated)
- Make sure student IDs in scheduled sessions match existing student IDs in the database

### "Scheduled sessions not showing up"

- Verify they were imported by checking the database or API: `GET http://localhost:3001/api/scheduled-sessions`
- Make sure the `active` field is `true`
- Check that the `startDate` is not in the past (or adjust your calendar view)
- Ensure the `studentIds` match existing students in your database

