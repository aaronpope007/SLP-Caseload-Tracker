# Email Reminders Implementation Plan

This document outlines how to implement email reminders for Progress Reports and Due Date Items.

## Overview

The email reminder system will:
- Send reminders X days before progress report due dates (configurable, default 7 days)
- Send overdue reminders if reports are not completed by due date
- Support multiple email service providers (SMTP, SendGrid, AWS SES)
- Include email templates for different reminder types
- Track reminder status to avoid duplicate emails

---

## 1. Architecture Overview

### Components Needed:

1. **Email Service** - Abstraction layer for sending emails (supports multiple providers)
2. **Email Templates** - HTML/text templates for different reminder types
3. **Scheduler** - Background job to check and send reminders
4. **Configuration** - User settings for email preferences
5. **Email Queue** - Optional but recommended for reliability

### Technology Choices:

**Option 1: Nodemailer (Recommended for MVP)**
- Pros: Simple, supports SMTP, SendGrid, AWS SES, Gmail, etc.
- Cons: No built-in queue, but can use simple file-based queue
- Best for: Quick implementation, works with any SMTP server

**Option 2: SendGrid SDK**
- Pros: Reliable, great free tier (100 emails/day), built-in templates
- Cons: Vendor lock-in
- Best for: Production-ready, want managed service

**Option 3: AWS SES**
- Pros: Very cheap ($0.10 per 1000 emails), reliable
- Cons: More complex setup, requires AWS account
- Best for: High volume, already using AWS

**Recommendation:** Start with **Nodemailer** - it's flexible and can easily switch providers later.

---

## 2. Implementation Steps

### Step 1: Install Dependencies

```bash
cd api
npm install nodemailer @types/nodemailer
```

### Step 2: Email Configuration

Add to `api/.env`:
```env
# Email Configuration
EMAIL_ENABLED=true
EMAIL_PROVIDER=smtp  # smtp, sendgrid, ses, gmail
EMAIL_FROM_NAME=SLP Caseload Tracker
EMAIL_FROM_ADDRESS=noreply@yourdomain.com

# SMTP Configuration (if using SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false  # true for 465, false for other ports
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# SendGrid (if using SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key

# AWS SES (if using AWS SES)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Reminder Settings
REMINDER_DAYS_BEFORE_DUE=7
SEND_OVERDUE_REMINDERS=true
```

### Step 3: Create Email Service Module

Create `api/src/utils/emailService.ts`:

```typescript
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  const provider = process.env.EMAIL_PROVIDER || 'smtp';
  const isEnabled = process.env.EMAIL_ENABLED === 'true';

  if (!isEnabled) {
    throw new Error('Email is not enabled. Set EMAIL_ENABLED=true');
  }

  switch (provider) {
    case 'smtp':
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
      break;

    case 'sendgrid':
      // SendGrid requires a custom transport
      // You can use nodemailer-sendgrid-transport or sendgrid SDK directly
      throw new Error('SendGrid not yet implemented. Use SMTP for now.');
    
    case 'gmail':
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD, // Use App Password, not regular password
        },
      });
      break;

    default:
      throw new Error(`Unsupported email provider: ${provider}`);
  }

  return transporter;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const isEnabled = process.env.EMAIL_ENABLED === 'true';
  
  if (!isEnabled) {
    console.log('[Email] Email disabled. Would send:', options);
    return;
  }

  try {
    const emailTransporter = getTransporter();
    const fromName = process.env.EMAIL_FROM_NAME || 'SLP Caseload Tracker';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;

    await emailTransporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    });

    console.log(`[Email] Sent email to ${options.to}: ${options.subject}`);
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    throw error;
  }
}

export function isEmailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === 'true';
}
```

### Step 4: Create Email Templates

Create `api/src/utils/emailTemplates.ts`:

