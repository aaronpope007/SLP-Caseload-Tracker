# SLP Caseload Tracker

A comprehensive web application designed to help Speech-Language Pathologists (SLPs) manage their caseloads, track student progress, log therapy sessions, and generate AI-powered treatment ideas.

## Features

### 📊 Dashboard
- **Overview Statistics**: View at-a-glance metrics including active students, active goals, and recent sessions
- **Quick Actions**: Fast access to common tasks (add student, log session, generate ideas)
- **Recent Sessions**: Quick view of the most recent therapy sessions with associated students

### 👥 Student Management
- **Student Profiles**: Create and manage student profiles with:
  - Name, age, and grade
  - Status tracking (active/discharged)
  - Speech/language concerns
  - Date added to caseload
- **Archive Functionality**: Archive students to hide them from main views while keeping data accessible
  - Toggle between Active and Archived views
  - Archived students don't appear on dashboard or in active lists
  - Easy unarchive option to restore students
- **Search Functionality**: Search students by name, grade, or concerns
- **Student Detail Pages**: Dedicated pages for each student showing all associated goals with enhanced organization

### 🎯 Goal Management
- **Goal Creation**: Set individual goals for each student with:
  - Detailed goal descriptions
  - Baseline performance levels
  - Target performance levels
  - Status tracking (in-progress, achieved, modified)
  - Domain categorization (Articulation, Language, Pragmatics, Fluency, Voice, AAC)
  - Priority levels (high, medium, low)
- **Goal Templates**: Browse and use pre-built goal templates organized by domain:
  - Articulation goals (phonemes, clusters, phonological processes)
  - Language goals (grammar, vocabulary, comprehension)
  - Pragmatics goals (conversation, social communication)
  - Fluency goals (stuttering reduction, techniques)
  - Voice and AAC goals
- **Sub-goals**: Break down complex goals into smaller, trackable sub-goals with hierarchical organization
- **Goal Hierarchy**: Goals are automatically organized by domain for easy navigation
- **AI Goal Recommendations**: Get AI-powered suggestions for appropriate goals based on student concerns
- **Goal Editing**: Update goal information as progress is made
- **Progress Visualization**: Visual progress bars and charts showing progress toward goals

### 📝 Session Logging
- **Comprehensive Session Tracking**: Log therapy sessions with:
  - Student association
  - Date and time
  - Goals targeted during the session
  - Activities used
  - Performance data per goal (accuracy percentage, correct/incorrect trials)
  - Session notes
- **Performance Tracking**: Track accuracy both manually and through trial counting with automatic calculation
- **Activity Documentation**: Keep track of activities used in each session
- **Cuing Levels**: Track cuing/prompting levels (independent, verbal, visual, tactile, physical) for each goal
- **Direct/Indirect Services**: Categorize sessions as Direct Services or Indirect Services with separate note fields
- **Group Sessions**: Link multiple sessions together for group therapy tracking
- **Session Scheduling**: Schedule recurring or one-time sessions with calendar integration
- **Session Calendar**: Visual calendar view of scheduled and completed sessions
- **Missed Session Tracking**: Mark sessions as missed for attendance tracking

### 📈 Progress Tracking
- **Visual Analytics**: 
  - Timeline charts showing session frequency and goals targeted over time
  - Bar charts comparing baseline, current, and target performance for each goal
  - Progress percentage calculations
- **AI-Powered Progress Notes**: 
  - Generate professional progress notes for individual goals or combined reports
  - Select specific goals to include in combined notes
  - Uses Google Gemini AI to create clinically appropriate documentation
- **Performance History**: Track performance trends over time with detailed session-by-session data
- **Progress Report Scheduling**: 
  - Auto-schedule quarterly and annual progress reports based on IEP dates
  - Customizable report templates with sections
  - Track report status (scheduled, in-progress, completed, overdue)
  - Reminders for upcoming report deadlines

### 💡 AI-Powered Treatment Ideas
- **Smart Activity Generation**: Generate creative, age-appropriate treatment activities using Google Gemini AI
- **Customizable Parameters**:
  - Goal area (e.g., Articulation, Language, Fluency)
  - Age range
  - Available materials
