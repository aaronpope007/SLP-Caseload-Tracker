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

## Data Import

To import data from a JSON export file:

1. Export your data using the export endpoint or through the app's export functionality
2. Save it as a JSON file (e.g., `backup.json`)
3. Run the migration script:
```bash
npm run migrate -- backup.json
```

The migration script will:
- Clear existing database data (if any)
- Import all your data from the JSON file
- Preserve all relationships and data integrity

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Students
- `GET /api/students` - Get all students (optional `?school=name` filter)
- `POST /api/students` - Create student
- `GET /api/students/:id` - Get student by ID
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Goals
- `GET /api/goals` - Get all goals (optional `?studentId=id` filter)
- `POST /api/goals` - Create goal
- `GET /api/goals/:id` - Get goal by ID
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal

### Sessions
- `GET /api/sessions` - Get all sessions (optional `?studentId=id&school=name` filters)
- `POST /api/sessions` - Create session
- `GET /api/sessions/:id` - Get session by ID
- `PUT /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session

### Activities
- `GET /api/activities` - Get all activities
- `POST /api/activities` - Create activity
- `GET /api/activities/:id` - Get activity by ID
- `PUT /api/activities/:id` - Update activity
- `DELETE /api/activities/:id` - Delete activity

### Evaluations
- `GET /api/evaluations` - Get all evaluations (optional `?school=name` filter)
- `POST /api/evaluations` - Create evaluation
- `GET /api/evaluations/:id` - Get evaluation by ID
- `PUT /api/evaluations/:id` - Update evaluation
- `DELETE /api/evaluations/:id` - Delete evaluation

### Schools
- `GET /api/schools` - Get all schools
- `POST /api/schools` - Create school
- `GET /api/schools/:id` - Get school by ID
- `PUT /api/schools/:id` - Update school
- `DELETE /api/schools/:id` - Delete school

### Teachers
- `GET /api/teachers` - Get all teachers (optional `?school=name` filter)
- `POST /api/teachers` - Create teacher
- `GET /api/teachers/:id` - Get teacher by ID
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher

### Case Managers
- `GET /api/case-managers` - Get all case managers (optional `?school=name` filter)
- `POST /api/case-managers` - Create case manager
- `GET /api/case-managers/:id` - Get case manager by ID
- `PUT /api/case-managers/:id` - Update case manager
- `DELETE /api/case-managers/:id` - Delete case manager

### Communications
- `GET /api/communications` - Get all communications (optional `?studentId=id&contactType=type&school=name` filters)
- `POST /api/communications` - Create communication
- `GET /api/communications/:id` - Get communication by ID
- `PUT /api/communications/:id` - Update communication
- `DELETE /api/communications/:id` - Delete communication

### SOAP Notes
- `GET /api/soap-notes` - Get all SOAP notes (optional `?sessionId=id` filter)
- `POST /api/soap-notes` - Create SOAP note
- `GET /api/soap-notes/:id` - Get SOAP note by ID
- `PUT /api/soap-notes/:id` - Update SOAP note
- `DELETE /api/soap-notes/:id` - Delete SOAP note

### Progress Reports
- `GET /api/progress-reports` - Get all progress reports (optional `?studentId=id&school=name` filters)
- `POST /api/progress-reports` - Create progress report
- `GET /api/progress-reports/:id` - Get progress report by ID
- `PUT /api/progress-reports/:id` - Update progress report
- `DELETE /api/progress-reports/:id` - Delete progress report

### Progress Report Templates
- `GET /api/progress-report-templates` - Get all progress report templates
- `POST /api/progress-report-templates` - Create progress report template
- `GET /api/progress-report-templates/:id` - Get template by ID
- `PUT /api/progress-report-templates/:id` - Update template
- `DELETE /api/progress-report-templates/:id` - Delete template

### Scheduled Sessions
- `GET /api/scheduled-sessions` - Get all scheduled sessions (optional `?school=name` filter)
- `POST /api/scheduled-sessions` - Create scheduled session
- `GET /api/scheduled-sessions/:id` - Get scheduled session by ID
- `PUT /api/scheduled-sessions/:id` - Update scheduled session
- `DELETE /api/scheduled-sessions/:id` - Delete scheduled session

### Due Date Items
- `GET /api/due-date-items` - Get all due date items (optional `?school=name` filter)
- `POST /api/due-date-items` - Create due date item
- `GET /api/due-date-items/:id` - Get due date item by ID
- `PUT /api/due-date-items/:id` - Update due date item
- `DELETE /api/due-date-items/:id` - Delete due date item

### Reminders
- `GET /api/reminders` - Get all reminders (optional `?school=name` filter)
- `POST /api/reminders` - Generate or create reminder

### Timesheet Notes
- `GET /api/timesheet-notes` - Get all timesheet notes (optional query parameters)
- `POST /api/timesheet-notes` - Create timesheet note
- `GET /api/timesheet-notes/:id` - Get timesheet note by ID
- `PUT /api/timesheet-notes/:id` - Update timesheet note
- `DELETE /api/timesheet-notes/:id` - Delete timesheet note

### Email
- `POST /api/email/send` - Send email to teacher or case manager

### Document Parser
- `POST /api/document-parser/parse` - Parse uploaded documents

### Export
- `GET /api/export/all` - Export all data as JSON

## Backup

The database file (`./data/slp-caseload.db`) can be copied directly for backup. You can also use the export endpoint to get a JSON backup:

```bash
curl http://localhost:3001/api/export/all > backup.json
```

