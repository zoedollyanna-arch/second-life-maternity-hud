// Run the actual media helper's recovery functions against a simulated SL prim.
// This narrow LSL-to-JS adapter covers the media functions used below; it is
// not an LSL compiler or a substitute for testing rendering in a real viewer.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { adaptLsl } from "./lsl-simulation.mjs";

const source = readFileSync(new URL("../lsl/nestoria_hud_media.lsl", import.meta.url), "utf8");
const code = adaptLsl(source);

function fixture({ absent = false, sides = 6, prims = 2, root = 1 } = {}) {
  const c = { TRUE: 1, FALSE: 0, LINK_THIS: -4, NULL_KEY: "00000000-0000-0000-0000-000000000000" };
  for (const [i, name] of [...new Set(source.match(/\b(?:PRIM_\w+|STATUS_\w+|CHANGED_\w+|LM_\w+|TEXTURE_BLANK|ALL_SIDES)\b/g))].entries()) {
    c[name] = i + 100;
  }
  c.STATUS_OK = 0;
  for (const [i, name] of ["CHANGED_OWNER", "CHANGED_REGION", "CHANGED_TELEPORT", "CHANGED_REGION_START", "CHANGED_LINK", "CHANGED_TEXTURE"].entries()) {
    c[name] = 1 << i;
  }
  c.ZERO_VECTOR = { x: 0, y: 0, z: 0 };
  const home = "https://example.test/?token=session";
  const state = {
    media: absent ? null : new Map([
      [c.PRIM_MEDIA_HOME_URL, home], [c.PRIM_MEDIA_CURRENT_URL, `${home}#saved-tab`],
      [c.PRIM_MEDIA_AUTO_SCALE, 1], [c.PRIM_MEDIA_AUTO_PLAY, 1],
      [c.PRIM_MEDIA_WIDTH_PIXELS, 800], [c.PRIM_MEDIA_HEIGHT_PIXELS, 450],
    ]),
    texture: ["original-inventory-texture", { x: 1, y: 1, z: 0 }, c.ZERO_VECTOR, 0],
    color: { x: 1, y: 1, z: 1 }, alpha: 1, fullbright: 1, glow: 0,
    mediaWrites: [], textureWrites: [], messages: [], ownerMessages: [],
    timer: 0, status: 0, ignoreWrites: false, ignoreNavigation: false, resetCount: 0,
  };
  function target(link, face) {
    assert.equal(link, root === 0 ? -4 : 2, "recovery must target the configured screen");
    assert.equal(face, 4, "recovery must not fall back onto face zero");
  }
  Object.assign(c, {
    llGetLinkNumber: () => root,
    llGetNumberOfPrims: () => prims,
    llGetLinkNumberOfSides: (link) => link === 2 || link === -4 ? sides : 6,
    llGetListLength: (list) => list.length,
    llList2Integer: (list, i) => Number(list[i] ?? 0),
    llList2Float: (list, i) => Number(list[i] ?? 0),
    llList2String: (list, i) => String(list[i] ?? ""),
    llList2Key: (list, i) => list[i] ?? c.NULL_KEY,
    llList2Vector: (list, i) => list[i] ?? c.ZERO_VECTOR,
    llVecDist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z),
    llFabs: Math.abs,
    llSubStringIndex: (text, part) => text.indexOf(part),
    llGetUnixTime: () => 123456,
    llGetOwner: () => "owner",
    llSetTimerEvent: (interval) => { state.timer = interval; },
    llMessageLinked: (...args) => { state.messages.push(args); },
    llOwnerSay: (message) => { state.ownerMessages.push(message); },
    llResetScript: () => { state.resetCount++; },
    llGetLinkMedia: (link, face, keys) => {
      target(link, face);
      return state.media ? keys.map((name) => state.media.get(name) ?? 0) : [];
    },
    llSetLinkMedia: (link, face, params) => {
      target(link, face);
      state.mediaWrites.push([...params]);
      if (!state.status && !state.ignoreWrites) {
        state.media ??= new Map();
        for (let i = 0; i < params.length; i += 2) {
          if (state.ignoreNavigation && params[i] === c.PRIM_MEDIA_CURRENT_URL) continue;
          state.media.set(params[i], params[i + 1]);
        }
      }
      return state.status;
    },
    llClearLinkMedia: () => assert.fail("repair must not destroy the browser"),
    llGetLinkPrimitiveParams: (link, params) => {
      target(link, params[1]);
      const result = [];
      for (let i = 0; i < params.length; i += 2) {
        if (params[i] === c.PRIM_TEXTURE) result.push(...state.texture);
        else if (params[i] === c.PRIM_COLOR) result.push(state.color, state.alpha);
        else if (params[i] === c.PRIM_FULLBRIGHT) result.push(state.fullbright);
        else if (params[i] === c.PRIM_GLOW) result.push(state.glow);
        else assert.fail("unexpected primitive read");
      }
      return result;
    },
    llSetLinkPrimitiveParamsFast: (link, params) => {
      target(link, params[1]);
      state.textureWrites.push([...params]);
      const i = params.indexOf(c.PRIM_TEXTURE);
      if (i >= 0) state.texture = params.slice(i + 2, i + 6);
      const color = params.indexOf(c.PRIM_COLOR);
      if (color >= 0) {
        state.color = params[color + 2];
        state.alpha = params[color + 3];
      }
      const fullbright = params.indexOf(c.PRIM_FULLBRIGHT);
      if (fullbright >= 0) state.fullbright = params[fullbright + 2];
      const glow = params.indexOf(c.PRIM_GLOW);
      if (glow >= 0) state.glow = params[glow + 2];
    },
  });
  const context = vm.createContext(c);
  vm.runInContext(code, context, { filename: "nestoria_hud_media.lsl (media simulation)" });
  const run = (name, ...args) => {
    context.args = args;
    return vm.runInContext(`${name}(...args)`, context);
  };
  const value = (expression) => vm.runInContext(expression, context);
  return { c, home, state, run, value };
}

