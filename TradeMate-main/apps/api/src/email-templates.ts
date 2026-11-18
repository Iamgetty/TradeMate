const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/**
 * Email-safe expression of the TradeMate app design tokens:
 * near-black canvas, graphite panels, mint primary accent, cyan/violet
 * supporting accents, DM Mono metadata and geometric display typography.
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
    table { border-collapse:collapse !important; }
    @media only screen and (max-width:620px) {
      .email-outer { padding:18px 10px !important; }
      .email-card { padding:27px 21px !important; }
      .email-title { font-size:25px !important; line-height:33px !important; }
      .email-brand { padding-left:5px !important; }
      .email-footer { padding-left:5px !important; padding-right:5px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#070a0e;color:#f2f6fa;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#070a0e;">
    <tr><td class="email-outer" align="center" style="padding:38px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr><td class="email-brand" style="padding:0 10px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td width="34" height="34" align="center" valign="middle" style="width:34px;height:34px;border-radius:11px;background-color:#9effc7;background-image:linear-gradient(145deg,#b4ffd7,#63dcb5);color:#07120e;font-size:19px;font-weight:800;">T</td>
                  <td style="padding-left:10px;font-size:19px;line-height:24px;font-weight:800;letter-spacing:-.8px;color:#f2f6fa;">TradeMate</td>
                </tr></table>
              </td>
              <td align="right" style="font-family:'Courier New',monospace;font-size:9px;line-height:14px;font-weight:500;letter-spacing:1.4px;color:#8996a6;">MOVE WITH CONFIDENCE</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#0d1218;border:1px solid #1c2832;border-radius:16px;overflow:hidden;">
          <div style="height:3px;background-color:#9effc7;background-image:linear-gradient(90deg,#9effc7 0%,#77d9ff 55%,#9d8bff 100%);font-size:0;line-height:0;">&nbsp;</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td class="email-card" style="padding:36px 38px 32px;">
              <div style="font-family:'Courier New',monospace;font-size:10px;line-height:16px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:#9effc7;padding-bottom:14px;">TRADEMATE&nbsp;&nbsp; / &nbsp;&nbsp;ACCOUNT UPDATE</div>
              <h1 class="email-title" style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:29px;line-height:37px;letter-spacing:-.8px;font-weight:700;color:#f2f6fa;">${safeSubject}</h1>
              <div style="font-size:16px;line-height:27px;color:#c4ced8;">${content}</div>
              <div style="height:1px;background-color:#1c2832;margin:27px 0 17px;font-size:0;line-height:0;">&nbsp;</div>
              <p style="margin:0;font-size:12px;line-height:19px;color:#8996a6;">Security first: TradeMate will never ask you to share your password or one-time verification code.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td class="email-footer" style="padding:21px 10px 0;">
          <p style="margin:0 0 7px;font-size:12px;line-height:18px;color:#c4ced8;">A smarter way to move forward.</p>
          <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;line-height:18px;color:#71808d;">AUTOMATED ACCOUNT MESSAGE · PLEASE DO NOT REPLY<br><a href="https://trademate.cfd" style="color:#9effc7;text-decoration:none;">trademate.cfd</a>&nbsp;&nbsp;·&nbsp;&nbsp;© ${new Date().getUTCFullYear()} TradeMate</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};
