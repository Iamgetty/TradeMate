const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const renderTradeMateEmail = (subject: string, content: string) => {
  const safeSubject = escapeHtml(subject);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f6f8;color:#14212b;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safeSubject} — a secure update from TradeMate.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f6f8;border-collapse:collapse;">
    <tr><td align="center" style="padding:36px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;">
        <tr><td style="padding:0 8px 22px;">
          <div style="font-size:23px;line-height:28px;font-weight:800;letter-spacing:-.7px;color:#14212b;">TradeMate<span style="color:#0b9b78;">.</span></div>
          <div style="padding-top:5px;font-size:11px;line-height:16px;letter-spacing:1.7px;text-transform:uppercase;color:#72808a;">A smarter way to move forward</div>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e5ebef;border-radius:18px;padding:36px 34px 32px;">
          <div style="font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:#0b9b78;padding-bottom:12px;">TradeMate notification</div>
          <h1 style="margin:0 0 22px;font-size:26px;line-height:34px;letter-spacing:-.5px;font-weight:700;color:#14212b;">${safeSubject}</h1>
          <div style="font-size:16px;line-height:27px;color:#42515c;">${content}</div>
        </td></tr>
        <tr><td style="padding:22px 8px 0;font-size:12px;line-height:19px;color:#71808b;">
          <p style="margin:0 0 8px;">This is an automated account message from TradeMate. Please do not reply to this email.</p>
          <p style="margin:0 0 8px;">If you did not request this activity, open TradeMate directly and review your account security. Never share your password or verification codes with anyone.</p>
          <p style="margin:0;">© ${new Date().getUTCFullYear()} TradeMate · <a href="https://trademate.cfd" style="color:#0b8067;text-decoration:underline;">trademate.cfd</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};
