import test from "node:test";
import assert from "node:assert/strict";
import { buildRoster, stats, portrait, clampPanel, orderedEntries, TF } from "../scripts/core.js";
import { quickActionData, useQuickAction } from "../scripts/actions.js";

globalThis.game = { system: { id: "pf2e" }, i18n: { localize: key => key, format: (key, data) => key + JSON.stringify(data) } };
globalThis.CONFIG = { Item: { typeLabels: {} }, DND5E: { featureTypes: {} } };
globalThis.ui = { notifications: { warn: () => {}, error: () => {} } };
const pc = { id: "pc", uuid: "Actor.pc", name: "Hero", img: "actor.webp", hasPlayerOwner: true, system: {} };
const npc = { id: "npc", uuid: "Actor.npc", name: "Enemy", system: {} };
const secret = { id: "secret", uuid: "Actor.secret", name: "Hidden" };
const actors = [pc, npc, secret];
const resolve = uuid => actors.find(a => a.uuid === uuid);
const roster = params => buildRoster({ actors, resolve, ...params });

test("Foundry v14 formats localization with localize(key, data)", () => {
  const old = game.i18n;
  game.i18n = { localize: (key, data) => `${key}: ${data.actor}` };
  try { assert.equal(TF('test', { actor: 'Hero' }), 'VPH.test: Hero'); }
  finally { game.i18n = old; }
});

test("automatic roster uses PCs, encounter and VND without listing every NPC", () => {
  assert.deepEqual(roster({}).players.map(e => e.actor.id), ["pc"]);
  assert.equal(roster({}).npcs.length, 0);
  const combat = { turns: [{ actor: pc, actorId: "pc" }, { actor: npc, actorId: "npc" }] };
  assert.equal(roster({ combat, vn: { leftCast: [{ id: "pc" }], rightCast: [{ id: "npc" }] } }).npcs.length, 1);
});
test("secret combatants and hidden token actors never leak through manual or VND roster", () => {
  const combat = { turns: [{ actor: secret, actorId: "secret", hidden: true }] };
  const data = { combat, roster: { npcs: [secret.uuid] }, vn: { rightCast: [{ id: "secret" }] } };
  assert.equal(roster(data).npcs.length, 0);
  assert.equal(roster({ ...data, isGM: true }).npcs.length, 1);
  const token = { ...npc, uuid: "Scene.s.Token.t.Actor.npc", isToken: true, token: { hidden: true } };
  assert.equal(buildRoster({ actors, resolve: () => token, source: "manual", roster: { npcs: [token.uuid] } }).npcs.length, 0);
});
test("manual side override binds combat token, preserves synthetic actor and prevents duplicate base actor", () => {
  const token = { ...pc, uuid: "Scene.s.Token.t.Actor.pc", isToken: true };
  const combat = { turns: [{ actor: token, actorId: "pc", name: "Hero token" }] };
  const data = roster({ combat, roster: { npcs: [pc.uuid] } });
  assert.equal(data.players.length, 0); assert.equal(data.npcs.length, 1);
  assert.equal(data.npcs[0].actor.uuid, token.uuid);
  assert.equal(roster({ combat, roster: { excluded: [token.uuid] } }).players.length, 0);
});
test("manual mode and exclusions keep roster deterministic", () => {
  assert.equal(roster({ source: "manual" }).players.length, 0);
  assert.equal(roster({ source: "manual", roster: { players: [npc.uuid] } }).players[0].actor.id, "npc");
  assert.equal(roster({ roster: { excluded: [pc.uuid] } }).players.length, 0);
  assert.equal(orderedEntries([{ actor: pc }, { actor: npc }], [npc.uuid])[0].actor.id, "npc");
});
test("stats and portraits resolve PF2e/5e fields and reactions", () => {
  const actor = { ...pc, system: { attributes: { hp: { value: 54, max: 71 }, ac: { value: 19 }, movement: { walk: 30 } } } };
  assert.equal(stats(actor).ac, 19); assert.equal(stats(actor).speed, 30);
  assert.ok(stats(actor).pct > 75);
  assert.equal(stats({ system: {} }).hasHp, false);
  assert.equal(portrait(actor, { leftCast: [{ id: "pc", activeReaction: "angry", reactions: { angry: "angry.webp" } }] }), "angry.webp");
});
test("dragging/resizing clamps panels within viewport", () => {
  const result = clampPanel({ x: 9999, y: -10, width: 9999 }, { width: 1280, height: 800 });
  assert.equal(result.width, 480); assert.equal(result.x, 792); assert.equal(result.y, 8);
  const narrow = clampPanel({ x: 600, y: 500, width: 400 }, { width: 320, height: 600 });
  assert.equal(narrow.width, 304); assert.equal(narrow.x, 8);
});
test("PF2e quick actions retain strikes, MAP, spells, impulses, feats and gear", () => {
  const data = quickActionData({ system: { actions: [{ type: "strike", label: "Sword", variants: [{ label: "Full" }, { label: "-5" }] }] },
    items: [{ id: "spell", type: "spell", name: "Heal", rank: 1 }, { id: "impulse", type: "feat", system: { traits: { value: ["impulse"] }, actionType: { value: "action" }, actions: { value: 2 } } },
      { id: "feat", type: "feat", system: {} }, { id: "gear", type: "equipment" }] });
  assert.equal(data.attacks.length, 2); assert.equal(data.attacks[0].variants.length, 2);
  assert.equal(data.spells.length, 1); assert.equal(data.feats.length, 1); assert.equal(data.items.length, 1);
});
test("5e activities and attacks remain in Actions while spells/features/gear keep categories", () => {
  game.system.id = "dnd5e";
  const data = quickActionData({ items: [{ id: "attack", type: "feat", hasAttack: true, system: {} },
    { id: "feature", type: "feat", system: {} }, { id: "spell", type: "spell", system: { level: 2 } }, { id: "gear", type: "loot" }] });
  assert.equal(data.attacks.length, 1); assert.equal(data.spells.length, 1);
  assert.equal(data.feats.length, 1); assert.equal(data.items.length, 1);
  game.system.id = "pf2e";
});
test("quick action dispatch uses correct PF2e variant and denies actors without ownership", async () => {
  const calls = [];
  const actor = { isOwner: true, system: { actions: [{ variants: [{ roll: () => calls.push(0) }, { roll: () => calls.push(1) }] }] } };
  await useQuickAction(actor, { kind: "strike", strikeIdx: 0 }, {}, 1);
  assert.deepEqual(calls, [1]);
  await useQuickAction({ ...actor, isOwner: false }, { kind: "strike", strikeIdx: 0 }, {}, 0);
  assert.deepEqual(calls, [1]);
});
test("PF2e spells cast through owning entry and 5e items use native use", async () => {
  const calls = [], spell = { id: "spell", rank: 2, system: { location: { value: "casting" } } };
  const documents = new Map([["spell", spell], ["casting", { cast: (item, options) => calls.push(options.rank) }]]);
  await useQuickAction({ isOwner: true, items: documents }, { kind: "spell", itemId: "spell" }, {});
  assert.deepEqual(calls, [2]);
  game.system.id = "dnd5e";
  documents.set("weapon", { use: config => calls.push(config.event.shiftKey) });
  await useQuickAction({ isOwner: true, items: documents }, { kind: "item", itemId: "weapon" }, { shiftKey: true });
  assert.deepEqual(calls, [2, true]); game.system.id = "pf2e";
});
