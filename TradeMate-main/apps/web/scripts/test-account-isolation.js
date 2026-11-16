"use strict";

// Source regression checks for the connected-account isolation rules in
// public/tm/app.js.
//
// app.js is a MINIFIED build: local and many top-level identifiers are renamed
// by the minifier (host -> t, S -> y, r -> e ...). String literals, property
// names and a few reserved top-level names (CONNECTED, DEVICE_SAVED, SAVED,
// KEY, api, st, items, ads, resetSession ...) survive. These checks therefore
// match the SHAPE of the code with [\w$]+ for any renamed identifier, and they
// still guard the same security properties as before.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimePath = path.join(__dirname, "../public/tm/app.js");
const source = fs.readFileSync(runtimePath, "utf8");

// Index of the first match of a string or RegExp at/after `from` (-1 if none).
function find(needle, from) {
  const start = from || 0;
  if (typeof needle === "string") return source.indexOf(needle, start);
  const re = new RegExp(needle.source, needle.flags.replace("g", ""));
  const m = re.exec(source.slice(start));
  return m ? start + m.index : -1;
}

// Number of times a pattern occurs in a piece of text.
function count(text, re) {
  return (text.match(new RegExp(re.source, "g")) || []).length;
}

// Slice of the source between a start marker and the next end marker.
function section(startMark, endMark) {
  const start = find(startMark);
  assert.notEqual(start, -1, "missing source section: " + startMark);
  const end = find(endMark, start + 1);
  assert.notEqual(end, -1, "missing end marker: " + endMark);
  return source.slice(start, end);
}

(function connectedStorageIsAccountIsolated() {
  assert.match(source, /DEVICE_SAVED=\["mode","hide","lang"\]/,
    "connected mode must allowlist only non-sensitive device settings");

  const saveBlock = section("function save(){", "function keepTp(");
  assert.match(saveBlock, /var [\w$]+=CONNECTED\?\{\}:\{mine:items\.filter\(function\([\w$]+\)\{return [\w$]+\.own\}\),ads:ads\.filter\(function\([\w$]+\)\{return [\w$]+\.own\}\)\}/,
    "connected save must not serialize owned listings or P2P ads");
  assert.match(saveBlock, /\(CONNECTED\?DEVICE_SAVED:SAVED\)\.forEach/,
    "connected save must use the device-only allowlist");

  const loadBlock = section("function load(){", /\}load\(\),CONNECTED/);
  assert.match(loadBlock, /\(CONNECTED\?DEVICE_SAVED:SAVED\)\.forEach/,
    "connected load must use the device-only allowlist");
  const privateRestore = loadBlock.search(/\([\w$]+\.mine\|\|\[\]\)\.forEach\(addItem\)/);
  const connectedReturn = loadBlock.search(/CONNECTED\)\{var [\w$]+=\{\};return DEVICE_SAVED\.forEach/);
  assert.ok(connectedReturn !== -1 && privateRestore !== -1 && privateRestore > connectedReturn,
    "connected startup must return before restoring private listing and ad caches");
  assert.match(loadBlock, /localStorage\.setItem\(KEY,JSON\.stringify\([\w$]+\)\)/,
    "legacy shared-device cache must be rewritten without private account fields");

  assert.match(loadBlock, /CONNECTED&&localStorage\.removeItem\(KEY\)/,
    "malformed legacy cache must be removed in connected mode");
  assert.match(loadBlock, /if\(CONNECTED\)try\{localStorage\.removeItem\(KEY\)/,
    "a failed cache parse must remove the legacy cache in connected mode");
})();

