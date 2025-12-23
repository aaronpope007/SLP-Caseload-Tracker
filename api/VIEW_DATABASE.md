# Viewing Your Database with DB Browser for SQLite

## Quick Start Guide

### Step 1: Download DB Browser for SQLite
1. Go to: https://sqlitebrowser.org/
2. Click "Download" and choose the Windows installer
3. Run the installer and follow the setup wizard

### Step 2: Open Your Database
1. Launch **DB Browser for SQLite**
2. Click **"Open Database"** button (or File → Open Database)
3. Navigate to:
   ```
   C:\Users\aaron\Documents\Coding\workspace\github.com\SLP\SLP Caseload Tracker\api\data\slp-caseload.db
   ```
4. Click "Open"

### Step 3: Explore Your Database

#### Browse Tables
- Click the **"Browse Data"** tab at the top
- Select a table from the dropdown (e.g., `students`, `goals`, `sessions`)
- View all records in a table format
- Edit data directly if needed (remember to click "Write Changes" to save)

#### View Database Structure
- Click the **"Database Structure"** tab
- See all tables, their columns, data types, and constraints
- View indexes and foreign key relationships

#### Run SQL Queries
- Click the **"Execute SQL"** tab
- Type SQL queries like:
  ```sql
  SELECT * FROM students;
  SELECT COUNT(*) FROM sessions;
  SELECT name, school FROM students WHERE status = 'active';
  ```
- Click the play button (▶) or press F5 to execute

### Your Database Tables
Your database contains these tables:
- `schools` - School information
- `teachers` - Teacher records
- `case_managers` - Case manager records
- `students` - Student records
- `goals` - Student goals
- `sessions` - Therapy sessions
- `activities` - Therapy activities
- `evaluations` - Student evaluations
- `soap_notes` - SOAP notes
- `progress_reports` - Progress reports
- `progress_report_templates` - Report templates
- `due_date_items` - Due date tracking

### Tips
- **Read-only mode**: If you want to prevent accidental changes, you can open the database in read-only mode
- **Export data**: Use File → Export → Export table(s) to CSV to backup or analyze data
- **Backup**: Simply copy the `.db` file to create a backup
- **Search**: Use Ctrl+F in the Browse Data view to search within a table

### Important Notes
⚠️ **Before making changes**: Make sure your API server is not running, or at least be aware that changes made in DB Browser will be reflected in your application immediately.

✅ **Safe to view**: You can safely browse and view data while your API is running - just be careful with edits.