- **Activity Library**: Save generated or manually created activities
- **Favorites System**: Mark frequently used activities as favorites for quick access
- **Activity Details**: Each activity includes descriptions, materials needed, and step-by-step instructions
- **Treatment Recommendations**: Get AI-powered personalized treatment recommendations based on goal progress and session history
- **IEP Goal Suggestions**: AI-assisted creation of comprehensive annual IEP goals from assessment data

### 📋 Clinical Documentation
- **IEP Notes**: View and manage IEP notes per student; add and delete notes linked to students
- **SOAP Notes**: 
  - Generate professional SOAP (Subjective, Objective, Assessment, Plan) notes from session data
  - Customizable templates with common subjective statements
  - Edit and save SOAP notes for each session
  - View and manage all SOAP notes in a dedicated page
- **Documentation Templates**: Create and manage reusable templates for various documentation needs
- **Timesheet Notes**: Generate timesheet notes for billing and time tracking purposes

### 🏫 School & Team Management
- **Schools Management**: 
  - Create and manage multiple schools
  - Track school hours and teletherapy settings
  - Filter data by school for multi-school caseloads
- **Teachers Management**: 
  - Track teachers associated with each school
  - Link students to their classroom teachers
  - Store teacher contact information
- **Case Managers**: 
  - Manage case managers (SPED, SLP, OT, PT, etc.) by school
  - Link students to case managers
  - Store contact information for team collaboration

### 💬 Communications Logging
- **Communication Tracking**: 
  - Log all communications with teachers, parents, and case managers
  - Track communication methods (email, phone, in-person, other)
  - Link communications to specific students and sessions
  - Filter by contact type, student, and date
  - Search and view communication history
- **Email Integration**: 
  - Send emails directly from the app to teachers and case managers
  - Track email communications automatically
  - Store email subject and body content
- **Communication Details**: 
  - Record communication date and time
  - Add notes and related context (e.g., "Missed Session", "IEP Meeting")
  - View full communication history in a unified timeline

### 📅 Scheduling & Reminders
- **Session Calendar**: 
  - Visual calendar view of all sessions
  - Schedule recurring weekly sessions
  - Schedule specific date sessions
  - Cancel individual session instances
  - Drag-and-drop session management
- **Due Date Items**: 
  - Track important deadlines (IEP meetings, evaluations, reports, etc.)
  - Categorize by type (IEP, Evaluation, Meeting, Report, Other)
  - Set priority levels
  - Mark items as completed
- **Smart Reminders**: 
  - Automatic reminders for goal reviews
  - Re-evaluation due date alerts
  - Report deadline notifications
  - Annual review prep reminders
  - Dashboard widget showing upcoming reminders

### 🔬 Evaluations
- **Evaluation Tracking**: 
  - Track evaluation types (Initial, 3-year, Adding Academic, etc.)
  - Store areas of concern and assessment results
  - Track qualification status and report completion
  - Link evaluations to students and teachers
  - Track meeting dates and due dates

### ⏱️ Time Tracking
- **Time Tracking Dashboard**: 
  - View all sessions and evaluations in a unified timeline
  - Filter by date range, school, and service type
  - Generate timesheet notes for billing (full MN DOE-style note)
  - **Stepping Stones time report**: **1) Prep shift** — *Offsite Indirect Services:* lists every student on the **schedule** for the filtered date (initials and grade) for activity/goal prep; **2) Work shift** — *Direct / Indirect Services* as comma-separated initials (grade): **direct** includes attended direct sessions, screening, initial/3-year/SLP assessment contacts, SLP screening assessment meetings, IEP meetings and IEP assessments, and evaluation logs; **indirect** includes indirect/missed-session documentation, lesson planning, all communications, all meetings, and evaluations (for notes/data)
  - Track direct and indirect service time
  - Save and reuse timesheet notes

