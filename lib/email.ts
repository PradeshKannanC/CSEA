import { Resend } from 'resend';

export interface SendPasswordResetOptions {
  to: string;
  rawToken?: string;
  resetUrl?: string;
  baseUrl?: string;
  expiresAt?: Date;
}

export interface EmailResult {
  success: boolean;
  provider?: 'resend';
  providerAccepted?: boolean;
  messageId?: string;
  error?: string;
  missingConfig?: string[];
}

/**
 * Checks whether Resend transactional email provider is configured.
 * Does NOT require SMTP credentials.
 */
export function verifyEmailConfig(): {
  configured: boolean;
  provider: 'resend' | 'none';
  missing: string[];
} {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const isKeyMissingOrPlaceholder =
    !resendKey ||
    resendKey.length === 0 ||
    resendKey === 'YOUR_REAL_RESEND_API_KEY' ||
    resendKey.startsWith('re_xxxx');

  if (isKeyMissingOrPlaceholder) {
    return {
      configured: false,
      provider: 'none',
      missing: ['RESEND_API_KEY'],
    };
  }

  const missing: string[] = [];
  const emailFrom = process.env.EMAIL_FROM?.trim();
  if (!emailFrom || emailFrom === 'YOUR_VERIFIED_SENDER') {
    missing.push('EMAIL_FROM');
  }

  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL)?.trim();
  if (!appUrl) {
    missing.push('APP_URL');
  }

  if (missing.length > 0) {
    return {
      configured: false,
      provider: 'none',
      missing,
    };
  }

  return {
    configured: true,
    provider: 'resend',
    missing: [],
  };
}

/**
 * Sends a real password reset email using Resend.
 * Never mocks success: returns actual delivery status or exact failure diagnostics.
 */
export async function sendPasswordResetEmail(
  options: SendPasswordResetOptions
): Promise<EmailResult> {
  const to = options.to;
  const recipientDomain = to.split('@')[1] || 'unknown';

  let baseUrl = (options.baseUrl || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && (!baseUrl || baseUrl.includes('localhost'))) {
    if (options.baseUrl && !options.baseUrl.includes('localhost')) {
      baseUrl = options.baseUrl.replace(/\/$/, '');
    } else {
      console.warn('[SECURITY WARNING] Production password reset email generated with localhost or empty baseUrl. Please configure APP_URL.');
    }
  }

  if (!baseUrl) {
    baseUrl = 'http://localhost:3000';
  }

  const resetUrl = options.resetUrl || `${baseUrl}/reset-password?token=${encodeURIComponent(options.rawToken || '')}`;
  const rawFrom = process.env.EMAIL_FROM?.trim() || 'onboarding@resend.dev';
  const from = rawFrom.includes('<') ? rawFrom : `PITCH AND PROSPER by CSEA <${rawFrom}>`;
  const subject = 'Reset your PITCH AND PROSPER password';

  const textContent = `PITCH AND PROSPER by CSEA

Someone requested a password reset for your account.

Use the link below to create a new password:
${resetUrl}

This link expires in 30 minutes.

If you did not request this reset, you can safely ignore this email.

---
Pitch & Prosper | Computer Science & Engineering Association
`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your PITCH AND PROSPER password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #07090E;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #E2E8F0;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #07090E;
      padding: 40px 16px;
    }
    .card {
      max-width: 540px;
      margin: 0 auto;
      background-color: #0F1422;
      border: 1px solid rgba(99, 91, 255, 0.25);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .header {
      padding: 32px 32px 24px 32px;
      background: linear-gradient(180deg, rgba(99, 91, 255, 0.12) 0%, rgba(15, 20, 34, 0) 100%);
      text-align: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #FFFFFF;
      margin: 0 0 6px 0;
    }
    .brand-subtitle {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      color: #A5B4FC;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      background: rgba(99, 91, 255, 0.15);
      padding: 4px 12px;
      border-radius: 9999px;
      border: 1px solid rgba(99, 91, 255, 0.3);
    }
    .body-content {
      padding: 36px 32px;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      color: #F8FAFC;
      margin: 0 0 16px 0;
    }
    .paragraph {
      font-size: 14px;
      line-height: 1.6;
      color: #94A3B8;
      margin: 0 0 24px 0;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn-reset {
      display: inline-block;
      background: #635BFF;
      color: #FFFFFF !important;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(99, 91, 255, 0.4);
    }
    .expiry-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 12px;
      color: #CBD5E1;
      margin-bottom: 20px;
    }
    .footer {
      padding: 24px 32px;
      background: #0B0E17;
      text-align: center;
      font-size: 12px;
      color: #64748B;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand-title">PITCH AND PROSPER</div>
        <div class="brand-subtitle">CSEA ARENA</div>
      </div>
      <div class="body-content">
        <div class="title">Password Reset Request</div>
        <p class="paragraph">
          Someone requested a password reset for your account. Click the button below to choose a new password:
        </p>
        <div class="button-container">
          <a href="${resetUrl}" class="btn-reset" target="_blank" rel="noopener noreferrer">
            RESET PASSWORD
          </a>
        </div>
        <div class="expiry-box">
          ⏱ <strong>This link expires in 30 minutes.</strong>
        </div>
        <p class="paragraph" style="font-size: 12px; color: #64748B; margin-bottom: 0;">
          If you did not request this reset, you can safely ignore this email. Your existing password will remain unchanged.
        </p>
      </div>
      <div class="footer">
        PITCH AND PROSPER &bull; Computer Science &amp; Engineering Association
      </div>
    </div>
  </div>
</body>
</html>`;

  const config = verifyEmailConfig();

  // 1. Check if Resend is configured
  if (!config.configured) {
    const errorMsg = config.missing.includes('RESEND_API_KEY')
      ? 'RESEND_API_KEY is not configured.'
      : `Missing required email configuration: ${config.missing.join(', ')}`;

    console.warn('[EMAIL_DELIVERY_DIAGNOSTICS] Password reset requested', {
      provider: 'Resend',
      recipientDomain,
      status: 'failed',
      error: errorMsg,
    });

    return {
      success: false,
      error: errorMsg,
      missingConfig: config.missing,
    };
  }

  // 2. Dispatch via Resend
  try {
    const resend = new Resend(process.env.RESEND_API_KEY!.trim());
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      text: textContent,
      html: htmlContent,
    });

    if (error) {
      console.error('[EMAIL_DELIVERY_DIAGNOSTICS] Password reset requested', {
        provider: 'Resend',
        recipientDomain,
        status: 'failed',
        error: error.message,
      });

      return {
        success: false,
        provider: 'resend',
        error: error.message || 'Resend email dispatch rejected',
      };
    }

    console.log('[EMAIL_DELIVERY_DIAGNOSTICS] Password reset requested', {
      provider: 'Resend',
      recipientDomain,
      providerResponse: 'accepted',
      messageId: data?.id,
    });

    return {
      success: true,
      provider: 'resend',
      providerAccepted: true,
      messageId: data?.id,
    };
  } catch (err: any) {
    console.error('[EMAIL_DELIVERY_DIAGNOSTICS] Password reset requested', {
      provider: 'Resend',
      recipientDomain,
      status: 'failed',
      error: err?.message || 'Resend network error',
    });

    return {
      success: false,
      provider: 'resend',
      error: err?.message || 'Resend network error',
    };
  }
}
