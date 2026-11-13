"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimePath = path.join(__dirname, "../public/tm/app.js");
const source = fs.readFileSync(runtimePath, "utf8");

function section(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  assert.notEqual(start, -1, "missing source section: " + startText);
  assert.notEqual(end, -1, "missing end marker: " + endText);
  return source.slice(start, end);
}

(function connectedStorageIsAccountIsolated() {
  assert.match(source, /var DEVICE_SAVED=\["mode","hide","lang"\]/,
    "connected mode must allowlist only non-sensitive device settings");

  const saveBlock = section("function save(){", "\nfunction keepTp");
  assert.match(saveBlock, /var o=CONNECTED\?\{\}:\{mine:items\.filter\(function\(i\)\{return i\.own\}\),ads:ads\.filter\(function\(a\)\{return a\.own\}\)\}/,
    "connected save must not serialize owned listings or P2P ads");
  assert.match(saveBlock, /\(CONNECTED\?DEVICE_SAVED:SAVED\)\.forEach/,
    "connected save must use the device-only allowlist");

  const loadBlock = section("function load(){", "\nload();if(!CONNECTED");
  assert.match(loadBlock, /var keys=CONNECTED\?DEVICE_SAVED:SAVED/,
    "connected load must use the device-only allowlist");
  const privateRestore = loadBlock.indexOf("(s.mine||[]).forEach(addItem)");
  const connectedReturn = loadBlock.indexOf("if(CONNECTED){var safe={}");
  assert.ok(connectedReturn !== -1 && privateRestore > connectedReturn,
    "connected startup must return before restoring private listing and ad caches");
  assert.match(loadBlock, /localStorage\.setItem\(KEY,JSON\.stringify\(safe\)\);return/,
    "legacy shared-device cache must be rewritten without private account fields");

  assert.match(loadBlock, /if\(CONNECTED\)localStorage\.removeItem\(KEY\)/,
    "malformed legacy cache must be removed in connected mode");
})();

