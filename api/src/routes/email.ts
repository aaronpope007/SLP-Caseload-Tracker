import express from 'express';
import nodemailer from 'nodemailer';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { emailSchema } from '../schemas';

const router = express.Router();

router.post('/send', validateBody(emailSchema), asyncHandler(async (req, res) => {
  const {
    to,
    subject,
    body,
    fromEmail,
    fromName,
    smtpHost = 'smtp.gmail.com',
    smtpPort = 587,
    smtpUser,
    smtpPassword,
    cc,
    bcc,
  } = req.body;

  if (!smtpUser || !smtpPassword) {
    return res.status(400).json({ 
      error: 'SMTP credentials are required',
      details: [
        { field: 'smtpUser', message: 'SMTP username is required' },
        { field: 'smtpPassword', message: 'SMTP password is required' }
      ]
    });
  }

  // Truncate subject if too long to avoid SMTP "command line too long" error
  // Gmail SMTP has limits on header line length (RFC 5321/5322: 998 chars max per line)
  // Using 200 chars as a safe limit for Gmail SMTP
  const MAX_SUBJECT_LENGTH = 200;
  const truncatedSubject = subject.length > MAX_SUBJECT_LENGTH 
    ? subject.substring(0, MAX_SUBJECT_LENGTH - 3) + '...'
    : subject;

  // Truncate fromName if too long (max 78 chars per RFC 5322 display-name recommendation)
  const MAX_FROM_NAME_LENGTH = 78;
  const truncatedFromName = fromName && fromName.length > MAX_FROM_NAME_LENGTH
    ? fromName.substring(0, MAX_FROM_NAME_LENGTH - 3) + '...'
    : fromName;

  // Gmail (and RFC 5321) enforces a max line length (1000 incl CRLF).
  // If the user pastes a long unbroken line (URLs, copied tables, AI output),
  // Gmail may reject the message with "555-5.5.2 ... command line too long".
  const wrapLongLines = (text: string, maxLen = 900): string => {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    const wrapped: string[] = [];
    for (const line of lines) {
      if (line.length <= maxLen) {
        wrapped.push(line);
        continue;
      }
      for (let i = 0; i < line.length; i += maxLen) {
        wrapped.push(line.slice(i, i + maxLen));
      }
    }
    return wrapped.join('\n');
  };

  const safeBody = wrapLongLines(body);

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  const mailOptions: {
    from: string;
    to: string;
    subject: string;
    text: string;
    cc?: string | string[];
    bcc?: string | string[];
  } = {
    from: truncatedFromName && fromEmail ? `"${truncatedFromName}" <${fromEmail}>` : fromEmail || smtpUser,
    to,
    subject: truncatedSubject,
    text: safeBody,
  };

  // Add CC if provided
  if (cc) {
    mailOptions.cc = cc;
  }

  // Add BCC if provided
  if (bcc) {
    mailOptions.bcc = bcc;
  }

  try {
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      messageId: info.messageId,
      message: 'Email sent successfully',
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    const lower = raw.toLowerCase();

    const gmailAuthRejected =
      lower.includes('invalid login') ||
      lower.includes('535') ||
      lower.includes('badcredentials') ||
      lower.includes('username and password not accepted') ||
      lower.includes('authentication failed') ||
      lower.includes('535-5.7.8');

    if (gmailAuthRejected) {
      return res.status(400).json({
        error:
          'The mail server rejected your SMTP username or password. For Gmail: turn on 2-Step Verification, then create an App Password (Google Account → Security → App passwords) and paste that 16-character password here—not your normal Gmail password. Use your full Gmail address as the SMTP user.',
        code: 'SMTP_AUTH_REJECTED',
      });
    }

    if (
      lower.includes('econnrefused') ||
      lower.includes('etimedout') ||
      lower.includes('enotfound') ||
      lower.includes('getaddrinfo')
    ) {
      return res.status(502).json({
        error: `Could not reach the mail server at ${smtpHost}:${smtpPort}. Check host/port, firewall, and your network.`,
        code: 'SMTP_CONNECTION_FAILED',
      });
    }

    throw err;
  }
}));

export { router as emailRouter };
