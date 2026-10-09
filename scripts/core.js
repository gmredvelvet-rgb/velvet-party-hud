export const ID = "velvet-party-hud";
export const FALLBACK = "icons/svg/mystery-man.svg";
export const T = key => game.i18n.localize(`VPH.${key}`);
export const TF = (key, data) => (game.release?.generation ?? 14) >= 14
  ? game.i18n.localize(`VPH.${key}`, data)
  : game.i18n.format(`VPH.${key}`, data);
export const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);
export function resolveActor(uuid) {
  try { return foundry.utils.fromUuidSync(uuid); }
  catch { return null; }
}
export function portrait(actor, data = {}) {
  const saved = [...(data.leftCast ?? []), ...(data.rightCast ?? [])].find(p => p.id === actor.id)
    ?? data.portraits?.[actor.id];
  return saved?.reactions?.[saved.activeReaction] || saved?.reactions?.default || saved?.img
    || actor.img || actor.prototypeToken?.texture?.src || FALLBACK;
}
export function stats(actor) {
  const attrs = actor.system?.attributes ?? {};
  const hp = attrs.hp ?? actor.system?.hp;
  const value = hp?.value ?? hp?.current;
  const max = hp?.max;
  const hasHp = Number.isFinite(value) && Number.isFinite(max) && max > 0;
  return { hasHp, value, max, pct: hasHp ? Math.max(0, Math.min(100, value / max * 100)) : 0,
    temp: hp?.temp ?? 0, ac: attrs.ac?.value ?? actor.system?.ac?.value,
    speed: attrs.movement?.walk ?? attrs.speed?.total ?? attrs.speed?.value };
}
export function clampPanel(layout, viewport, height = 80, minimized = false) {
  const width = Math.max(160, Math.min(Number(layout.width) || 288, 480, Math.max(160, viewport.width - 16)));
  const actualWidth = minimized ? 148 : width;
  return { ...layout, width,
    x: Math.max(8, Math.min(Number(layout.x) || 8, viewport.width - actualWidth - 8)),
    y: Math.max(8, Math.min(Number(layout.y) || 8, viewport.height - Math.min(height, viewport.height - 16) - 8)) };
}
export function orderedEntries(entries, order = []) {
  const indexes = new Map(order.map((uuid, i) => [uuid, i]));
  return [...entries].sort((a, b) => (indexes.get(a.actor.uuid) ?? Infinity) - (indexes.get(b.actor.uuid) ?? Infinity));
}

// Read-only roster composition: manual overrides > encounter > VND > owned PCs.
// NPCs are never populated from the entire actor directory.
export function buildRoster({ actors, combat, vn = {}, roster = {}, source = "auto", isGM = false, resolve }) {
  const out = new Map();
  const turns = combat?.turns ?? [];
  const publicTurns = turns.filter(c => isGM || !c.hidden);
  const excluded = new Set(roster.excluded ?? []);
  const hidden = new Set(!isGM ? turns.filter(c => c.hidden).map(c => c.actor?.uuid) : []);
  const hiddenIds = new Set(!isGM ? turns.filter(c => c.hidden && !publicTurns.some(v => v.actorId === c.actorId)).map(c => c.actorId) : []);
  const add = (actor, side, name, combatant) => {
    if (!actor || excluded.has(actor.uuid) || excluded.has(`Actor.${actor.id}`)
      || hidden.has(actor.uuid) || hiddenIds.has(actor.id) || (!isGM && actor.isToken && actor.token?.hidden)) return;
    if (out.has(actor.uuid)) return;
    out.set(actor.uuid, { actor, side, name: name || actor.name, combatant });
  };
  for (const side of ["players", "npcs"]) for (const uuid of roster[side] ?? []) {
    const actor = resolve(uuid);
    const matches = source === "auto" && actor && !actor.isToken ? publicTurns.filter(c => c.actorId === actor.id) : [];
    if (matches.length) for (const c of matches) add(c.actor, side, c.name, c);
    else add(actor, side, undefined, publicTurns.find(c => c.actor?.uuid === uuid));
  }
  if (source === "auto") {
    for (const c of publicTurns) {
      const inLeft = vn.leftCast?.some(p => p.id === c.actorId);
      const inRight = vn.rightCast?.some(p => p.id === c.actorId);
      add(c.actor, inLeft || (!inRight && c.actor?.hasPlayerOwner) ? "players" : "npcs", c.name, c);
    }
    for (const [key, side] of [["leftCast", "players"], ["rightCast", "npcs"]]) {
      for (const p of vn[key] ?? []) {
        // Do not add the base actor again when encounter tokens have synthetic actors.
        if (turns.some(c => c.actorId === p.id)) continue;
        add(actors.find(a => a.id === p.id), side, p.name);
      }
    }
    for (const actor of actors) {
      if (actor.hasPlayerOwner && !turns.some(c => c.actorId === actor.id)) add(actor, "players");
    }
  }
  return { players: [...out.values()].filter(e => e.side === "players"), npcs: [...out.values()].filter(e => e.side === "npcs") };
}
