import { ID, T, esc, FALLBACK, resolveActor, portrait, stats, clampPanel, orderedEntries, buildRoster } from "./core.js";
import { quickActionData, openQuickActionWindow, closeQuickActionWindow } from "./actions.js";
import { initializeLicense, isLicensed, openLicense, LicenseMenu, HUB_ID } from "./license.js";

const S = key => game.settings.get(ID, key);
const defaults = () => ({ players: { x: 8, y: 230, width: 288, minimized: false, order: [], collapsed: [] },
  npcs: { x: null, y: 230, width: 288, minimized: false, order: [], collapsed: [] } });
let layout;
let frame;
let dragging = false;
let saveQueue = Promise.resolve();
let menuController;
let rosterEditor;

function vnData() {
  if (!game.modules.get("vnd-enhanced")?.active) return {};
  try { return game.settings.get("vnd-enhanced", "vnData") ?? {}; } catch { return {}; }
}
function combat() {
  const c = game.combat;
  return c?.scene?.id && c.scene.id !== canvas.scene?.id ? null : c;
}
function rosterData() {
  return buildRoster({ actors: game.actors.contents, combat: combat(), vn: vnData(), roster: S("roster"),
    source: S("source"), isGM: game.user.isGM, resolve: resolveActor });
}
function ensureLayout() {
  if (!layout) layout = foundry.utils.mergeObject(defaults(), S("layout"), { inplace: false });
  if (layout.npcs.x === null) layout.npcs.x = window.innerWidth - layout.npcs.width - 56;
}
function saveLayout() {
  const snapshot = structuredClone(layout);
  saveQueue = saveQueue.catch(() => {}).then(() => game.settings.set(ID, "layout", snapshot))
    .catch(error => ui.notifications.error(error.message));
}
function closeMenu() {
  menuController?.abort(); menuController = null;
  document.getElementById("vph-menu")?.remove();
}
function fallback(img) { img.addEventListener("error", () => { img.src = FALLBACK; }, { once: true }); }
function iconButton(action, icon, label, extra = "") {
  return `<button type="button" data-action="${action}" ${extra} title="${esc(T(label))}" aria-label="${esc(T(label))}"><i class="fa-solid ${icon}"></i></button>`;
}
function cardHTML(entry, side) {
  const { actor, name, combatant } = entry;
  const hp = stats(actor);
  const owned = actor.isOwner;
  const showNumbers = game.user.isGM || owned || S("showHpNumbers");
  const collapsed = layout[side].collapsed.includes(actor.uuid);
  const active = !!combatant?.id && combat()?.started && combat()?.combatant?.id === combatant.id;
  const defeated = combatant?.isDefeated || combatant?.defeated || (hp.hasHp && hp.value <= 0);
  const color = side === "npcs" ? "#c0392b" : hp.pct > 50 ? "#4caf50" : hp.pct > 25 ? "#f09800" : "#e53935";
  const effects = (actor.temporaryEffects ?? []).filter(e => !e.disabled && (e.img || e.icon)).slice(0, 6);
  return `<article class="vph-cast-portrait vph-has-plate ${active ? "vph-speaking" : ""} ${defeated ? "vph-defeated" : ""} ${collapsed ? "vph-card-collapsed" : ""}"
    data-uuid="${esc(actor.uuid)}" title="${esc(name)}">
    <img class="vph-cast-img" src="${esc(portrait(actor, vnData()))}" alt="${esc(name)}" draggable="false">
    <div class="vph-cast-plate"><div class="vph-cp-name">${esc(name)}</div>
      ${hp.hasHp ? `<div class="vph-cp-hp" role="meter" aria-label="${esc(T("hp"))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(hp.pct)}">
        <div class="vph-cp-hp-fill" style="width:${hp.pct}%;background:${color}"></div>
        ${showNumbers ? `<span class="vph-cp-hp-text">${hp.value} / ${hp.max}${hp.temp > 0 ? ` (+${hp.temp})` : ""}</span>` : ""}</div>` : ""}
      <div class="vph-cp-init">${combatant?.initiative != null ? `<span class="vph-cp-init-num">${esc(combatant.initiative)}</span>` : ""}
        <div class="vph-cp-stats">${hp.ac != null ? `<span title="${esc(T("ac"))}"><i class="fa-solid fa-shield-halved"></i>${esc(hp.ac)}</span>` : ""}
        ${hp.speed != null ? `<span title="${esc(T("speed"))}"><i class="fa-solid fa-shoe-prints"></i>${esc(hp.speed)}</span>` : ""}</div></div>
    </div>
    <button type="button" class="vph-card-open" data-action="menu" aria-label="${esc(T("actionsFor"))} ${esc(name)}"></button>
    <button type="button" class="vph-fold" data-action="fold" aria-expanded="${!collapsed}" title="${esc(T(collapsed ? "expandCard" : "collapseCard"))}" aria-label="${esc(T(collapsed ? "expandCard" : "collapseCard"))}"><i class="fa-solid ${collapsed ? "fa-caret-right" : "fa-caret-left"}"></i></button>
    <span class="vph-order-handle" draggable="true" title="${esc(T("reorder"))}" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span>
    ${effects.length ? `<div class="vph-cp-effects">${effects.map(e => `<img src="${esc(e.img || e.icon)}" title="${esc(e.name)}" alt="${esc(e.name)}">`).join("")}</div>` : ""}
  </article>`;
}

