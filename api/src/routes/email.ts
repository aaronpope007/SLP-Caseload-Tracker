import express from 'express';
import nodemailer from 'nodemailer';
import { asyncHandler } from '../middleware/asyncHandler';

const router = express.Router();

interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  fromEmail?: string;
  fromName?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
}

router.post('/send', asyncHandler(async (req, res) => {
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
  }: SendEmailRequest = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
  }

  if (!smtpUser || !smtpPassword) {
    return res.status(400).json({ error: 'SMTP credentials are required' });
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

  // Verify connection
  await transporter.verify();

  // Send email
  const mailOptions = {
    from: truncatedFromName && fromEmail ? `"${truncatedFromName}" <${fromEmail}>` : fromEmail || smtpUser,
    to,
    subject: truncatedSubject,
    text: body,
  };

  const info = await transporter.sendMail(mailOptions);

  res.json({
    success: true,
    messageId: info.messageId,
    message: 'Email sent successfully',
  });
}));

export { router as emailRouter };

