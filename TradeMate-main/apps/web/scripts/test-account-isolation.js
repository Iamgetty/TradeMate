"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimePath = path.join(__dirname, "../public/tm/app.js");
const source = fs.readFileSync(runtimePath, "utf8");

function makeStorage(initial) {
  let value = initial == null ? null : JSON.stringify(initial);
  return {
    getItem(key) { return key === "tm.live.v2" ? value : null; },
    setItem(key, next) { if (key === "tm.live.v2") value = String(next); },
    removeItem(key) { if (key === "tm.live.v2") value = null; },
    read() { return value == null ? null : JSON.parse(value); }
  };
}

function loadStoreFunctions(connected, state, items, ads, storage) {
  const start = source.indexOf("var SAVED=[");
  const end = source.indexOf("\nload();if(!CONNECTED", start);
  assert.notEqual(start, -1, "storage implementation must exist");
  assert.notEqual(end, -1, "storage implementation boundary must exist");
  const block = source.slice(start, end);
  const factory = new Function(
    "CONNECTED", "KEY", "st", "items", "ads", "MC", "ORD", "localStorage",
    block + "; return { save: save, load: load };"
  );
  return factory(connected, "tm.live.v2", state, items, ads, {}, [], storage);
}

(function connectedModeNeverRestoresAccountCache() {
  const legacyCache = {
    me: { id: "account-A", email: "a@example.test" },
    prefs: { cur: "USD" },
    favs: ["private-favourite"],
    tickets: [{ id: "private-ticket" }],
    fb: [{ m: "private-feedback" }],
    subs: [{ id: "private-subscription" }],
    links: [{ id: "private-link" }],
    joinedAff: [{ id: "private-affiliate" }],
    mode: "Buyer",
    hide: ["some-ui-section"],
    lang: "en",
    notifs: [{ h: "private-notification" }],
    pins: ["private-pin"],
    mine: [{ own: true, n: "Account A listing", m: "Services" }],
    ads: [{ own: true, id: "account-A-ad" }]
  };
  const storage = makeStorage(legacyCache);
  const state = {};
  const items = [];
  const ads = [];
  const store = loadStoreFunctions(true, state, items, ads, storage);

  store.load();

  assert.equal(state.me, undefined, "cached identity must not be restored before /auth/me");
  assert.equal(state.prefs, undefined, "cached account preferences must not be restored");
  assert.equal(state.favs, undefined, "cached favourites must not be restored");
  assert.equal(state.tickets, undefined, "cached support tickets must not be restored");
  assert.equal(state.notifs, undefined, "cached notifications must not be restored");
  assert.deepEqual(items, [], "cached owned listings must not enter the connected app");
  assert.deepEqual(ads, [], "cached owned P2P ads must not enter the connected app");
  assert.deepEqual(storage.read(), {
    mode: "Buyer",
    hide: ["some-ui-section"],
    lang: "en"
  }, "legacy private cache fields must be purged from shared storage");
})();

(function connectedModeNeverPersistsAccountCache() {
  const state = {
    me: { id: "account-B" },
    prefs: { cur: "NGN" },
    favs: ["account-B-favourite"],
    tickets: [{ id: "account-B-ticket" }],
    mode: "Seller",
    hide: [],
    lang: "en"
  };
  const items = [{ own: true, n: "Account B listing" }];
  const ads = [{ own: true, id: "account-B-ad" }];
  const storage = makeStorage(null);
  const store = loadStoreFunctions(true, state, items, ads, storage);

  store.save();

  assert.deepEqual(storage.read(), {
    mode: "Seller",
    hide: [],
    lang: "en"
  }, "connected save must contain only device-level UI settings");
})();

(function localModeRetainsDeviceOnlyPersistence() {
  const storage = makeStorage({
    me: { nick: "Local member" },
    prefs: { cur: "NGN" },
    mode: "Buyer",
    deals: [{ id: "local-deal" }],
    mine: [{ own: true, n: "Local listing", m: "Services" }],
    ads: [{ own: true, id: "local-ad" }]
  });
  const state = {};
  const items = [];
  const ads = [];
  const store = loadStoreFunctions(false, state, items, ads, storage);

  store.load();

  assert.equal(state.me.nick, "Local member");
  assert.equal(state.prefs.cur, "NGN");
  assert.equal(state.deals[0].id, "local-deal");
  assert.equal(items[0].n, "Local listing");
  assert.equal(ads[0].id, "local-ad");
})();

(function failedSessionVerificationDoesNotRevealAuthenticatedShell() {
  const start = source.indexOf('if(CONNECTED){host.style.visibility="hidden";api("GET","/auth/me")');
  assert.notEqual(start, -1, "session verification startup must exist");
  const end = source.indexOf(".then(function(){host.style.visibility=", start);
  assert.notEqual(end, -1, "session verification completion handler must exist");
  const startup = source.slice(start, end);
  const failureStart = startup.indexOf(".catch(function(error){");
  assert.notEqual(failureStart, -1, "session verification must have a failure handler");
  const failure = startup.slice(failureStart);
  assert.match(failure, /resetSession\(\)/, "failed verification must clear private session state");
  assert.match(failure, /window\.openLanding\(\)/, "failed verification must show sign-in");
  assert.doesNotMatch(failure, /window\.draw\(\)/, "failed verification must not render the authenticated shell");
})();

(async function staleAuthenticatedResponsesAreDiscarded() {
  const apiStart = source.indexOf("function api(");
  const apiEnd = source.indexOf("\nfunction fail", apiStart);
  assert.notEqual(apiStart, -1, "API helper must exist");
  assert.notEqual(apiEnd, -1, "API helper boundary must exist");
  const apiBlock = source.slice(apiStart, apiEnd);
  let current = true;
  let resolveFetch;
  const fakeFetch = () => new Promise(resolve => { resolveFetch = resolve; });
  const apiFactory = new Function(
    "CONNECTED", "TMCFG", "st", "captureAccountRequest", "isCurrentAccountRequest", "fetch", "accountRequestControllers",
    apiBlock + "; return api;"
  );
  const api = apiFactory(
    true,
    { api: "https://api.example.test" },
    { me: { id: "account-A" } },
    () => ({ generation: 4, userId: "account-A" }),
    token => current && token.generation === 4 && token.userId === "account-A",
    fakeFetch
  );

  const pending = api("POST", "/private/action", { value: true });
  current = false;
  resolveFetch({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ secret: "account-A response" }))
  });
  await assert.rejects(
    pending,
    error => error && error.staleAccountRequest === true,
    "a response from the previous account must never reach mutation callbacks"
  );
  assert.ok(source.includes("function fail(e){if(e&&e.staleAccountRequest)return;"),
    "stale request errors must not be surfaced as errors for the new account");
  assert.ok(source.includes("st.subs=[];st.links={};st.joinedAff=false;st.fv={};st.feedPosts=[]"),
    "account switches must clear remaining account-scoped state and feed cache");
  console.log("Account isolation regression tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
