# Progress Report Scheduling - Implementation Proposal

## Overview
This document outlines the design and implementation plan for the Progress Report Scheduling feature, including auto-scheduling based on IEP/annual review dates, templates for quarterly/annual reports, and email reminders.

---

## 1. Data Model Design

### 1.1 Student Schema Extensions
Add the following fields to the `Student` interface to track IEP dates:

```typescript
export interface Student {
  // ... existing fields ...
  iepDate?: string;              // Date of current IEP (ISO string)
  annualReviewDate?: string;     // Next annual review date (ISO string)
  progressReportFrequency?: 'quarterly' | 'annual'; // Default report frequency
}
```

**Rationale**: These fields allow us to automatically calculate when progress reports are due. The `iepDate` serves as the anchor point, and `annualReviewDate` helps with annual report scheduling.

### 1.2 ProgressReport Interface
Create a new interface to track scheduled and completed progress reports:

```typescript
export interface ProgressReport {
  id: string;
  studentId: string;
  reportType: 'quarterly' | 'annual';
  dueDate: string;               // ISO string - when report is due
  scheduledDate: string;         // ISO string - when it was auto-scheduled
  periodStart: string;           // Start of reporting period (ISO string)
  periodEnd: string;             // End of reporting period (ISO string)
  status: 'scheduled' | 'in-progress' | 'completed' | 'overdue';
  completedDate?: string;        // ISO string - when completed
  templateId?: string;           // Which template was used
  content?: string;              // Report content/generated text
  dateCreated: string;
  dateUpdated: string;
  
  // Optional fields for customization
  customDueDate?: string;        // Override auto-calculated due date
  reminderSent?: boolean;        // Track if reminder email was sent
  reminderSentDate?: string;     // When reminder was sent
}
```

**Rationale**: This model tracks the lifecycle of progress reports from scheduling to completion, supports both quarterly and annual reports, and allows for future email reminder tracking.

### 1.3 ProgressReportTemplate Interface
Create templates for generating progress reports:

```typescript
export interface ProgressReportTemplate {
  id: string;
  name: string;                  // e.g., "Quarterly Progress Report", "Annual IEP Progress"
  reportType: 'quarterly' | 'annual';
  sections: ProgressReportSection[];
  isDefault: boolean;            // One default per type
  dateCreated: string;
  dateUpdated: string;
}

export interface ProgressReportSection {
  id: string;
  title: string;                 // e.g., "Student Information", "Goal Progress", "Recommendations"
  order: number;                 // Display order
  content?: string;              // Template content/instructions
  includeGoals?: boolean;        // Auto-include goal progress
  includeSessions?: boolean;     // Auto-include session data
}
```

**Rationale**: Templates provide structure for reports and can be customized. Sections allow flexible report layouts while maintaining consistency.

---

## 2. Database Schema

### 2.1 Students Table Migration
Add columns to existing `students` table:

```sql
ALTER TABLE students ADD COLUMN iepDate TEXT;
ALTER TABLE students ADD COLUMN annualReviewDate TEXT;
ALTER TABLE students ADD COLUMN progressReportFrequency TEXT CHECK(progressReportFrequency IN ('quarterly', 'annual'));
```

### 2.2 Progress Reports Table
```sql
CREATE TABLE IF NOT EXISTS progress_reports (
  id TEXT PRIMARY KEY,
  studentId TEXT NOT NULL,
  reportType TEXT NOT NULL CHECK(reportType IN ('quarterly', 'annual')),
  dueDate TEXT NOT NULL,
  scheduledDate TEXT NOT NULL,
  periodStart TEXT NOT NULL,
  periodEnd TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('scheduled', 'in-progress', 'completed', 'overdue')),
  completedDate TEXT,
  templateId TEXT,
  content TEXT,
  dateCreated TEXT NOT NULL,
  dateUpdated TEXT NOT NULL,
  customDueDate TEXT,
  reminderSent INTEGER DEFAULT 0,
  reminderSentDate TEXT,
  FOREIGN KEY (studentId) REFERENCES students(id) ON DELETE CASCADE
);
```

### 2.3 Progress Report Templates Table
```sql
CREATE TABLE IF NOT EXISTS progress_report_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  reportType TEXT NOT NULL CHECK(reportType IN ('quarterly', 'annual')),
  sections TEXT NOT NULL, -- JSON array of ProgressReportSection
  isDefault INTEGER DEFAULT 0,
  dateCreated TEXT NOT NULL,
  dateUpdated TEXT NOT NULL
);
```

---

## 3. API Endpoints

### 3.1 Progress Reports Routes (`/api/progress-reports`)
- `GET /` - Get all progress reports (filterable by studentId, school, status, date range)
- `GET /:id` - Get specific progress report
- `POST /` - Create new progress report
- `PUT /:id` - Update progress report
- `DELETE /:id` - Delete progress report
- `POST /schedule-auto` - Auto-schedule reports for all active students
- `POST /:id/complete` - Mark report as completed
- `GET /upcoming` - Get upcoming/overdue reports (for dashboard/reminders)

