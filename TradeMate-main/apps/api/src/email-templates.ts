const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

type EmailKind = 'welcome' | 'verification' | 'security' | 'password' | 'account';

const getEmailKind = (subject: string): EmailKind => {
  const value = subject.toLowerCase();
  if (value.includes('verify') || value.includes('verification')) return 'verification';
  if (value.includes('sign-in') || value.includes('sign in') || value.includes('login')) return 'security';
  if (value.includes('password')) return 'password';
  if (value.includes('deletion') || value.includes('account')) return 'account';
  return 'welcome';
};

const emailPresentation: Record<EmailKind, { label: string; symbol: string; accent: string }> = {
  welcome: { label: 'WELCOME TO TRADEMATE', symbol: '✦', accent: '#F6A43A' },
  verification: { label: 'EMAIL VERIFICATION', symbol: '✓', accent: '#F6A43A' },
  security: { label: 'ACCOUNT SECURITY', symbol: '!', accent: '#F6A43A' },
  password: { label: 'PASSWORD & ACCESS', symbol: '⌑', accent: '#F6A43A' },
  account: { label: 'ACCOUNT UPDATE', symbol: '•', accent: '#F6A43A' },
};

/**
 * TradeMate transactional email shell based on the live mobile app reference:
 * clean white email canvas, readable dark typography, subtle grey dividers, restrained orange accents,
 * simple editorial spacing, and the original hosted puzzle-piece brand logo.
 */
export const renderTradeMateEmail = (subject: string, content: string) => {
  const safeSubject = escapeHtml(subject);
  const kind = getEmailKind(subject);
  const presentation = emailPresentation[kind];
  const preheader = escapeHtml(
    kind === 'verification'
      ? 'Your secure TradeMate verification code is inside.'
      : kind === 'security'
        ? 'A sign-in to your TradeMate account was recorded.'
        : kind === 'password'
          ? 'An important password or account-access update from TradeMate.'
          : kind === 'welcome'
            ? 'Welcome to TradeMate. Your account journey starts here.'
            : 'An important update about your TradeMate account.',
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${safeSubject}</title>
  <style>
    body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    table { border-collapse:collapse !important; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    @media only screen and (max-width:620px) {
      .email-outer { padding:18px 10px !important; }
      .email-card { padding:26px 20px !important; }
      .email-title { font-size:25px !important; line-height:32px !important; }
      .email-brand { padding-left:4px !important; padding-right:4px !important; }
      .email-footer { padding-left:4px !important; padding-right:4px !important; }
      .email-logo { width:38px !important; height:38px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;color:#20242a;font-family:Manrope,Arial,Helvetica,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#ffffff;">
    <tr><td class="email-outer" align="center" style="padding:28px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr><td class="email-brand" style="padding:0 10px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="middle"><img class="email-logo" src="https://trademate-web.onrender.com/tm/img/logo.png" width="46" height="46" alt="" style="display:block;width:46px;height:46px;object-fit:contain;"></td>
              <td valign="middle" style="padding-left:10px;font-family:Manrope,Arial,Helvetica,sans-serif;font-size:25px;line-height:30px;font-weight:800;letter-spacing:-1.1px;color:#20242a;">trademate</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#ffffff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td class="email-card" style="padding:34px 38px 31px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
                <tr>
                  <td width="34" height="34" align="center" valign="middle" style="width:34px;height:34px;border-radius:11px;background-color:#fff7ed;border:1px solid #f3d2a8;color:#c77716;font-size:18px;font-weight:700;">${presentation.symbol}</td>
                  <td valign="middle" style="padding-left:11px;font-family:'Courier New',monospace;font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.35px;color:#F6A43A;">${presentation.label}</td>
                </tr>
              </table>
              <h1 class="email-title" style="margin:0 0 19px;font-family:Manrope,Arial,Helvetica,sans-serif;font-size:29px;line-height:37px;letter-spacing:-.7px;font-weight:800;color:#20242a;">${safeSubject}</h1>
              <div class="email-copy" style="font-family:Manrope,Arial,Helvetica,sans-serif;font-size:15px;line-height:26px;color:#4b5563;">${content}</div>

              <div style="margin-top:24px;padding:18px 20px;background-color:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;">
                <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;font-weight:700;color:#20242a;">${kind === 'security' ? 'What you should know' : kind === 'verification' ? 'Why we ask you to verify' : kind === 'password' ? 'A quick security reminder' : kind === 'account' ? 'About this account update' : 'Getting started'}</p>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#4b5563;">${kind === 'security' ? 'We send this alert to help you keep track of access to your account. If you recognise this activity, no further action is needed. If you do not recognise it, secure your account straight away and contact TradeMate support.' : kind === 'verification' ? 'Verifying your email helps us confirm that the address belongs to you and ensures that important account and security notifications reach the right inbox.' : kind === 'password' ? 'Use a unique password that you do not use on other websites. TradeMate will never ask you to send your password or verification code by email.' : kind === 'account' ? 'This message is being sent so you have a clear record of the change and know what to do if you did not request it.' : 'You can return to TradeMate whenever you are ready. We will use this email address for important account notices and security updates.'}</p>
              </div>
              <div style="height:1px;background-color:#e5e7eb;margin:27px 0 17px;font-size:0;line-height:0;">&nbsp;</div>
              <p style="margin:0;font-family:Manrope,Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#6b7280;">For your security, never share your password or one-time verification code with anyone.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px 10px 3px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
            <tr>
              <td align="center" style="padding-bottom:5px;"><img src="https://trademate-web.onrender.com/tm/img/logo.png" width="34" height="34" alt="TradeMate" style="display:block;width:34px;height:34px;opacity:.16;"></td>
            </tr>
            <tr><td align="center" style="font-family:Manrope,Arial,Helvetica,sans-serif;font-size:17px;line-height:23px;font-weight:800;letter-spacing:1.1px;color:#e1e5ea;">TRADE SMARTER. TOGETHER.</td></tr>
            <tr><td align="center" style="padding-top:3px;font-family:Manrope,Arial,Helvetica,sans-serif;font-size:10px;line-height:16px;color:#c4cad2;">Discover TradeMate · trademate.cfd</td></tr>
          </table>
        </td></tr>
        <tr><td class="email-footer" style="padding:12px 10px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left" style="font-family:Manrope,Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;font-weight:700;color:#20242a;">trademate</td>
              <td align="right" style="font-family:'Courier New',monospace;font-size:9px;line-height:16px;letter-spacing:.7px;color:#6b7280;">TRADE SMARTER. TOGETHER.</td>
            </tr>
          </table>
          <p style="margin:12px 0 0;font-family:Manrope,Arial,Helvetica,sans-serif;font-size:11px;line-height:19px;color:#6b7280;">TradeMate · <a href="https://trademate.cfd" style="color:#c77716;text-decoration:none;">trademate.cfd</a><br>Automated account notification. This message was sent because you have a TradeMate account or requested an account-related action. Please do not reply to this email.<br>If you do not recognise this activity or believe this message is suspicious, visit <a href="https://trademate.cfd" style="color:#c77716;text-decoration:none;">our official website</a> and contact TradeMate through its official support channels. Never share your password or one-time verification code by email.<br>© ${new Date().getUTCFullYear()} TradeMate. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};