### ⚙️ Data Management
- **SQLite Backend**: Express.js + SQLite backend for reliable data storage
  - All data stored in SQLite database (`api/data/slp-caseload.db`)
  - Better performance for large datasets
  - Automatic data persistence
- **Database Backup System**: 
  - Create, download, and restore database backups from Settings
  - Automatic cleanup keeps last 10 backups
  - One-click backup creation
  - Download backups for offsite storage
- **Test Data Seeding**: 
  - Create sample test data to explore the app (Settings → Test Data)
  - Includes a test school, teachers, and students
  - Perfect for first-time users to learn the features
  - Can be deleted anytime when ready to add real data
- **Export Functionality**: 
  - Export all data as JSON for full backup
  - Export as CSV for spreadsheet compatibility
  - Export via API endpoint for programmatic access
- **Import Functionality**: 
  - Restore data from previously exported JSON files
- **Settings**: Configure Google Gemini API key for AI features and manage test data

### 🔐 Security
- **Authentication System**: 
  - Optional password protection (enabled in production)
  - JWT-based authentication with 7-day token expiry
  - Secure password hashing with bcrypt
  - Password change in Settings
- **API Protection**: 
  - Rate limiting (100 requests/15 min for general, 10/15 min for email)
  - Input validation with Zod schemas
  - Environment-based CORS configuration

### 📚 API Documentation
- **Swagger/OpenAPI**: 
  - Interactive API documentation at `/api-docs`
  - Try out API endpoints directly in browser
  - Full schema documentation for all endpoints

## Technology Stack

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI) v6
- **Charts**: Recharts for data visualization
- **AI Integration**: Google Generative AI (Gemini API)
- **Storage**: SQLite database via Express.js backend
- **Backend**: Express.js + SQLite (required)
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or pnpm
- Google Gemini API key (optional, for AI features)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd "SLP Caseload Tracker"
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Install API dependencies:
```bash
cd api
npm install
cd ..
```

4. Start the development servers (both frontend and API are required):
```bash
pnpm dev
# or
npm run dev
```

This will automatically start both:
- **Frontend** on `http://localhost:5173` (or the port shown in the terminal)
- **API Server** on `http://localhost:3001`

> **Note**: Both servers must be running for the app to function. The `pnpm dev` command uses `concurrently` to start both servers automatically.

5. Open your browser and navigate to the frontend URL shown in the terminal

6. The SQLite database will be automatically created at `api/data/slp-caseload.db` on first run

### Configuration

1. **Gemini API Key** (for AI features):
   - Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Open Settings in the app
   - Enter your API key
   - The key is stored locally and never sent to any server except Google's Gemini API

### First Time Setup - Explore with Test Data

**New to the app?** You can quickly explore all features with sample test data:

1. **Open Settings**: Click the Settings icon (⚙️) in the navigation bar
2. **Go to Test Data Section**: Scroll down to the "Test Data" section
3. **Create Test Data**: Click "Create Test Data" to automatically generate:
   - **Test Elementary School** - A sample school
   - **6 Teachers** - One teacher for each grade (Kindergarten through 5th Grade)
   - **18 Students** - Three students per grade (Student A, B, and C) with:
     - Age-appropriate ages (5-10 years old)
     - Sample concerns (Articulation, Language)
     - Linked to their grade teacher
     - Active status

4. **Explore the App**: Once test data is created, you can:
   - Browse students and see how they're organized
   - Add goals to test students
   - Log therapy sessions
   - Try all the features with realistic sample data
   - Delete test data anytime from Settings when you're ready to add your real data

> **Note**: Test data can be deleted at any time from Settings > Test Data > Delete Test Data. This will remove all test students, teachers, and the test school.

### Backend Details

The app uses an Express + SQLite backend for data storage:

- **Database Location**: `api/data/slp-caseload.db`
- **Backups Location**: `api/data/backups/`
- **Automatic Setup**: The database is created automatically on first run
- **API Documentation**: Available at `http://localhost:3001/api-docs`

