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
    from: fromName && fromEmail ? `"${fromName}" <${fromEmail}>` : fromEmail || smtpUser,
    to,
    subject,
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

