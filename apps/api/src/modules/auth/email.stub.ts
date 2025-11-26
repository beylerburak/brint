import { logger } from '../../lib/logger.js';

interface SendMagicLinkEmailInput {
  to: string;
  magicLinkUrl: string;
}

/**
 * Email stub for magic link emails
 * Currently only logs the email; real email service will be implemented later
 */
export async function sendMagicLinkEmailStub(input: SendMagicLinkEmailInput): Promise<void> {
  const { to, magicLinkUrl } = input;

  // Structured log
  logger.info(
    {
      service: 'auth',
      type: 'magic-link-email-stub',
      to,
      magicLinkUrl,
    },
    'Magic link email stub'
  );

  // Console log for dev convenience
  console.log(`\n📧 Magic link for ${to}:`);
  console.log(`   ${magicLinkUrl}\n`);
}