The backend provides:
- ✅ Reliable data storage (SQLite database)
- ✅ Better performance for large datasets
- ✅ Database backup & restore via UI
- ✅ Export/import endpoints
- ✅ All CRUD operations via REST API
- ✅ Full-featured API for all data types
- ✅ Rate limiting and input validation
- ✅ Optional authentication

### Environment Configuration

Create a `.env` file in the `api` folder to configure the backend:

```env
# Server
NODE_ENV=development
PORT=3001

# Authentication (disabled by default in development)
AUTH_ENABLED=false
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS (allow all origins in development)
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Backups
MAX_BACKUPS=10

# Logging
LOG_LEVEL=info
```

See the [API README](./api/README.md) for complete API documentation.

## Usage

### Getting Started

**Option 1: Start with Test Data (Recommended for First-Time Users)**
1. **Create Test Data**: Go to Settings → Test Data → Click "Create Test Data"
   - This creates a sample school with teachers and students
   - Perfect for exploring the app's features before adding your real data
2. **Explore Features**: Try adding goals, logging sessions, and exploring all the features
3. **Delete Test Data**: When ready, delete test data from Settings and add your real students

**Option 2: Start with Your Own Data**
1. **Add a School**: Navigate to Schools page and create your first school
2. **Add Teachers**: Add teachers for each school (optional, but helpful for organization)
3. **Add Students**: Navigate to the Students page and click "Add Student" to create student profiles
4. **Create Goals**: Open a student's detail page and add goals with baseline and target performance levels
5. **Log Sessions**: Use the Sessions page to document therapy sessions, track performance, and record activities
6. **Track Progress**: View detailed progress charts and generate progress notes in the Progress page
7. **Generate Ideas**: Use the Treatment Ideas page to get AI-generated activity suggestions based on goal areas and age ranges

### Data Backup

**Automatic Backup**: Your data is automatically saved to the SQLite database at `api/data/slp-caseload.db`. Simply copy this file to create a backup.

**Export Data**: You can also export your data through Settings > Export/Import Data or use the API export endpoint:
```bash
curl http://localhost:3001/api/export/all > backup.json
```

**Recommended**: Regularly copy the database file (`api/data/slp-caseload.db`) to a safe location for backups.

## Project Structure

```
SLP Caseload Tracker/
├── api/                  # Backend API server (Express + SQLite)
│   ├── src/
│   │   ├── routes/       # API route handlers
│   │   ├── db.ts         # Database setup and schema
│   │   ├── server.ts     # Express server
│   │   ├── middleware/   # Express middleware
│   │   ├── schemas/      # Zod validation schemas
│   │   ├── utils/        # Backend utilities
│   │   └── config/       # Configuration files
│   ├── data/             # SQLite database storage
│   │   ├── slp-caseload.db
│   │   └── backups/      # Database backups
│   ├── package.json
│   └── README.md         # API documentation
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── common/       # Common/shared components
│   │   ├── goal/         # Goal-related components
│   │   ├── meeting/      # Meeting-related components
│   │   ├── session/      # Session-related components
│   │   ├── student/      # Student-related components
│   │   ├── settings/     # Settings components
│   │   └── ...
│   ├── pages/            # Main application pages (routes)
│   │   ├── Dashboard.tsx
│   │   ├── Students.tsx
│   │   ├── StudentDetail.tsx
│   │   ├── Sessions.tsx
│   │   ├── SessionCalendar.tsx
│   │   ├── Progress.tsx
│   │   ├── ProgressReports.tsx
│   │   ├── TreatmentIdeas.tsx
│   │   ├── DocumentationTemplates.tsx
│   │   ├── IEPNotes.tsx
│   │   ├── SOAPNotes.tsx
│   │   ├── TimeTracking.tsx
│   │   ├── Evaluations.tsx
│   │   ├── Schools.tsx
│   │   ├── Teachers.tsx
│   │   ├── CaseManagers.tsx
│   │   ├── Communications.tsx
│   │   ├── DueDateItems.tsx
│   │   ├── Login.tsx
│   │   └── NotFound.tsx
│   ├── hooks/            # Custom React hooks
│   │   ├── useAIFeatures.ts
│   │   ├── useSessionManagement.ts
│   │   ├── useGoalManagement.ts
│   │   └── ...
│   ├── context/          # React context providers
│   │   ├── SchoolContext.tsx
│   │   ├── ThemeContext.tsx
│   │   ├── AuthContext.tsx
│   │   └── SessionDialogContext.tsx
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/            # Utility functions
│   │   ├── api.ts        # API client for backend communication
│   │   ├── storage-api.ts # Legacy storage API (if any)
│   │   ├── helpers.ts    # Helper functions
│   │   ├── gemini.ts     # Gemini AI integration
│   │   ├── goalTemplates.ts  # Goal templates library
│   │   ├── soapNoteGenerator.ts  # SOAP note generation
│   │   ├── timesheetNoteGenerator.ts  # Timesheet note generation
│   │   └── ...
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Application entry point
└── package.json
```

