# SLP Caseload Tracker API

Express + SQLite backend for the SLP Caseload Tracker application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The server will run on `http://localhost:3001`

## Database

The SQLite database is stored in `./data/slp-caseload.db`. This file is automatically created on first run.

## Migration from localStorage

To migrate your existing localStorage data to SQLite:

1. **Export your data from the browser:**
   - Open your browser's developer console
   - Run this code to export all data:
   ```javascript
   const exportData = () => {
     return JSON.stringify({
       students: JSON.parse(localStorage.getItem('slp_students') || '[]'),
       goals: JSON.parse(localStorage.getItem('slp_goals') || '[]'),
       sessions: JSON.parse(localStorage.getItem('slp_sessions') || '[]'),
       activities: JSON.parse(localStorage.getItem('slp_activities') || '[]'),
       evaluations: JSON.parse(localStorage.getItem('slp_evaluations') || '[]'),
       schools: JSON.parse(localStorage.getItem('slp_schools') || '[]'),
       lunches: JSON.parse(localStorage.getItem('slp_lunches') || '[]'),
       exportDate: new Date().toISOString(),
     }, null, 2);
   };
   console.log(exportData());
   ```
   - Copy the output and save it to a file (e.g., `backup.json`)

2. **Run the migration script:**
```bash
npm run migrate -- backup.json
```

The migration script will:
- Clear existing database data (if any)
- Import all your data from the JSON file
- Preserve all relationships and data integrity

## API Endpoints

- `GET /health` - Health check
- `GET /api/students` - Get all students (optional `?school=name` filter)
- `POST /api/students` - Create student
- `GET /api/students/:id` - Get student by ID
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

Similar endpoints exist for:
- `/api/goals`
- `/api/sessions`
- `/api/activities`
- `/api/evaluations`
- `/api/schools`
- `/api/lunches`
- `/api/export/all` - Export all data as JSON

## Backup

The database file (`./data/slp-caseload.db`) can be copied directly for backup. You can also use the export endpoint to get a JSON backup:

```bash
curl http://localhost:3001/api/export/all > backup.json
```