(function sessionFailureKeepsPrivateShellClosed() {
  const startup = section(
    'if(CONNECTED){host.style.visibility="hidden";api("GET","/auth/me")',
    '.then(function(){host.style.visibility='
  );
  const failureStart = startup.indexOf(".catch(function(error){");
  assert.notEqual(failureStart, -1, "session verification must have a failure handler");
  const failure = startup.slice(failureStart);
  assert.match(failure, /resetSession\(\)/,
    "failed verification must clear private session state");
  assert.match(failure, /window\.openLanding\(\)/,
    "failed verification must return the user to sign-in");
  assert.doesNotMatch(failure, /window\.draw\(\)/,
    "failed verification must not render the authenticated shell");
  assert.doesNotMatch(failure, /releaseAuthGate\(\)/,
    "failed verification must keep the app shell hidden until login succeeds");
  assert.match(startup, /if\(!r\|\|!r\.user\|\|!r\.user\.id\)throw new Error/,
    "session verification must fail closed without a valid account identity");
  assert.match(source, /host\.style\.display="none";releaseAuthGate\(\)/,
    "a successful login must release the authenticated shell gate");
  assert.match(source, /r&&r\.requiresTwoFactor&&typeof r\.challengeToken==="string"/,
    "password login must preserve the API's two-factor challenge response");
  assert.match(source, /api\("POST","\/auth\/2fa\/verify"/,
    "the authenticator code must be verified by the server before login");
  assert.match(source, /S\.challengeToken=r\.challengeToken;S\.step="totp";rd\(\)/,
    "the challenge token must be held only in the active login flow");
  assert.match(source, /function invalidateAuthFlow\(\)\{authFlowGeneration\+\+;S\.challengeToken="";if\(authFlowController\)\{authFlowController\.abort\(\)/,
    "leaving or restarting authentication must abort its outstanding request");
  assert.match(source, /api\("POST","\/auth\/2fa\/verify".*authFlowController\?\{signal:authFlowController\.signal\}/,
    "authenticator verification must be cancellable if the user backs out");
})();

(function authenticatedRequestsAreGenerationBound() {
  const apiBlock = section("function api(", "\nfunction fail");
  assert.match(apiBlock, /var accountToken=!\(options&&options\.detached\)&&st\.me&&st\.me\.id\?captureAccountRequest\(\):null/,
    "authenticated requests must capture their account identity and generation");
  assert.match(apiBlock, /accountRequestControllers\.push\(accountController\)/,
    "authenticated requests must be cancellable on account changes");
  assert.match(apiBlock, /if\(accountToken&&!isCurrentAccountRequest\(accountToken\)\)/,
    "responses must be rejected when the account generation changes");
  assert.match(apiBlock, /\.finally\(function\(\)\{if\(accountController\)/,
    "request cancellation handles must be cleaned up");
  assert.match(source, /function abortAccountRequests\(\)/,
    "account changes must abort outstanding authenticated requests");
  assert.match(source, /function fail\(e\)\{if\(e&&e\.staleAccountRequest\)return;/,
    "stale request errors must not appear as errors for the new account");
})();

(function accountSwitchAndLogoutClearPrivateState() {
  assert.match(source, /st\.subs=\[\];st\.links=\{\};st\.joinedAff=false;st\.pins=\[\];st\.fv=\{\};st\.feedPosts=\[\]/,
    "account changes must clear account-scoped settings, drafts and Feed cache");
  assert.match(source, /st\.twofaStatus=null;st\.twofaSetup=null/,
    "account changes must discard pending authenticator setup secrets");
  assert.match(source, /tlClose\("tlView"\)/,
    "account changes must close the previous account's timeline overlay");
  assert.ok(source.includes("keepTp(function(){for(var i=items.length-1;i>=0;i--)if(items[i].own)items.splice(i,1)});ads=ads.filter(function(a){return !a.own})"),
    "account switches must remove prior account-owned listings and ads");
  assert.match(source, /accountSessionGeneration\+\+;abortAccountRequests\(\)/,
    "logout must invalidate the old session generation and abort its requests");
})();


(function logoutFailsClosedWithoutAbortingRevocation() {
  const apiBlock = section("function api(", "\nfunction fail");
  assert.match(apiBlock, /var accountToken=!\(options&&options\.detached\)&&st\.me&&st\.me\.id\?captureAccountRequest\(\):null/,
    "detached logout requests must not be cancelled with account-scoped requests");
  const logoutStart = source.indexOf('if(n==="logout"&&CONNECTED){');
  assert.notEqual(logoutStart, -1, "connected logout must have a dedicated recovery flow");
  const logoutEnd = source.indexOf("return}_lo(n,a,el)};", logoutStart);
  assert.notEqual(logoutEnd, -1, "logout recovery wrapper must remain bounded");
  const logout = source.slice(logoutStart, logoutEnd);
  assert.match(logout, /api\("POST","\/auth\/logout",undefined,\{detached:true\}\)/,
    "logout must use a detached request that survives local session reset");
  assert.ok(logout.indexOf("resetSession();") < logout.indexOf("logoutRequest.then"),
    "private local state must be cleared before the server responds");
  assert.match(logout, /Signed out\. Your server session was revoked\./,
    "successful logout must report confirmed server-side revocation");
  assert.match(logout, /Server-side session revocation could not be confirmed/,
    "failed logout must distinguish local sign-out from unconfirmed server revocation");
})();

(function emailVerificationUsesServerSideOneTimeCodes() {
  assert.match(source, /api\("POST","\/auth\/email-verification\/confirm",\{email:em,code:code\}/,
    "six-digit email codes must be verified by the API");
  assert.match(source, /api\("POST","\/auth\/email-verification\/resend",\{email:S\.id\.trim\(\)\.toLowerCase\(\)\}/,
    "resending must request a fresh server-issued code");
  assert.match(source, /requiresEmailVerification/,
    "registration must wait for email verification instead of entering a session");
  assert.match(source, /email-verification\/resend/,
    "unverified login must offer the resend flow");
  assert.doesNotMatch(section("function verify(code)", "function kindOk()"), /Local mode: no server configured, this device only\");enter\(\)\}\}/,
    "connected verification must not accept a local preview code");
})();

console.log("Account isolation source regression checks passed.");
