// One-off patch: route registration and password change through the scoped
// SECURITY DEFINER operations instead of direct user_credentials writes.
const fs = require('node:fs');
const file = process.argv[2] || 'TradeMate-main/apps/api/src/module.ts';
let src = fs.readFileSync(file, 'utf8');

if (!src.includes("INSERT INTO user_credentials") && !src.includes('UPDATE user_credentials')) {
  console.log('Already patched; nothing to do.');
  process.exit(0);
}

function once(haystack, needle) {
  const first = haystack.indexOf(needle);
  if (first === -1 || haystack.indexOf(needle, first + 1) !== -1) {
    throw new Error('Marker not found exactly once: ' + needle.slice(0, 80));
  }
  return first;
}

// ---- registration ----
{
  const startMarker = "      await client.query('BEGIN');\n      const created = await client.query(\"INSERT INTO users (email, display_name, status)";
  const endMarker = "      await client.query('COMMIT');\n      const delivered = await sendTransactionalEmail(email, 'Verify your TradeMate email'";
  const start = once(src, startMarker);
  const end = once(src, endMarker);
  if (end <= start) throw new Error('Registration markers out of order.');
  const replacement =
    "      await client.query('BEGIN');\n" +
    "      const code = String(randomInt(0, 1000000)).padStart(6, '0');\n" +
    "      await client.query('SELECT trademate_private.register_password_account($1, $2, $3, $4)', [email, displayName, hash, tokenDigest(code)]);\n";
  src = src.slice(0, start) + replacement + src.slice(end);
}

// ---- change password ----
{
  const startMarker = "    const userId = session.rows[0].id as string;\n    const credentials = await databasePool.query(\n      'SELECT password_hash FROM trademate_private.resolve_presented_password_credentials($1)',";
  const start = once(src, startMarker);
  const bodyStartMarker = "    const nextHash = await passwordHash(newPassword);\n    const client = await databasePool.connect();";
  const bodyStart = once(src, bodyStartMarker);
  const endMarker = "      return { success: true, message: 'Password updated. Other active sessions have been signed out.' };\n    } catch (error) {\n      await client.query('ROLLBACK').catch(() => undefined);\n      throw error;\n    } finally {\n      client.release();\n    }\n  }\n";
  const end = once(src, endMarker);
  if (!(start < bodyStart && bodyStart < end)) throw new Error('Password-change markers out of order.');

  const credentialsBlock = src.slice(start, bodyStart)
    .replace("    const userId = session.rows[0].id as string;\n", '');
  const replacement =
    credentialsBlock +
    "    const nextHash = await passwordHash(newPassword);\n" +
    "    // The credential write, other-session revocation and audit event happen atomically in one scoped\n" +
    "    // database operation. It compares against the hash verified above, so a concurrent change fails closed.\n" +
    "    const changed = await databasePool.query(\n" +
    "      'SELECT changed_email FROM trademate_private.change_presented_password($1, $2, $3)',\n" +
    "      [tokenDigest(token), credentials.rows[0].password_hash, nextHash],\n" +
    "    );\n" +
    "    if (!changed.rowCount) throw new UnauthorizedException('Your session or password changed. Please sign in again.');\n" +
    "    if (changed.rows[0].changed_email) void sendTransactionalEmail(changed.rows[0].changed_email, 'Your TradeMate password was changed', '<p>Your TradeMate password was changed successfully.</p><p>If you did not make this change, contact TradeMate support immediately.</p>');\n" +
    "    return { success: true, message: 'Password updated. Other active sessions have been signed out.' };\n" +
    "  }\n";
  src = src.slice(0, start) + replacement + src.slice(end + endMarker.length);
}

if (/user_credentials/.test(src)) throw new Error('Direct user_credentials reference remains after patch.');
fs.writeFileSync(file, src);
console.log('module.ts patched.');