function requestRender() {
  if (!game.ready || dragging) return;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(renderHUD);
}
function renderHUD() {
  ensureLayout();
  const enabled = S("enabled");
  document.body.classList.toggle("vph-replace-vnd", enabled && S("replaceVnd") && !!game.modules.get("vnd-enhanced")?.active);
  const data = rosterData();
  for (const side of ["players", "npcs"]) {
    const old = document.getElementById(`vph-${side}`);
    const scrollTop = old?.querySelector(".vph-list")?.scrollTop ?? 0;
    const focusUuid = old?.contains(document.activeElement) ? document.activeElement.closest("[data-uuid]")?.dataset.uuid : null;
    old?.remove();
    if (!enabled || !S(side === "players" ? "showPlayers" : "showNpcs")) continue;
    const items = orderedEntries(data[side], layout[side].order);
    const saved = layout[side];
    const panel = document.createElement("section");
    panel.id = `vph-${side}`;
    panel.className = `vph-panel vph-theme-${S("theme")} ${side === "npcs" ? "vph-right-panel" : ""} ${saved.minimized ? "vph-minimized" : ""}`;
    panel.setAttribute("aria-label", T(side));
    panel.innerHTML = `<header class="vph-header"><span class="vph-panel-drag" tabindex="0" title="${esc(T("moveHint"))}" aria-label="${esc(T("moveHint"))}">
        <i class="fa-solid fa-grip-vertical"></i><span>${esc(T(side))}</span><b>${items.length}</b></span>
      ${game.user.isGM ? iconButton("roster", "fa-user-plus", "manageRoster") : ""}
      ${iconButton("minimize", saved.minimized ? "fa-chevron-down" : "fa-chevron-up", saved.minimized ? "expandPanel" : "minimizePanel", `aria-expanded="${!saved.minimized}"`)}
      </header><div class="vph-list">${items.map(e => cardHTML(e, side)).join("") || `<p class="vph-empty">${esc(T("empty"))}</p>`}</div>
      <div class="vph-resize" role="separator" tabindex="0" aria-label="${esc(T("resizeHint"))}" aria-orientation="vertical" title="${esc(T("resizeHint"))}"></div>`;
    panel.addEventListener("click", event => onPanelClick(event, side));
    panel.addEventListener("contextmenu", event => {
      const row = event.target.closest("[data-uuid]");
      if (!row) return;
      event.preventDefault(); openMenu(row.dataset.uuid, row);
    });
    panel.querySelectorAll("img").forEach(fallback);
    bindMovement(panel, side);
    bindOrder(panel, side);
    document.body.append(panel);
    panel.querySelector(".vph-list").scrollTop = scrollTop;
    const position = clampPanel(saved, { width: window.innerWidth, height: window.innerHeight }, Math.min(panel.offsetHeight, 160), saved.minimized);
    Object.assign(saved, position);
    placePanel(panel, saved);
    if (focusUuid) [...panel.querySelectorAll("[data-uuid]")].find(r => r.dataset.uuid === focusUuid)?.querySelector(".vph-card-open")?.focus();
  }
  if (!enabled) { closeMenu(); closeQuickActionWindow(); }
}
function placePanel(panel, state) {
  panel.style.left = `${state.x}px`; panel.style.top = `${state.y}px`;
  panel.style.width = `${state.minimized ? 148 : state.width}px`;
  panel.style.maxHeight = `${Math.max(40, window.innerHeight - state.y - 8)}px`;
}
function onPanelClick(event, side) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  const row = event.target.closest("[data-uuid]");
  if (action === "menu") openMenu(row.dataset.uuid, row);
  if (action === "roster" && game.user.isGM) openRoster();
  if (action === "minimize") { layout[side].minimized = !layout[side].minimized; saveLayout(); renderHUD(); }
  if (action === "fold" && row) {
    const collapsed = layout[side].collapsed;
    const i = collapsed.indexOf(row.dataset.uuid);
    if (i >= 0) collapsed.splice(i, 1); else collapsed.push(row.dataset.uuid);
    saveLayout(); renderHUD();
  }
}
function bindMovement(panel, side) {
  for (const [selector, resizing] of [[".vph-panel-drag", false], [".vph-resize", true]]) {
    const handle = panel.querySelector(selector);
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault(); closeMenu(); dragging = true;
      const start = { x: event.clientX, y: event.clientY, ...layout[side] };
      const mouseX = event.clientX, mouseY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      const move = ev => {
        if (resizing) layout[side].width = start.width + ev.clientX - mouseX;
        else { layout[side].x = start.x + ev.clientX - mouseX; layout[side].y = start.y + ev.clientY - mouseY; }
        Object.assign(layout[side], clampPanel(layout[side], { width: window.innerWidth, height: window.innerHeight }, 60, layout[side].minimized));
        placePanel(panel, layout[side]);
      };
      const finish = () => {
        handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", finish); handle.removeEventListener("pointercancel", finish);
        dragging = false; saveLayout(); requestRender();
      };
      handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", finish); handle.addEventListener("pointercancel", finish);
    });
    handle.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault(); const step = event.shiftKey ? 20 : 5;
      if (resizing) layout[side].width += event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
      else {
        layout[side].x += event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
        layout[side].y += event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
      }
      Object.assign(layout[side], clampPanel(layout[side], { width: window.innerWidth, height: window.innerHeight }, 60, layout[side].minimized));
      placePanel(panel, layout[side]); saveLayout();
    });
  }
}
function bindOrder(panel, side) {
  panel.addEventListener("dragstart", event => {
    if (!event.target.closest(".vph-order-handle")) return;
    event.dataTransfer.setData("text/plain", JSON.stringify({ type: "vph-order", side, uuid: event.target.closest("[data-uuid]").dataset.uuid }));
  });
  panel.addEventListener("dragover", event => { if (event.target.closest("[data-uuid]")) event.preventDefault(); });
  panel.addEventListener("drop", event => {
    const target = event.target.closest("[data-uuid]");
    if (!target) return;
    let data; try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch { return; }
    if (data.type !== "vph-order" || data.side !== side || data.uuid === target.dataset.uuid) return;
    event.preventDefault();
    const order = [...panel.querySelectorAll("[data-uuid]")].map(r => r.dataset.uuid).filter(uuid => uuid !== data.uuid);
    order.splice(order.indexOf(target.dataset.uuid), 0, data.uuid);
    layout[side].order = [...new Set(order)]; saveLayout(); renderHUD();
  });
}
function openMenu(uuid, anchor) {
  closeMenu(); closeQuickActionWindow();
  const actor = resolveActor(uuid);
  if (!actor) return;
  const data = quickActionData(actor);
  const categories = [["attacks", "fa-gavel"], ["spells", "fa-hat-wizard"], ["feats", "fa-scroll"], ["items", "fa-briefcase"]];
  const menu = document.createElement("div");
  menu.id = "vph-menu"; menu.className = `vph-theme-${S("theme")}`; menu.setAttribute("role", "menu");
  menu.innerHTML = categories.map(([key, icon]) => `<button type="button" role="menuitem" data-cat="${key}" ${!actor.isOwner || !data[key].length ? "disabled" : ""}>
    <i class="fa-solid ${icon}"></i>${esc(T(`qa.${key}`))}</button>`).join("") +
    `<button type="button" role="menuitem" data-cat="sheet" ${!actor.isOwner && !actor.testUserPermission(game.user, "OBSERVER") ? "disabled" : ""}><i class="fa-solid fa-id-card"></i>${esc(T("openSheet"))}</button>`;
  menu.addEventListener("click", event => {
    const button = event.target.closest("[data-cat]"); if (!button || button.disabled) return;
    const category = button.dataset.cat; closeMenu();
    if (category === "sheet") actor.sheet.render(true);
    else if (actor.isOwner) openQuickActionWindow(uuid, category, anchor);
  });
  document.body.append(menu);
  const box = anchor.getBoundingClientRect();
  const x = box.right + menu.offsetWidth + 8 > window.innerWidth ? box.left - menu.offsetWidth - 8 : box.right + 8;
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(box.top, window.innerHeight - menu.offsetHeight - 8))}px`;
  menuController = new AbortController();
  document.addEventListener("pointerdown", event => { if (!menu.contains(event.target) && !anchor.contains(event.target)) closeMenu(); }, { signal: menuController.signal });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); }, { signal: menuController.signal });
  menu.querySelector("button:not([disabled])")?.focus();
}

function openRoster() { rosterEditor ??= new RosterEditor(); return rosterEditor.render({ force: true }); }
class RosterEditor extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "vph-roster-editor", classes: ["vph-roster-editor"],
    window: { title: "VPH.manageRoster", icon: "fa-solid fa-users", resizable: true }, position: { width: 510 },
    actions: { add: RosterEditor.add, remove: RosterEditor.remove, reset: RosterEditor.reset } };
  async _renderHTML() {
    const candidates = new Map(game.actors.contents.map(a => [a.uuid, a]));
    for (const token of canvas.scene?.tokens ?? []) if (token.actor) candidates.set(token.actor.uuid, token.actor);
    const current = rosterData();
    const html = document.createElement("div");
    html.innerHTML = `<p>${esc(T("rosterHint"))}</p><select name="actor">${[...candidates.values()].sort((a,b) => a.name.localeCompare(b.name)).map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}${a.isToken ? ` (${esc(T("token"))})` : ""}</option>`).join("")}</select>
      <div class="vph-roster-add">${["players", "npcs"].map(side => `<button type="button" data-action="add" data-side="${side}">${esc(T(`add${side}`))}</button>`).join("")}</div>
      ${["players", "npcs"].map(side => `<h3>${esc(T(side))}</h3>${current[side].map(e => `<div class="vph-roster-row"><span>${esc(e.name)}</span><button type="button" data-action="remove" data-uuid="${esc(e.actor.uuid)}" aria-label="${esc(T("remove"))}"><i class="fa-solid fa-xmark"></i></button></div>`).join("")}`).join("")}
      <p class="hint">${esc(T("rosterRemoveHint"))}</p><button type="button" data-action="reset">${esc(T("resetRoster"))}</button>`;
    return html;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); }
  static async add(_event, target) {
    if (!game.user.isGM) return;
    const uuid = this.element.querySelector('[name="actor"]').value; if (!resolveActor(uuid)) return;
    const data = structuredClone(S("roster"));
    for (const side of ["players", "npcs"]) data[side] = (data[side] ?? []).filter(id => id !== uuid);
    data[target.dataset.side].push(uuid); data.excluded = (data.excluded ?? []).filter(id => id !== uuid);
    await game.settings.set(ID, "roster", data); this.render({ force: true });
  }
  static async remove(_event, target) {
    if (!game.user.isGM) return;
    const uuid = target.dataset.uuid, data = structuredClone(S("roster"));
    for (const side of ["players", "npcs"]) data[side] = (data[side] ?? []).filter(id => id !== uuid);
    data.excluded = [...new Set([...(data.excluded ?? []), uuid])];
    await game.settings.set(ID, "roster", data); this.render({ force: true });
  }
  static async reset() {
    if (!game.user.isGM) return;
    await game.settings.set(ID, "roster", { players: [], npcs: [], excluded: [] }); this.render({ force: true });
  }
}
class LayoutReset extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { window: { title: "VPH.resetLayout" }, position: { width: 350 }, actions: {
    reset: async function() { layout = defaults(); await game.settings.set(ID, "layout", layout); renderHUD(); await this.close(); }
  } };
  async _renderHTML() { const div = document.createElement("div"); div.innerHTML = `<p>${esc(T("resetHint"))}</p><button type="button" data-action="reset">${esc(T("resetLayout"))}</button>`; return div; }
  _replaceHTML(result, content) { content.replaceChildren(result); }
}
Hooks.once("init", () => {
  const register = (key, type, value, extra = {}) => game.settings.register(ID, key, {
    name: `VPH.settings.${key}.name`, hint: `VPH.settings.${key}.hint`, type, default: value,
    scope: "client", config: true, onChange: requestRender, ...extra
  });
  register("enabled", Boolean, true);
  register("showPlayers", Boolean, true); register("showNpcs", Boolean, true);
  register("theme", String, "classic", { choices: { classic: "VPH.classic", darkest: "VPH.darkest", eclipse: "VPH.eclipse" } });
  register("replaceVnd", Boolean, true);
  register("showHpNumbers", Boolean, false, { scope: "world" });
  register("source", String, "auto", { scope: "world", choices: { auto: "VPH.auto", manual: "VPH.manual" } });
  register("roster", Object, { players: [], npcs: [], excluded: [] }, { scope: "world", config: false });
  register("layout", Object, defaults(), { config: false, onChange: value => { layout = structuredClone(value); requestRender(); } });
  game.settings.registerMenu(ID, "manageRoster", { name: "VPH.manageRoster", label: "VPH.configureRoster",
    hint: "VPH.rosterHint", icon: "fa-solid fa-users", type: RosterEditor, restricted: true });
  game.settings.registerMenu(ID, "resetLayout", { name: "VPH.resetLayout", label: "VPH.resetLayout",
    hint: "VPH.resetHint", icon: "fa-solid fa-arrows-rotate", type: LayoutReset, restricted: false });
  if (!game.modules.get(HUB_ID)?.active) game.settings.registerMenu(ID, "license", {
    name: "VPH.license.title", label: "VPH.license.open", hint: "VPH.license.hint",
    icon: "fa-brands fa-patreon", type: LicenseMenu, restricted: true
  });
  game.modules.get(ID).api = { renderHUD, openRoster, isLicensed, openLicense };
});
Hooks.once("ready", () => {
  initializeLicense(); // Register before any await; HUD activation is unconditional.
  ensureLayout(); renderHUD(); window.addEventListener("resize", requestRender);
});
for (const name of ["updateActor", "createActor", "deleteActor", "createItem", "updateItem", "deleteItem",
  "createCombat", "updateCombat", "deleteCombat", "combatTurnChange", "createCombatant", "updateCombatant", "deleteCombatant",
  "canvasReady", "createToken", "updateToken", "deleteToken", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect", "updateUser"])
  Hooks.on(name, requestRender);
Hooks.on("updateSetting", setting => { if (setting.key === "vnd-enhanced.vnData") requestRender(); });