test("reattach repairs unchecked Auto Scale and old Align values without reloading", () => {
  const f = fixture();
  f.state.media.set(f.c.PRIM_MEDIA_AUTO_SCALE, 0);
  f.state.texture[1] = { x: 800 / 1024, y: 450 / 512, z: 0 };
  f.state.texture[2] = { x: -0.109375, y: -0.060546875, z: 0 };
  f.run("state_entry");
  f.run("on_rez", 0);
  f.run("attach", "owner");
  f.run("timer");
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_AUTO_SCALE), 1);
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_CURRENT_URL), `${f.home}#saved-tab`);
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_WIDTH_PIXELS), 800);
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_HEIGHT_PIXELS), 450);
  assert.equal(f.state.texture[0], "original-inventory-texture");
  assert.equal(f.state.texture[1].x, 1);
  assert.equal(f.state.texture[1].y, 1);
  assert.equal(f.state.texture[2].x, 0);
  assert.equal(f.value("gMediaReady"), true);
  assert.equal(f.state.resetCount, 0);
  assert.equal(f.state.mediaWrites[0].includes(f.c.PRIM_MEDIA_CURRENT_URL), false);
});

test("delayed saved inventory settings and later manual unchecks are repaired", () => {
  const f = fixture();
  f.run("state_entry");
  f.run("attach", "owner");
  f.run("timer");
  f.state.media.set(f.c.PRIM_MEDIA_AUTO_SCALE, 0);
  f.run("timer");
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_AUTO_SCALE), 1);
  f.run("timer");
  assert.equal(f.state.timer, 15);
  f.state.media.set(f.c.PRIM_MEDIA_AUTO_SCALE, 0);
  f.state.media.set(f.c.PRIM_MEDIA_WIDTH_PIXELS, 1024);
  f.run("timer");
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_AUTO_SCALE), 1);
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_WIDTH_PIXELS), 800);
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_CURRENT_URL), `${f.home}#saved-tab`);
});

test("healthy checks and repeated same-URL messages do not write or navigate", () => {
  const f = fixture();
  f.run("state_entry");
  f.run("link_message", 1, f.value("LM_MEDIA_URL"), f.home, f.c.NULL_KEY);
  for (let i = 0; i < 10; i++) f.run("timer");
  assert.equal(f.state.mediaWrites.length, 0);
  assert.equal(f.state.textureWrites.length, 0);
});

test("a new authenticated URL navigates once and missing media is recreated", () => {
  const f = fixture({ absent: true });
  f.run("state_entry");
  f.run("timer");
  assert.equal(f.state.timer, 2);
  f.run("link_message", 1, f.value("LM_MEDIA_URL"), f.home, f.c.NULL_KEY);
  for (let i = 0; i < 6; i++) f.run("timer");
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_CURRENT_URL), f.home);
  assert.equal(f.state.mediaWrites.length, 1);
  f.state.media = null;
  f.run("timer");
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_AUTO_SCALE), 1);
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_CURRENT_URL), f.home);
});