## Future Ideas and Roadmap

> **📝 Detailed Tracking**: For a comprehensive list of potential improvements with checkboxes for progress tracking, see [FUTURE_IMPROVEMENTS.md](./FUTURE_IMPROVEMENTS.md)

### 📱 Mobile Experience
- **Progressive Web App (PWA)**: Make the app installable on mobile devices for use during therapy sessions
- **Mobile-Optimized UI**: Improve touch interactions and layout for smaller screens
- **Offline Support**: Enhanced offline functionality with service workers

### 🔄 Cloud Sync and Collaboration
- **Cloud Storage Integration**: Option to sync data to cloud storage (Google Drive, Dropbox, etc.)
- **Multi-Device Access**: Access caseload data from any device
- **Collaborative Features**: Share caseloads with other SLPs or supervisors
- **Backup Automation**: Automatic cloud backups with version history

### 📊 Advanced Analytics
- **Cohort Analysis**: Compare progress across groups of students
- **Goal Achievement Predictions**: AI-powered predictions of goal achievement timelines
- **Custom Report Generation**: Create customizable reports for IEP meetings and progress reviews
- **Statistical Analysis**: More advanced statistical tracking and trend analysis
- **Benchmarking**: Compare student progress against typical development milestones

### 🤖 Enhanced AI Features
- **Goal Writing Assistant**: AI suggestions for writing measurable, appropriate goals based on goal area, student age, and concerns ✅ (Implemented)
- **Session Planning**: AI-generated session plans with objectives, activities, materials, and data collection strategies
- **Treatment Recommendations**: Personalized treatment recommendations based on goal progress and session history ✅ (Implemented)
- **IEP Goal Suggestions**: AI-assisted creation of comprehensive annual IEP goals from assessment data ✅ (Implemented)
- **Documentation Templates**: AI-generated professional templates for:
  - Evaluation reports
  - Progress notes ✅ (Implemented)
  - Discharge summaries
  - Treatment plans
  - SOAP notes ✅ (Implemented)

### 📋 Documentation Improvements
- **Report Templates**: Pre-built templates for progress reports, discharge summaries, and evaluation reports ✅ (Implemented - Progress Report Templates)
- **Customizable Fields**: Add custom fields to student profiles and sessions
- **Attachments**: Support for attaching files, images, or audio recordings to sessions
- **Notes Templates**: Reusable note templates for common session types

### ✅ Recently Implemented
- **Goal Templates**: Library of common goals by area (articulation, language, etc.) ✅
- **Sub-goals**: Break down complex goals into smaller, trackable sub-goals ✅
- **Goal Recommendations**: AI suggestions for appropriate goals based on student concerns ✅
- **Goal Hierarchy**: Organize goals by domain or priority ✅
- **Student Archive**: Archive functionality to manage active vs. archived caseloads ✅
- **SOAP Notes**: Full SOAP note generation and management system ✅
- **Session Scheduling**: Calendar-based session scheduling with recurring patterns ✅
- **Session Calendar**: Visual calendar view of scheduled and completed sessions ✅
- **Progress Reports**: Auto-scheduled progress reports with templates ✅
- **Due Date Items**: Comprehensive deadline tracking system ✅
- **Reminders**: Smart reminder system for goals, evaluations, and reports ✅
- **Time Tracking**: Unified time tracking dashboard for sessions and evaluations ✅
- **Schools Management**: Multi-school caseload management ✅
- **Teachers & Case Managers**: Team member tracking and linking ✅
- **Evaluations**: Complete evaluation tracking system ✅
- **Cuing Levels**: Track prompting levels for goal performance ✅
- **Direct/Indirect Services**: Service type categorization ✅
- **Group Sessions**: Support for group therapy session tracking ✅
- **IEP Date Tracking**: Track IEP dates and annual review dates per student ✅

