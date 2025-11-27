import nodemailer from 'nodemailer';
import { emailConfig } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

// Create transporter if SMTP is configured
let transporter: nodemailer.Transporter | null = null;

if (emailConfig.enabled && emailConfig.smtp.host) {
  transporter = nodemailer.createTransport({
    host: emailConfig.smtp.host,
    port: emailConfig.smtp.port ?? 587,
    secure: emailConfig.smtp.secure,
    auth: emailConfig.smtp.auth,
  });

  logger.info(
    {
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
    },
    'SMTP transporter initialized'
  );
} else {
  logger.warn(
    {
      reason: 'SMTP_HOST not configured',
    },
    'SMTP disabled - magic link emails will only be logged'
  );
}

/**
 * Send magic link email
 * If SMTP is not configured, logs the email URL instead
 */
export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  if (!transporter) {
    // Debug mode: log the email
    console.warn('[EMAIL] SMTP disabled, magic link only logged:', url);
    logger.info(
      {
        service: 'auth',
        type: 'magic-link-email-stub',
        to,
        magicLinkUrl: url,
      },
      'Magic link email stub (SMTP not configured)'
    );
    // Console log for dev convenience
    console.log(`\n📧 Magic link for ${to}:`);
    console.log(`   ${url}\n`);
    return;
  }

  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to,
      subject: 'Your Magic Login Link',
      html: `
        <p>Merhaba,</p>
        <p>Giriş yapmak için aşağıdaki linke tıklayın:</p>
        <p><a href="${url}">${url}</a></p>
        <p>Bu link 15 dakika içinde geçerlidir.</p>
      `,
    });

    logger.info(
      {
        to,
        url: url.substring(0, 50) + '...',
      },
      'Magic link email sent successfully'
    );
  } catch (error) {
    logger.error(
      {
        error,
        to,
      },
      'Failed to send magic link email'
    );
    // Don't throw - we don't want to fail the request if email fails
    // Just log it and continue
  }
}

