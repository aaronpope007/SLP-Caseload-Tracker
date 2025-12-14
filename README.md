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
- **Search Functionality**: Search students by name, grade, or concerns
- **Student Detail Pages**: Dedicated pages for each student showing all associated goals

### 🎯 Goal Management
- **Goal Creation**: Set individual goals for each student with:
  - Detailed goal descriptions
  - Baseline performance levels
  - Target performance levels
  - Status tracking (in-progress, achieved, modified)
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

### 💡 AI-Powered Treatment Ideas
- **Smart Activity Generation**: Generate creative, age-appropriate treatment activities using Google Gemini AI
- **Customizable Parameters**:
  - Goal area (e.g., Articulation, Language, Fluency)
  - Age range
  - Available materials
- **Activity Library**: Save generated or manually created activities
- **Favorites System**: Mark frequently used activities as favorites for quick access
- **Activity Details**: Each activity includes descriptions, materials needed, and step-by-step instructions

### ⚙️ Data Management
- **Export Functionality**: 
  - Export all data as JSON for full backup
  - Export as CSV for spreadsheet compatibility
- **Import Functionality**: Restore data from previously exported JSON files
- **Local Storage**: All data is stored locally in your browser for privacy and security
- **Settings**: Configure Google Gemini API key for AI features

## Technology Stack

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI) v6
- **Charts**: Recharts for data visualization
- **AI Integration**: Google Generative AI (Gemini API)
- **Storage**: Browser localStorage
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

3. Start the development server:
```bash
npm run dev
# or
pnpm dev
```

4. Open your browser and navigate to `http://localhost:5173` (or the port shown in the terminal)

### Configuration

1. **Gemini API Key** (for AI features):
   - Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Open Settings in the app
   - Enter your API key
   - The key is stored locally and never sent to any server except Google's Gemini API

## Usage

### Getting Started

1. **Add Students**: Navigate to the Students page and click "Add Student" to create student profiles
2. **Create Goals**: Open a student's detail page and add goals with baseline and target performance levels
3. **Log Sessions**: Use the Sessions page to document therapy sessions, track performance, and record activities
4. **Track Progress**: View detailed progress charts and generate progress notes in the Progress page
5. **Generate Ideas**: Use the Treatment Ideas page to get AI-generated activity suggestions based on goal areas and age ranges

### Data Backup

Regularly export your data through Settings > Export/Import Data to create backups. This is especially important since data is stored locally in your browser.

## Project Structure

```
SLP Caseload Tracker/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── ErrorBoundary.tsx
│   │   ├── ExportDialog.tsx
│   │   ├── Layout.tsx
│   │   └── SettingsDialog.tsx
│   ├── pages/            # Main application pages
│   │   ├── Dashboard.tsx
│   │   ├── Students.tsx
│   │   ├── StudentDetail.tsx
│   │   ├── Sessions.tsx
│   │   ├── Progress.tsx
│   │   └── TreatmentIdeas.tsx
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/            # Utility functions
│   │   ├── storage.ts    # LocalStorage operations
│   │   ├── helpers.ts    # Helper functions
│   │   └── gemini.ts     # Gemini AI integration
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Application entry point
└── package.json
```

## Future Ideas and Roadmap

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
- **Goal Writing Assistant**: AI suggestions for writing measurable, appropriate goals
- **Session Planning**: AI-generated session plans based on goals and student needs
- **Treatment Recommendations**: Personalized treatment recommendations based on student progress
- **IEP Goal Suggestions**: AI-assisted creation of IEP goals from assessment data
- **Documentation Templates**: AI-generated templates for various documentation needs

### 📋 Documentation Improvements
- **Report Templates**: Pre-built templates for progress reports, discharge summaries, and evaluation reports
- **Customizable Fields**: Add custom fields to student profiles and sessions
- **Attachments**: Support for attaching files, images, or audio recordings to sessions
- **Notes Templates**: Reusable note templates for common session types

### 🎯 Goal Management Enhancements
- **Goal Templates**: Library of common goals by area (articulation, language, etc.)
- **Sub-goals**: Break down complex goals into smaller, trackable sub-goals
- **Goal Recommendations**: AI suggestions for appropriate goals based on student concerns
- **Goal Hierarchy**: Organize goals by domain or priority

### 📅 Scheduling and Calendar
- **Calendar Integration**: Calendar view of sessions and upcoming appointments
- **Session Scheduling**: Schedule future sessions with reminders
- **Attendance Tracking**: Track attendance and cancellations
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