### 📅 Scheduling and Calendar
- **Calendar Integration**: Calendar view of sessions and upcoming appointments ✅ (Implemented)
- **Session Scheduling**: Schedule future sessions with reminders ✅ (Implemented)
- **Attendance Tracking**: Track attendance and cancellations ✅ (Implemented - missed session tracking)
- **Session Templates**: Quick session creation from templates

### 🔍 Search and Filtering
- **Advanced Search**: Search across all data types (students, sessions, goals, notes)
- **Smart Filters**: Filter students by multiple criteria simultaneously
- **Tag System**: Tag students, sessions, or activities for better organization
- **Saved Filters**: Save frequently used filter combinations

### 📈 Reporting and Data Export
- **Custom Report Builder**: Drag-and-drop interface for creating custom reports
- **Export Formats**: Support for PDF, Word, and Excel exports
- **Report Scheduling**: Schedule automatic report generation
- **Data Visualization Library**: Additional chart types and visualization options

### 🏥 Compliance and Privacy
- **HIPAA Compliance**: Enhanced security features and compliance tools
- **Audit Logging**: Track all data changes for compliance
- **Data Encryption**: Enhanced encryption for sensitive data
- **Access Controls**: Role-based access control for multi-user scenarios
- **Privacy Settings**: Granular privacy controls for data sharing

### 🔗 Integrations
- **EHR Integration**: Connect with popular Electronic Health Record systems
- **Assessment Tools**: Integration with standardized assessment platforms
- **Email Integration**: Send reports and updates via email
- **Calendar Apps**: Sync with Google Calendar, Outlook, etc.
- **Billing Systems**: Integration with billing and invoicing software

### 🎨 Customization
- **Themes**: Light/dark mode and customizable color schemes
- **Customizable Dashboard**: Drag-and-drop dashboard widgets
- **Field Customization**: Add custom fields to any data type
- **Workflow Customization**: Customize data entry workflows

### 📚 Resource Library
- **Activity Library Expansion**: Community-shared activities and resources
- **Material Lists**: Track and manage therapy materials inventory
- **Resource Sharing**: Share activities and materials with other SLPs
- **External Links**: Quick access to relevant SLP resources and tools

### 🧪 Advanced Session Features
- **Video Session Recording**: Record sessions (with consent) for review
- **Real-time Collaboration**: Collaborate with other professionals during sessions
- **Session Templates**: Quick session setup from saved templates
- **Activity Tracking**: Better integration between activities and session logging

### 📱 Accessibility
- **Screen Reader Support**: Enhanced accessibility for visually impaired users
- **Keyboard Navigation**: Full keyboard accessibility
- **High Contrast Mode**: Accessibility-focused visual options
- **Multi-language Support**: Support for multiple languages

### 🎓 Educational Features
- **Learning Resources**: Built-in educational content for SLPs
- **Case Studies**: Library of anonymized case studies
- **Best Practices**: Guides and recommendations for effective therapy
- **Continuing Education Tracking**: Track CEU credits and requirements

### 🔔 Notifications and Reminders
- **Goal Reminders**: Reminders when goals need updating or review
- **Session Reminders**: Notifications for upcoming sessions
- **Progress Alerts**: Alerts when students reach milestones
- **Report Due Dates**: Reminders for upcoming report deadlines

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Specify your license here]

## Support

For issues, questions, or feature requests, please [create an issue](link-to-issues) in the repository.