### 3.2 Progress Report Templates Routes (`/api/progress-report-templates`)
- `GET /` - Get all templates (filterable by reportType)
- `GET /:id` - Get specific template
- `POST /` - Create new template
- `PUT /:id` - Update template
- `DELETE /:id` - Delete template
- `POST /:id/set-default` - Set as default for its reportType

---

## 4. Auto-Scheduling Logic

### 4.1 Quarterly Reports
For students with `progressReportFrequency = 'quarterly'`:
- Calculate quarters based on IEP date or school year start (September 1)
- Schedule reports for: Q1 (Sept-Nov), Q2 (Dec-Feb), Q3 (Mar-May), Q4 (Jun-Aug)
- Due dates: Last day of each quarter or 2 weeks before next IEP/annual review

**Algorithm**:
```
1. Get student's IEP date (or use school year start as fallback)
2. Calculate quarter boundaries:
   - Q1: Sept 1 - Nov 30
   - Q2: Dec 1 - Feb 28/29
   - Q3: Mar 1 - May 31
   - Q4: Jun 1 - Aug 31
3. For each quarter in the current IEP period:
   - Create ProgressReport with:
     - periodStart = quarter start
     - periodEnd = quarter end
     - dueDate = quarter end + 2 weeks (or earlier if near annual review)
4. Check if report already exists for that period to avoid duplicates
```

### 4.2 Annual Reports
For students with `progressReportFrequency = 'annual'`:
- Schedule 1 report per year based on `annualReviewDate` or `iepDate`
- Due date: 2-4 weeks before annual review date

**Algorithm**:
```
1. Get student's annualReviewDate (or iepDate + 1 year as fallback)
2. Calculate report period: (annualReviewDate - 1 year) to annualReviewDate
3. Set dueDate = annualReviewDate - 3 weeks
4. Create ProgressReport if one doesn't exist for that period
```

### 4.3 Implementation Location
- Create utility function: `src/utils/progressReportScheduler.ts`
- Expose API endpoint: `POST /api/progress-reports/schedule-auto`
- Can be triggered:
  - Automatically when IEP date is set/updated on a student
  - Manually from a "Schedule Reports" button in UI
  - Via a scheduled job (future enhancement)

---

## 5. UI/UX Design

### 5.1 Student Detail Page Enhancement
Add a new section on the Student Detail page:

**Location**: Below the Goals section, add "Progress Reports" section

**Display**:
- List of scheduled/completed progress reports for the student
- Show: Report type, Period (start-end dates), Due date, Status (with color coding)
- Actions: View, Edit, Mark Complete, Generate Report
- Button: "Schedule Reports" (triggers auto-scheduling for this student)

**Status Colors**:
- `scheduled` - Blue/info
- `in-progress` - Orange/warning
- `completed` - Green/success
- `overdue` - Red/error

### 5.2 New Progress Reports Page (`/progress-reports`)
**Purpose**: Centralized view of all progress reports across all students

**Layout**:
- Filter bar: Student, Report Type, Status, Date Range
- Table/List view showing:
  - Student Name
  - Report Type
  - Period
  - Due Date
  - Status
  - Actions (View, Edit, Complete, Generate)
- Group by: "Upcoming" (next 30 days), "Overdue", "Completed" sections
- Summary stats: Total scheduled, Overdue count, Completed this month

**Quick Actions**:
- "Schedule All Reports" button (for all active students)
- "Generate Selected Reports" (bulk action)

### 5.3 Dashboard Integration
Add a new card/widget to the Dashboard:

**Upcoming Progress Reports**:
- Shows next 5-10 reports due within next 30 days
- Color-coded by urgency (overdue = red, due soon = orange, upcoming = blue)
- Click to navigate to Progress Reports page
- Badge showing count of overdue reports

### 5.4 Progress Report Editor/Generator
**Dialog/Page** for creating/editing progress reports:

**Sections** (based on selected template):
1. **Student Information** (auto-filled)
2. **Reporting Period** (auto-filled from report)
3. **Goal Progress** (auto-populated from session data)
   - List of goals with progress metrics
   - Can include charts/graphs
4. **Session Summary** (optional, based on template)
   - Total sessions in period
   - Attendance rate
5. **Recommendations** (manual entry or AI-generated)
6. **Notes/Comments** (manual entry)

**Features**:
- Auto-generate content using existing goal progress data
- Use AI (Gemini) to generate narrative sections if available
- Export as PDF/DOCX
- Save as draft or mark complete
- Link to generate SOAP notes (if applicable)