(function sessionFailureKeepsPrivateShellClosed() {
  const startup = section(
    /CONNECTED\?\([\w$]+\.style\.visibility="hidden",api\("GET","\/auth\/me"\)/,
    /\.then\(function\(\)\{[\w$]+\.style\.visibility=""/
  );
  const failureStart = startup.indexOf(".catch(function(");
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
  assert.match(startup, /if\(![\w$]+\|\|![\w$]+\.user\|\|![\w$]+\.user\.id\)throw new Error/,
    "session verification must fail closed without a valid account identity");
  assert.match(startup, /[\w$]+\.style\.display="none";try\{window\.draw\(\),navH\(\)\}catch\([\w$]+\)\{\}releaseAuthGate\(\)/,
    "a successful login must release the authenticated shell gate");
  assert.match(source, /[\w$]+&&[\w$]+\.requiresTwoFactor&&"string"==typeof [\w$]+\.challengeToken&&[\w$]+\.challengeToken/,
    "password login must preserve the API's two-factor challenge response");
  assert.match(source, /api\("POST","\/auth\/2fa\/verify"/,
    "the authenticator code must be verified by the server before login");
  assert.match(source, /[\w$]+\.challengeToken=[\w$]+\.challengeToken,[\w$]+\.step="totp"/,
    "the challenge token must be held only in the active login flow");
  assert.match(source, /function [\w$]+\(\)\{[\w$]+\+\+,[\w$]+\.challengeToken="",[\w$]+&&\([\w$]+\.abort\(\),[\w$]+=null\)\}/,
    "leaving or restarting authentication must abort its outstanding request");
  assert.match(source, /api\("POST","\/auth\/2fa\/verify",\{challengeToken:[\w$]+,code:[\w$]+\},[\w$]+\?\{signal:[\w$]+\.signal\}:void 0\)/,
    "authenticator verification must be cancellable if the user backs out");
})();

(function authenticatedRequestsAreGenerationBound() {
  const apiBlock = section("function api(", "function fail(");
  assert.match(apiBlock, /var [\w$]+=[\w$]+&&[\w$]+\.detached\|\|!st\.me\|\|!st\.me\.id\?null:captureAccountRequest\(\)/,
    "authenticated requests must capture their account identity and generation");
  assert.match(apiBlock, /accountRequestControllers\.push\([\w$]+\)/,
    "authenticated requests must be cancellable on account changes");
  assert.ok(count(apiBlock, /if\([\w$]+&&!isCurrentAccountRequest\([\w$]+\)\)/) >= 3,
    "responses and network errors must all be rejected when the account generation changes");
  assert.match(apiBlock, /\.finally\(function\(\)\{if\([\w$]+\)\{var [\w$]+=accountRequestControllers\.indexOf\(/,
    "request cancellation handles must be cleaned up");
  assert.match(source, /function abortAccountRequests\(\)/,
    "account changes must abort outstanding authenticated requests");
  assert.match(source, /function fail\([\w$]+\)\{[\w$]+&&[\w$]+\.staleAccountRequest\|\|toast\(/,
    "stale request errors must not appear as errors for the new account");
})();

(function accountSwitchAndLogoutClearPrivateState() {
  assert.match(source, /st\.subs=\[\],st\.links=\{\},st\.joinedAff=!1,st\.pins=\[\],st\.fv=\{\},st\.feedPosts=\[\]/,
    "account changes must clear account-scoped settings, drafts and Feed cache");
  assert.match(source, /st\.twofaStatus=null,st\.twofaSetup=null/,
    "account changes must discard pending authenticator setup secrets");
  assert.match(source, /tlClose\("tlView"\)/,
    "account changes must close the previous account's timeline overlay");
  assert.ok(count(source, /keepTp\(function\(\)\{for\(var ([\w$]+)=items\.length-1;\1>=0;\1--\)items\[\1\]\.own&&items\.splice\(\1,1\)\}\),ads=ads\.filter\(function\(([\w$]+)\)\{return!\2\.own\}\)/) >= 2,
    "account switches and logout must both remove prior account-owned listings and ads");
  assert.match(source, /accountSessionGeneration\+\+,abortAccountRequests\(\)/,
    "logout must invalidate the old session generation and abort its requests");
})();

(function logoutFailsClosedWithoutAbortingRevocation() {
  const apiBlock = section("function api(", "function fail(");
  assert.match(apiBlock, /[\w$]+&&[\w$]+\.detached\|\|!st\.me\|\|!st\.me\.id\?null:captureAccountRequest\(\)/,
    "detached logout requests must not be cancelled with account-scoped requests");
  const logoutStart = find(/"logout"===[\w$]+&&CONNECTED\)\{/);
  assert.notEqual(logoutStart, -1, "connected logout must have a dedicated recovery flow");
  const logoutEnd = find("}_lo(", logoutStart);
  assert.notEqual(logoutEnd, -1, "logout recovery wrapper must remain bounded");
  const logout = source.slice(logoutStart, logoutEnd);
  assert.match(logout, /api\("POST","\/auth\/logout",void 0,\{detached:!0\}\)/,
    "logout must use a detached request that survives local session reset");
  const reset = logout.indexOf("resetSession()");
  const server = logout.search(/void [\w$]+\.then\(/);
  assert.ok(reset !== -1 && server !== -1 && reset < server,
    "private local state must be cleared before the server responds");
  assert.match(logout, /Signed out\. Your server session was revoked\./,
    "successful logout must report confirmed server-side revocation");
  assert.match(logout, /Server-side session revocation could not be confirmed/,
    "failed logout must distinguish local sign-out from unconfirmed server revocation");
})();

(function emailVerificationUsesServerSideOneTimeCodes() {
  assert.match(source, /api\("POST","\/auth\/email-verification\/confirm",\{email:[\w$]+,code:[\w$]+\}/,
    "six-digit email codes must be verified by the API");
  assert.match(source, /api\("POST","\/auth\/email-verification\/resend",\{email:[\w$]+\.id\.trim\(\)\.toLowerCase\(\)\}/,
    "resending must request a fresh server-issued code");
  assert.match(source, /requiresEmailVerification/,
    "registration must wait for email verification instead of entering a session");
  assert.match(source, /email-verification\/resend/,
    "unverified login must offer the resend flow");
  const verifyBlock = section(
    'if(!CONNECTED)return window.toast("Local mode: no server configured',
    /"\/auth\/email-verification\/confirm"[^]{0,400}/
  ) + 'api("POST","/auth/email-verification/confirm"';
  assert.match(verifyBlock, /api\("POST","\/auth\/email-verification\/confirm"/,
    "connected verification must call the server confirmation endpoint");
  assert.ok(verifyBlock.indexOf("if(!CONNECTED)") < verifyBlock.indexOf('api("POST","/auth/email-verification/confirm"'),
    "the local preview fallback must be isolated before the connected API call");
})();

(function legacyMarketplaceUsesB2BApiContracts() {
  assert.match(source, /ORD=\[[^\]]*"B2B"/,
    "the deployed runtime must include a dedicated B2B marketplace division");
  assert.match(source, /CONTRACT_CATS=\[[^\]]*"B2B"/,
    "B2B must remain a contract category");
  assert.ok(source.includes('SRV={Services:"service",B2B:"b2b"}'),
    "the live publishing flow must use the supported service and b2b API types");
  const wizardStart = find("function wzCfg(");
  assert.notEqual(wizardStart, -1, "missing source section: function wzCfg(");
  const wizard = source.slice(wizardStart, wizardStart + 4000);
  assert.match(wizard, /B2B:\[\{n:"Basics"/,
    "the live wizard must expose the B2B contract form");
  assert.match(wizard, /T\("qty","Quantity \/ scope"/,
    "the B2B wizard must collect quantity or non-numeric scope");
  const publish = section("function publishServer(", '"/submit"');
  assert.match(publish, /"B2B"===[\w$]+&&\/\^\\d\{1,12\}\$\/\.test\([\w$]+\)&&\([\w$]+=[\w$]+\)/,
    "only a whole-number B2B quantity may populate quantityAvailable");
  assert.match(publish, /null!==[\w$]+&&\([\w$]+=[\w$]+\.filter\(function\([\w$]+\)\{return"Quantity \/ scope"!==[\w$]+\[0\]\}\)\)/,
    "numeric inventory must be removed from description text when sent separately");
  assert.match(publish, /listingType:SRV\[[\w$]+\][^}]*quantityAvailable:[\w$]+/,
    "B2B publishing must send the API listing type and inventory field");
  const browse = section("function mapListing(", "function loadMarket(");
  assert.match(browse, /"b2b"===[\w$]+\.listing_type\?"B2B":"Services"/,
    "public B2B listings must be mapped to the B2B division");
  assert.match(browse, /"B2B opportunity"/,
    "public listing details must identify B2B opportunities correctly");
  assert.match(source, /SELL=\{Services:\["contract"\],B2B:\["contract"\]\}/,
    "B2B listings must use contract proposal actions");
})();

console.log("Account isolation source regression checks passed.");
