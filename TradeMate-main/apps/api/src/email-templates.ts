const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/**
 * Shared, email-client-safe TradeMate shell.
 * The message body is composed by trusted server-side flows; dynamic tokens are
 * generated server-side and URLs are built from the configured app origin.
 */
export const renderTradeMateEmail = (subject: string, content: string) => {
  const safeSubject = escapeHtml(subject);
  const preheader = escapeHtml(
    subject.toLowerCase().includes('verify') || subject.toLowerCase().includes('verification')
      ? 'Your secure TradeMate verification code is inside.'
      : subject.toLowerCase().includes('reset')
        ? 'Use the secure link inside to reset your TradeMate password.'
        : subject.toLowerCase().includes('sign-in')
          ? 'A sign-in to your TradeMate account was recorded.'
          : 'A secure account update from TradeMate.',
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
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    table { border-collapse:collapse !important; }
    @media only screen and (max-width:620px) {
      .email-outer { padding:18px 10px !important; }
      .email-card { padding:28px 22px !important; }
      .email-title { font-size:25px !important; line-height:32px !important; }
      .email-brand { padding-left:5px !important; }
      .email-footer { padding-left:5px !important; padding-right:5px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;color:#142033;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#eef2f7;">
    <tr><td class="email-outer" align="center" style="padding:38px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr><td class="email-brand" style="padding:0 10px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left" style="font-size:25px;line-height:30px;font-weight:800;letter-spacing:-1px;color:#101d35;">TradeMate<span style="color:#20d6ae;">.</span></td>
              <td align="right" style="font-size:10px;line-height:15px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#68768c;">MOVE WITH CONFIDENCE</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#101d35;border-radius:18px 18px 0 0;padding:4px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td class="email-card" style="background-color:#ffffff;border-left:1px solid #e1e7ef;border-right:1px solid #e1e7ef;padding:38px 40px 36px;">
          <div style="font-size:11px;line-height:17px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#079b82;padding-bottom:13px;">ACCOUNT UPDATE&nbsp;&nbsp;·&nbsp;&nbsp;TRADEMATE</div>
          <h1 class="email-title" style="margin:0 0 22px;font-size:29px;line-height:37px;letter-spacing:-.7px;font-weight:750;color:#101d35;">${safeSubject}</h1>
          <div style="font-size:16px;line-height:27px;color:#46546a;">${content}</div>
          <div style="height:1px;background-color:#e9edf3;margin:28px 0 18px;font-size:0;line-height:0;">&nbsp;</div>
          <p style="margin:0;font-size:12px;line-height:19px;color:#778398;">Security note: TradeMate will never ask you to share your password or one-time verification code.</p>
        </td></tr>
        <tr><td style="background-color:#101d35;border-radius:0 0 18px 18px;padding:22px 26px;">
          <p style="margin:0 0 7px;font-size:12px;line-height:18px;color:#d8e1ef;">A smarter way to move forward.</p>
          <p style="margin:0;font-size:11px;line-height:18px;color:#9eacc1;">Automated account message · Please do not reply<br><a href="https://trademate.cfd" style="color:#45e1c0;text-decoration:none;">trademate.cfd</a>&nbsp;&nbsp;·&nbsp;&nbsp;© ${new Date().getUTCFullYear()} TradeMate</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};