### 5.5 Template Management
**Location**: Settings or dedicated "Templates" section

**Features**:
- List of existing templates
- Create/Edit/Delete templates
- Preview template structure
- Set default templates for quarterly/annual reports
- Template editor with drag-and-drop sections (future enhancement)

---

## 6. Email Reminders (Phase 2)

### 6.1 Initial Implementation
For MVP, we'll implement the structure but **stub the actual email sending**:

**Database Fields** (already in schema):
- `reminderSent` (boolean)
- `reminderSentDate` (timestamp)

**API Endpoints**:
- `GET /api/progress-reports/reminders/due` - Get reports needing reminders
- `POST /api/progress-reports/:id/send-reminder` - Mark reminder as sent (stub actual email)

**UI**:
- Show reminder status in report list
- Manual "Send Reminder" button (for testing/stub)

### 6.2 Future Email Integration
To actually send emails, we'll need:
- Email service integration (SendGrid, AWS SES, SMTP)
- Email template system
- User settings for email preferences
- Scheduled job/cron to check for reports needing reminders
- Email queue system for reliability

**Reminder Logic**:
- Send reminder X days before due date (configurable, default 7 days)
- Send overdue reminder if report not completed by due date
- Don't send if report is already completed

---

## 7. Implementation Phases

### Phase 1: Core Data Model & Scheduling (MVP)
1. ✅ Add Student schema extensions (iepDate, annualReviewDate, progressReportFrequency)
2. ✅ Create ProgressReport and ProgressReportTemplate types
3. ✅ Database migrations
4. ✅ API routes for progress reports (CRUD)
5. ✅ Auto-scheduling logic (quarterly and annual)
6. ✅ Basic UI on Student Detail page (list reports)
7. ✅ Progress Reports page (list all reports)

### Phase 2: Report Generation & Templates
1. ✅ Template system (CRUD for templates)
2. ✅ Report editor/generator UI
3. ✅ Auto-populate goal progress data
4. ✅ Export to PDF/DOCX
5. ✅ Dashboard integration (upcoming reports widget)

### Phase 3: Email Reminders (Future)
1. Reminder tracking structure (database fields)
2. Reminder API endpoints (stub email sending)
3. Email service integration
4. Scheduled reminder jobs
5. Email template system

---

## 8. User Workflows

### 8.1 Initial Setup
1. User sets IEP date and annual review date on Student record
2. User selects progress report frequency (quarterly or annual)
3. System auto-schedules reports based on these dates
   - Can be triggered automatically when dates are set
   - Or manually via "Schedule Reports" button

### 8.2 Generating a Report
1. User navigates to Progress Reports page or Student Detail page
2. User clicks on a scheduled report
3. Report editor opens with template-based sections
4. System auto-populates goal progress and session data
5. User reviews/edits content
6. User can generate AI-assisted recommendations (optional)
7. User saves and marks report as complete
8. User can export report as PDF/DOCX

### 8.3 Managing Templates
1. User navigates to Templates section
2. User creates new template or edits existing
3. User defines sections and structure
4. User sets as default for report type (quarterly/annual)

---

## 9. Technical Considerations

### 9.1 Data Dependencies
- Progress reports depend on:
  - Student data (name, grade, etc.)
  - Goals (for progress tracking)
  - Sessions (for session counts, dates, performance data)
- Ensure data consistency when deleting students/goals/sessions

### 9.2 Performance
- Auto-scheduling can be slow for many students - consider:
  - Background job processing
  - Batch processing with progress indicators
  - Caching calculated dates

### 9.3 Date Handling
- Use ISO 8601 strings for all dates
- Handle timezone considerations (store as UTC, display in local time)
- Account for school year boundaries and holidays

### 9.4 Backward Compatibility
- Existing students without IEP dates should still work
- Default to annual reports if frequency not set
- Allow manual report creation even without auto-scheduling

---

## 10. Open Questions / Decisions Needed

1. **Default Report Frequency**: Should we default to quarterly or annual? (Recommendation: quarterly for more frequent tracking)

2. **Quarter Boundaries**: Should quarters be calendar-based or school-year-based? (Recommendation: school-year-based, starting September 1)

3. **Due Date Calculation**: How many days before period end should reports be due? (Recommendation: 2 weeks after period end, or 3 weeks before annual review if applicable)

4. **Report Generation**: Should we integrate with existing Gemini AI for generating narrative sections? (Recommendation: Yes, similar to existing progress note generation)

5. **Email Integration**: Which email service to use? (Recommendation: Start with stub, integrate SendGrid or AWS SES later)

6. **Export Format**: PDF only, or also DOCX/Word? (Recommendation: Start with PDF, add DOCX later)

---

## Next Steps

1. Review and approve this proposal
2. Decide on open questions above
3. Create implementation todos
4. Begin Phase 1 implementation