```typescript
export interface ProgressReportReminderData {
  studentName: string;
  reportType: 'quarterly' | 'annual';
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  daysUntilDue: number;
}

export interface OverdueReportReminderData {
  studentName: string;
  reportType: 'quarterly' | 'annual';
  dueDate: string;
  daysOverdue: number;
  periodStart: string;
  periodEnd: string;
}

export function generateProgressReportReminder(data: ProgressReportReminderData): string {
  const reportTypeLabel = data.reportType === 'quarterly' ? 'Quarterly' : 'Annual';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        .button { display: inline-block; padding: 10px 20px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Progress Report Reminder</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>This is a reminder that you have a <strong>${reportTypeLabel} Progress Report</strong> due soon.</p>
          
          <div class="info-row">
            <span class="label">Student:</span> ${data.studentName}
          </div>
          <div class="info-row">
            <span class="label">Report Type:</span> ${reportTypeLabel}
          </div>
          <div class="info-row">
            <span class="label">Reporting Period:</span> ${data.periodStart} to ${data.periodEnd}
          </div>
          <div class="info-row">
            <span class="label">Due Date:</span> ${data.dueDate}
          </div>
          <div class="info-row">
            <span class="label">Days Remaining:</span> ${data.daysUntilDue} day${data.daysUntilDue !== 1 ? 's' : ''}
          </div>
          
          <p>Please complete this report before the due date.</p>
          
          <p style="margin-top: 30px;">
            <a href="${process.env.APP_URL || 'http://localhost:5173'}/progress-reports" class="button">
              View Progress Reports
            </a>
          </p>
        </div>
        <div class="footer">
          <p>This is an automated reminder from SLP Caseload Tracker</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateOverdueReportReminder(data: OverdueReportReminderData): string {
  const reportTypeLabel = data.reportType === 'quarterly' ? 'Quarterly' : 'Annual';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #d32f2f; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; }
        .alert { background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        .button { display: inline-block; padding: 10px 20px; background-color: #d32f2f; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Overdue Progress Report</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          
          <div class="alert">
            <strong>This progress report is overdue!</strong>
          </div>
          
          <div class="info-row">
            <span class="label">Student:</span> ${data.studentName}
          </div>
          <div class="info-row">
            <span class="label">Report Type:</span> ${reportTypeLabel}
          </div>
          <div class="info-row">
            <span class="label">Due Date:</span> ${data.dueDate}
          </div>
          <div class="info-row">
            <span class="label">Days Overdue:</span> ${data.daysOverdue} day${data.daysOverdue !== 1 ? 's' : ''}
          </div>
          
          <p>Please complete this report as soon as possible.</p>
          
          <p style="margin-top: 30px;">
            <a href="${process.env.APP_URL || 'http://localhost:5173'}/progress-reports" class="button">
              View Progress Reports
            </a>
          </p>
        </div>
        <div class="footer">
          <p>This is an automated reminder from SLP Caseload Tracker</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
```

### Step 5: Create Reminder Scheduler

Create `api/src/utils/reminderScheduler.ts`:

