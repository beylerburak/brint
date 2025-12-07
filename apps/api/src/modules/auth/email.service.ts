import nodemailer from 'nodemailer';
import { smtpConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

/**
 * Email service for sending verification codes and other auth-related emails
 * Uses nodemailer with SMTP configuration from environment variables
 */

// Create reusable transporter (singleton pattern)
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  // Return null if SMTP is not configured (for development/testing)
  if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
    logger.warn('SMTP not configured, email sending will be disabled');
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port ?? 465,
      secure: smtpConfig.secure ?? true, // true for 465, false for other ports
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });
  }

  return transporter;
}

interface SendVerificationCodeEmailInput {
  to: string;
  code: string;
  userName?: string;
}

/**
 * Sends email verification code to user
 * 
 * Security notes:
 * - Code is 6-digit numeric (100000-999999)
 * - Code expires in 10 minutes
 * - Maximum 5 verification attempts allowed
 * - Code is single-use (marked as used after successful verification)
 */
export async function sendVerificationCodeEmail(
  input: SendVerificationCodeEmailInput
): Promise<void> {
  const { to, code, userName } = input;

  const transporter = getTransporter();

  // If SMTP is not configured, log the email for development
  if (!transporter) {
    logger.info(
      {
        service: 'auth',
        type: 'verification-code-email-stub',
        to,
        code,
      },
      'Email verification code (SMTP not configured)'
    );
    console.log(`\n📧 Verification code for ${to}:`);
    console.log(`   Code: ${code}\n`);
    return;
  }

  try {
    const mailOptions = {
      from: smtpConfig.from || smtpConfig.user,
      to,
      subject: 'Verify your email address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center;">
              <h1 style="color: #1a1a1a; margin-bottom: 10px;">Verify your email</h1>
              <p style="color: #666; margin-bottom: 30px;">
                ${userName ? `Hi ${userName},` : 'Hi,'}<br>
                Use the code below to verify your email address:
              </p>
              <div style="background-color: #ffffff; border: 2px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0; display: inline-block;">
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a; font-family: 'Courier New', monospace;">
                  ${code}
                </div>
              </div>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                This code will expire in 10 minutes.<br>
                If you didn't request this code, you can safely ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
Verify your email address

${userName ? `Hi ${userName},` : 'Hi,'}

Use the code below to verify your email address:

${code}

This code will expire in 10 minutes.

If you didn't request this code, you can safely ignore this email.
      `.trim(),
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(
      {
        service: 'auth',
        type: 'verification-code-email-sent',
        to,
        messageId: info.messageId,
      },
      'Email verification code sent successfully'
    );
  } catch (error) {
    logger.error(
      {
        error,
        to,
      },
      'Failed to send verification code email'
    );
    // Don't throw - allow the request to continue even if email fails
    // The code is still saved in DB and can be verified
    throw new Error('Failed to send verification email');
  }
}