test("write failures and unconfirmed readback remain eligible for retry", () => {
  for (const mode of ["status", "ignoreWrites"]) {
    const f = fixture();
    f.state.media.set(f.c.PRIM_MEDIA_AUTO_SCALE, 0);
    f.run("state_entry");
    f.state[mode] = mode === "status" ? f.c.STATUS_INTERNAL_ERROR : true;
    f.run("timer");
    assert.equal(Boolean(f.value("gMediaReady")), false);
    f.run("timer");
    assert.equal(f.state.ownerMessages.length, 1, "failure warnings must not spam");
    f.state[mode] = mode === "status" ? 0 : false;
    f.run("timer");
    assert.equal(Boolean(f.value("gMediaReady")), true);
    assert.equal(f.state.media.get(f.c.PRIM_MEDIA_AUTO_SCALE), 1);
  }
});

test("invalid screen link/face produces one diagnostic and no fallback writes", () => {
  for (const options of [{ prims: 1 }, { sides: 1 }]) {
    const f = fixture(options);
    f.run("link_message", 1, f.value("LM_MEDIA_URL"), f.home, f.c.NULL_KEY);
    for (let i = 0; i < 5; i++) f.run("timer");
    assert.equal(f.state.mediaWrites.length, 0);
    assert.equal(f.state.ownerMessages.length, 1);
    assert.equal(Boolean(f.value("gMediaReady")), false);
  }
});

test("explicit refresh changes the navigation URL once; retries keep it stable", () => {
  const f = fixture();
  f.run("state_entry");
  f.run("link_message", 1, f.value("LM_COMMAND"), "{}", "refresh_moap");
  for (let i = 0; i < 6; i++) f.run("timer");
  const refreshed = f.state.media.get(f.c.PRIM_MEDIA_CURRENT_URL);
  assert.match(refreshed, /#n123456-1$/);
  assert.equal(f.state.mediaWrites.length, 1);
  f.state.media.set(f.c.PRIM_MEDIA_AUTO_SCALE, 0);
  f.run("timer");
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_CURRENT_URL), refreshed);
});

test("detach stops checks and ignores empty or other-prim URL messages", () => {
  const f = fixture();
  f.run("state_entry");
  f.run("attach", f.c.NULL_KEY);
  assert.equal(f.state.timer, 0);
  f.run("link_message", 2, f.value("LM_MEDIA_URL"), "wrong-screen", f.c.NULL_KEY);
  f.run("link_message", 1, f.value("LM_MEDIA_URL"), "", f.c.NULL_KEY);
  assert.equal(f.value("gMoapUrl"), f.home);
});

test("an unlinked single-prim HUD is supported", () => {
  const f = fixture({ root: 0, prims: 1 });
  f.state.media.set(f.c.PRIM_MEDIA_AUTO_SCALE, 0);
  f.run("state_entry");
  f.run("timer");
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_AUTO_SCALE), 1);
  assert.equal(Boolean(f.value("gMediaReady")), true);
});

test("readback must confirm requested navigation before declaring success", () => {
  const f = fixture();
  f.run("state_entry");
  f.state.ignoreNavigation = true;
  f.run("link_message", 1, f.value("LM_MEDIA_URL"), `${f.home}-new`, f.c.NULL_KEY);
  f.run("timer");
  assert.equal(Boolean(f.value("gMediaReady")), false);
  f.state.ignoreNavigation = false;
  f.run("timer");
  assert.equal(f.state.media.get(f.c.PRIM_MEDIA_CURRENT_URL), `${f.home}-new`);
  assert.equal(Boolean(f.value("gMediaReady")), true);
});

test("face appearance repair preserves the hidden alpha of a minimized HUD", () => {
  const f = fixture();
  f.run("state_entry");
  vm.runInContext("gMinimized = TRUE", f.c);
  f.state.color = { x: 0, y: 0, z: 0 };
  f.state.fullbright = 0;
  f.run("timer");
  assert.equal(f.state.color.x, 1);
  assert.equal(f.state.fullbright, 1);
  assert.equal(f.state.alpha, 0);
  assert.equal(f.state.mediaWrites.length, 0);
  f.run("timer");
  assert.equal(f.state.textureWrites.length, 1);
});