```typescript
import { db } from '../db';
import { sendEmail, isEmailEnabled } from './emailService';
import {
  generateProgressReportReminder,
  generateOverdueReportReminder,
  type ProgressReportReminderData,
  type OverdueReportReminderData,
} from './emailTemplates';

const REMINDER_DAYS_BEFORE_DUE = parseInt(process.env.REMINDER_DAYS_BEFORE_DUE || '7');
const SEND_OVERDUE_REMINDERS = process.env.SEND_OVERDUE_REMINDERS !== 'false';
const USER_EMAIL = process.env.USER_EMAIL || ''; // You'll need to add user email setting

interface ReminderResult {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

/**
 * Send reminder emails for progress reports due soon
 */
export async function sendProgressReportReminders(): Promise<ReminderResult> {
  if (!isEmailEnabled() || !USER_EMAIL) {
    console.log('[Reminders] Email reminders disabled or no user email configured');
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const result: ReminderResult = { sent: 0, failed: 0, skipped: 0 };
  const now = new Date();
  const reminderDate = new Date(now);
  reminderDate.setDate(reminderDate.getDate() + REMINDER_DAYS_BEFORE_DUE);
  const reminderDateStr = reminderDate.toISOString().split('T')[0];

  // Find reports due in X days that haven't been reminded yet
  const reports = db.prepare(`
    SELECT pr.*, s.name as studentName
    FROM progress_reports pr
    INNER JOIN students s ON pr.studentId = s.id
    WHERE pr.status != 'completed'
      AND pr.dueDate = ?
      AND (pr.reminderSent = 0 OR pr.reminderSent IS NULL)
    ORDER BY pr.dueDate ASC
  `).all(reminderDateStr) as any[];

  for (const report of reports) {
    try {
      const dueDate = new Date(report.dueDate);
      const daysUntilDue = daysBetween(now, dueDate);

      const reminderData: ProgressReportReminderData = {
        studentName: report.studentName,
        reportType: report.reportType,
        dueDate: dueDate.toLocaleDateString(),
        periodStart: new Date(report.periodStart).toLocaleDateString(),
        periodEnd: new Date(report.periodEnd).toLocaleDateString(),
        daysUntilDue,
      };

      await sendEmail({
        to: USER_EMAIL,
        subject: `Progress Report Reminder: ${report.studentName} - ${report.reportType === 'quarterly' ? 'Quarterly' : 'Annual'} Report Due in ${daysUntilDue} Days`,
        html: generateProgressReportReminder(reminderData),
      });

      // Mark as reminded
      db.prepare(`
        UPDATE progress_reports
        SET reminderSent = 1, reminderSentDate = ?, dateUpdated = ?
        WHERE id = ?
      `).run(new Date().toISOString(), new Date().toISOString(), report.id);

      result.sent++;
      console.log(`[Reminders] Sent reminder for report ${report.id}`);
    } catch (error) {
      console.error(`[Reminders] Failed to send reminder for report ${report.id}:`, error);
      result.failed++;
    }
  }

  return result;
}

/**
 * Send overdue reminder emails
 */
export async function sendOverdueReminders(): Promise<ReminderResult> {
  if (!isEmailEnabled() || !USER_EMAIL || !SEND_OVERDUE_REMINDERS) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const result: ReminderResult = { sent: 0, failed: 0, skipped: 0 };
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Find overdue reports (check daily for overdue)
  const reports = db.prepare(`
    SELECT pr.*, s.name as studentName
    FROM progress_reports pr
    INNER JOIN students s ON pr.studentId = s.id
    WHERE pr.status = 'overdue'
      AND pr.dueDate < ?
      AND (pr.reminderSentDate IS NULL OR DATE(pr.reminderSentDate) < DATE('now'))
    ORDER BY pr.dueDate ASC
  `).all(todayStr) as any[];

  for (const report of reports) {
    try {
      const dueDate = new Date(report.dueDate);
      const daysOverdue = daysBetween(dueDate, now);

      const reminderData: OverdueReportReminderData = {
        studentName: report.studentName,
        reportType: report.reportType,
        dueDate: dueDate.toLocaleDateString(),
        daysOverdue,
        periodStart: new Date(report.periodStart).toLocaleDateString(),
        periodEnd: new Date(report.periodEnd).toLocaleDateString(),
      };

      await sendEmail({
        to: USER_EMAIL,
        subject: `⚠️ Overdue Progress Report: ${report.studentName} - ${daysOverdue} Days Overdue`,
        html: generateOverdueReportReminder(reminderData),
      });

      // Update reminder date (don't mark as sent so we can send daily reminders)
      db.prepare(`
        UPDATE progress_reports
        SET reminderSentDate = ?, dateUpdated = ?
        WHERE id = ?
      `).run(new Date().toISOString(), new Date().toISOString(), report.id);

      result.sent++;
      console.log(`[Reminders] Sent overdue reminder for report ${report.id}`);
    } catch (error) {
      console.error(`[Reminders] Failed to send overdue reminder for report ${report.id}:`, error);
      result.failed++;
    }
  }

  return result;
}

/**
 * Run all reminder checks
 */
export async function runReminderChecks(): Promise<{ upcoming: ReminderResult; overdue: ReminderResult }> {
  console.log('[Reminders] Running reminder checks...');
  const upcoming = await sendProgressReportReminders();
  const overdue = await sendOverdueReminders();
  
  console.log(`[Reminders] Completed: ${upcoming.sent + overdue.sent} reminders sent, ${upcoming.failed + overdue.failed} failed`);
  
  return { upcoming, overdue };
}
```

### Step 6: Add Scheduled Job

Add to `api/src/server.ts`:

```typescript
import { runReminderChecks } from './utils/reminderScheduler';

// ... existing code ...

// Schedule reminder checks (runs every hour)
setInterval(async () => {
  try {
    await runReminderChecks();
  } catch (error) {
    console.error('[Server] Error in reminder scheduler:', error);
  }
}, 60 * 60 * 1000); // Every hour

// Run immediately on startup (optional)
if (process.env.EMAIL_ENABLED === 'true') {
  setTimeout(async () => {
    console.log('[Server] Running initial reminder check...');
    try {
      await runReminderChecks();
    } catch (error) {
      console.error('[Server] Error in initial reminder check:', error);
    }
  }, 5000); // Wait 5 seconds after server starts
}
```

