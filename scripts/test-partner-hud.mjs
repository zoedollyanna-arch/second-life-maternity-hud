import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { adaptLsl } from "./lsl-simulation.mjs";

const source = readFileSync(new URL("../lsl/nestoria_partner_hud.lsl", import.meta.url), "utf8");
const code = adaptLsl(source);

function fixture() {
  const c = {};
  for (const [i, name] of [...new Set(source.match(/\b[A-Z][A-Z_]+\b/g))].entries())
    c[name] = i + 100;
  Object.assign(c, {
    TRUE: 1,
    FALSE: 0,
    NULL_KEY: "null-key",
    JSON_INVALID: "invalid",
    JSON_OBJECT: "object",
  });
  const state = {
    requests: [],
    dialogs: [],
    textboxes: [],
    urls: [],
    messages: [],
    time: 0,
    timer: 0,
  };
  Object.assign(c, {
    recordedUrls: state.urls,
    llGetOwner: () => "owner",
    llDetectedKey: () => "owner",
    llGetKey: () => "hud-object",
    llGetRegionName: () => "region",
    llGetTime: () => state.time,
    llFrand: () => 1234,
    llListenRemove: () => {},
    llListen: () => 1,
    llOwnerSay: (message) => state.messages.push(message),
    llTextBox: (...args) => state.textboxes.push(args),
    llDialog: (...args) => state.dialogs.push(args),
    llSetTimerEvent: (seconds) => {
      state.timer = seconds;
    },
    llStringTrim: (value) => value.trim(),
    llList2Json: (_, list) =>
      JSON.stringify(
        Object.fromEntries(
          Array.from({ length: list.length / 2 }, (_, i) => [list[i * 2], list[i * 2 + 1]]),
        ),
      ),
    llJsonGetValue: (text, path) => {
      try {
        return path.reduce((value, key) => value?.[key], JSON.parse(text)) ?? c.JSON_INVALID;
      } catch {
        return c.JSON_INVALID;
      }
    },
    llJsonValueType: (text, path) => {
      try {
        const value = path.reduce((item, key) => item?.[key], JSON.parse(text));
        return value === undefined ? c.JSON_INVALID : typeof value;
      } catch {
        return c.JSON_INVALID;
      }
    },
    llHTTPRequest: (url, options, body) => {
      const id = `request-${state.requests.length + 1}`;
      state.requests.push({ id, url, options, body: body ? JSON.parse(body) : null });
      return id;
    },
  });
  const context = vm.createContext(c);
  vm.runInContext(code, context);
  // These tests cover the actual menu/authentication logic. HUD geometry and
  // browser rendering are verified separately by the media tests and in-world.
  vm.runInContext(
    `setMoap = function(url) { gMoapUrl = url; recordedUrls.push(url); };
    minimizeHud = function() { gMinimized = TRUE; };
    restoreHud = function() { gMinimized = FALSE; };`,
    context,
  );
  const run = (name, ...args) => {
    context.args = args;
    return vm.runInContext(`${name}(...args)`, context);
  };
  const value = (expression) => vm.runInContext(expression, context);
  const reply = (request, status, body) =>
    run("http_response", request.id, status, [], JSON.stringify(body));
  return { state, run, value, reply, c };
}

test("startup registers the actual wearer as a partner before browser pairing", () => {
  const f = fixture();
  f.run("state_entry");
  const req = f.state.requests[0];
  assert.ok(req.url.endsWith("/api/sl/register"));
  assert.equal(req.body.kind, "partner");
  assert.equal(req.body.object_key, "hud-object");
  assert.equal(req.body.code, undefined, "registration must not change the pairing");
  f.reply(req, 200, {
    token: "new-token",
    moap_url: "https://example.test/partner?token=new-token",
  });
  assert.equal(f.value("gToken"), "new-token");
  assert.equal(f.value("gNeedsRegister"), 0);
  assert.equal(f.state.urls.at(-1), "https://example.test/partner?token=new-token");
});

test("frame touch offers Sync; Sync requests a new session and keeps HUD open", () => {
  const f = fixture();
  f.run("touch_start", 1);
  assert.ok(f.state.dialogs[0][2].includes("Sync"));
  const channel = f.value("gMenuChannel");
  f.run("listen", channel, "owner", "owner", "Sync");
  assert.ok(f.state.requests[0].url.endsWith("/api/sl/register"));
  assert.equal(f.value("gMinimized"), 0);
  assert.equal(f.state.textboxes.length, 0);
});

test("Pair remains a separate code-entry operation", () => {
  const f = fixture();
  f.run("touch_start", 1);
  f.run("listen", f.value("gMenuChannel"), "owner", "owner", "Pair");
  assert.equal(f.state.textboxes.length, 1);
  f.run("listen", f.value("gMenuChannel"), "owner", "owner", "ABC123");
  assert.ok(f.state.requests[0].url.endsWith("/api/sl/partner-link"));
  assert.equal(f.state.requests[0].body.code, "ABC123");
});

test("expired polling renews the session without asking for another pairing code", () => {
  const f = fixture();
  f.run("state_entry");
  f.reply(f.state.requests[0], 200, { token: "old-token" });
  f.run("timer");
  const poll = f.state.requests.at(-1);
  assert.ok(poll.url.includes("/api/sl/poll?token=old-token"));
  f.reply(poll, 401, { error: "unauthorized" });
  const renewal = f.state.requests.at(-1);
  assert.ok(renewal.url.endsWith("/api/sl/register"));
  f.reply(renewal, 200, { token: "renewed-token" });
  assert.equal(f.value("gToken"), "renewed-token");
  assert.equal(f.state.textboxes.length, 0);
});

test("Sync during an in-flight poll remains queued until the poll completes", () => {
  const f = fixture();
  f.run("state_entry");
  f.reply(f.state.requests[0], 200, { token: "old-token" });
  f.run("timer");
  const poll = f.state.requests.at(-1);
  f.run("touch_start", 1);
  f.run("listen", f.value("gMenuChannel"), "owner", "owner", "Sync");
  assert.equal(f.state.requests.length, 2);
  f.reply(poll, 200, { commands: [] });
  f.run("timer");
  assert.ok(f.state.requests.at(-1).url.endsWith("/api/sl/register"));
});

test("reattachment abandons stale requests and reconnects to the partner page", () => {
  const f = fixture();
  f.run("state_entry");
  const stale = f.state.requests[0];
  f.run("attach", "owner");
  const fresh = f.state.requests.at(-1);
  f.reply(stale, 200, { token: "stale-token" });
  assert.equal(f.value("gToken"), "");
  f.reply(fresh, 200, { token: "fresh-token" });
  assert.equal(f.state.urls.at(-1).endsWith("/partner?token=fresh-token"), true);
});

test("menu replies from another avatar or channel cannot trigger Sync", () => {
  const f = fixture();
  f.run("touch_start", 1);
  f.run("listen", f.value("gMenuChannel"), "stranger", "stranger", "Sync");
  f.run("listen", 999, "owner", "owner", "Sync");
  assert.equal(f.state.requests.length, 0);
});