### Step 7: Add Manual Trigger Endpoint

Add to `api/src/routes/progress-reports.ts`:

```typescript
import { runReminderChecks } from '../utils/reminderScheduler';

// ... existing routes ...

// Manually trigger reminder checks (for testing)
progressReportsRouter.post('/reminders/send', async (req, res) => {
  try {
    const result = await runReminderChecks();
    res.json({
      message: 'Reminders sent',
      upcoming: result.upcoming,
      overdue: result.overdue,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 3. User Email Configuration

### Option A: Environment Variable (Simple)
Just add `USER_EMAIL` to `.env` file.

### Option B: Database Table (Recommended for Multi-User)
Create a settings table:

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  dateUpdated TEXT NOT NULL
);
```

Then store user email: `INSERT INTO settings (key, value, dateUpdated) VALUES ('user_email', 'user@example.com', datetime('now'))`

### Option C: User Profile (Best for Future Multi-User Support)
Add email field to a users table when you implement authentication.

---

## 4. Testing

### Test Email Sending:

1. Set up `.env` file with email credentials
2. Test with a simple endpoint:

```typescript
// Add to server.ts for testing
app.get('/test-email', async (req, res) => {
  try {
    await sendEmail({
      to: process.env.USER_EMAIL || '',
      subject: 'Test Email',
      html: '<h1>Test Email</h1><p>If you receive this, email is working!</p>',
    });
    res.json({ message: 'Test email sent' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

3. Visit `http://localhost:3001/test-email` to send a test email

### Test Reminders:

1. Create a test progress report with due date 7 days from now
2. Manually trigger: `POST /api/progress-reports/reminders/send`
3. Check your email inbox

---

## 5. Production Considerations

### Email Queue (For Reliability)

For production, consider implementing an email queue:

1. **Simple File-Based Queue** (Easy)
   - Store pending emails in a JSON file or SQLite table
   - Process queue periodically
   - Retry failed emails

2. **Redis Queue** (Better)
   - Use `bull` or `bullmq` for job queues
   - Automatic retries and job management
   - Better for scaling

3. **Database Queue Table** (Middle Ground)
   ```sql
   CREATE TABLE email_queue (
     id TEXT PRIMARY KEY,
     to_address TEXT NOT NULL,
     subject TEXT NOT NULL,
     html TEXT NOT NULL,
     status TEXT NOT NULL, -- pending, sent, failed
     attempts INTEGER DEFAULT 0,
     dateCreated TEXT NOT NULL,
     dateSent TEXT
   );
   ```

### Rate Limiting

- Most email providers have rate limits
- Implement delays between emails if sending many at once
- Consider batching emails

### Error Handling

- Log all email failures
- Retry failed emails with exponential backoff
- Send admin alerts if email service is down

---

## 6. Next Steps

1. **Immediate:**
   - Install nodemailer
   - Create email service module
   - Set up `.env` configuration
   - Test with a simple email

2. **Phase 2:**
   - Create email templates
   - Implement reminder scheduler
   - Add scheduled job to server
   - Test end-to-end

3. **Phase 3:**
   - Add user email configuration UI
   - Implement email queue for reliability
   - Add email preferences (daily digest, etc.)
   - Add email history/logs

4. **Future:**
   - Support for multiple recipients
   - Email templates customization
   - Email preferences per user
   - Integration with calendar systems

---

## 7. Security Considerations

- **Never commit `.env` file** - Already in `.gitignore`
- **Use App Passwords** for Gmail (not regular passwords)
- **Store credentials securely** - Consider using secrets management service
- **Rate limiting** - Prevent abuse
- **Validate email addresses** - Sanitize inputs
- **BCC for privacy** - Consider BCC'ing multiple recipients instead of TO

---

## 8. Alternative: Use a Service (Simpler)

If you want to avoid setting up email infrastructure, consider:

- **SendGrid Free Tier** - 100 emails/day free
- **Mailgun** - 5,000 emails/month free
- **Resend** - Modern email API, 3,000 emails/month free
- **Postmark** - Great for transactional emails

These services provide SDKs that are simpler than SMTP setup.

