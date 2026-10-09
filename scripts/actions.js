/** Quick actions adapted from VN Dialogues Enhanced. Copyright (c) 2024–2025 GM RedVelvet / The GM Studio. See LICENSE. */
import { T, TF, esc as _esc, resolveActor } from './core.js';
const _QA_IMG_FALLBACK = "icons/svg/item-bag.svg";

// Localized singular name of an item type ("Consumable", "Objeto de consumo").
// Falls back to the raw type id so a module-added type still reads sensibly.
function _qaTypeLabel(type) {
  const key   = CONFIG.Item?.typeLabels?.[type];
  const label = key ? game.i18n.localize(key) : "";
  return (label && label !== key) ? label
       : String(type ?? "").replace(/^\w/, c => c.toUpperCase());
}

// Collect an actor's usable actions, grouped into attacks / spells / items.
// Strikes carry the index into actor.system.actions (pf2e needs it to roll);
// everything else carries an itemId.
export function quickActionData(actor) {
  const out = { attacks: [], spells: [], feats: [], items: [] };
  if (!actor) return out;
  const sys = game.system?.id;
  const img = (i) => i?.img || _QA_IMG_FALLBACK;
  const cap = (s) => String(s ?? "").replace(/^\w/, c => c.toUpperCase());

  // PF2e and Starfinder 2e both run the PF2e engine (strikes in system.actions,
  // Multiple Attack Penalty variants). Detect either by id or by the strike array.
  const pf2eLike = sys === "pf2e" || sys === "sf2e" || sys === "starfinder"
                || Array.isArray(actor.system?.actions);

  if (sys === "dnd5e") {
    // dnd5e 4.x+ hangs usage off "activities", so what counts as an attack is not
    // the item type but whether it owns an attack activity: monster actions and
    // class features live in `feat` items and would otherwise never reach the
    // Actions tab. actionType is the pre-activities (3.x) fallback.
    const LEGACY_ATTACK = ["mwak", "rwak", "msak", "rsak"];
    const isAttack = (i) => i.hasAttack
      ?? (!!i.system?.activities?.getByType?.("attack")?.length
          || LEGACY_ATTACK.includes(i.system?.actionType));
    // "Channel Divinity", "Class Feature", "Monster Feature"… localized by 5e.
    const featGroup = (i) => {
      const cfg = CONFIG.DND5E?.featureTypes?.[i.system?.type?.value];
      return cfg?.subtypes?.[i.system?.type?.subtype] ?? cfg?.label ?? _qaTypeLabel(i.type);
    };
    // Types that describe the character rather than sit in the backpack.
    const FEATURE_TYPES = ["feat", "class", "subclass", "background", "race"];

    for (const item of actor.items ?? []) {
      const t    = item.type;
      const base = { itemId: item.id, name: item.name, img: img(item) };
      if (t === "spell") {
        const lvl   = item.system?.level ?? 0;
        const group = lvl === 0 ? T("qa.cantrip") : TF("qa.spellLevel", { n: lvl });
        out.spells.push({ ...base, kind: "spell", sub: group, group });
      } else if (t === "weapon" || isAttack(item)) {
        const group = t === "feat" ? featGroup(item) : _qaTypeLabel(t);
        out.attacks.push({ ...base, kind: "item", sub: group, group });
      } else if (FEATURE_TYPES.includes(t)) {
        const group = t === "feat" ? featGroup(item) : _qaTypeLabel(t);
        out.feats.push({ ...base, kind: "item", sub: group, group });
      } else {
        // Everything left is gear — consumables, tools, loot, containers, and any
        // type a module added. Nothing is dropped on the floor.
        const group = _qaTypeLabel(t);
        out.items.push({ ...base, kind: "item", sub: group, group });
      }
    }
    return out;
  }

  if (pf2eLike) {
    (actor.system?.actions ?? []).forEach((a, idx) => {
      if (a?.type !== "strike") return;
      // MAP variants: [full, -5, -10]. Keep each label so the player can pick.
      const variants = (a.variants ?? []).map((v, i) =>
        v?.label ?? ["", "-5", "-10"][i] ?? `MAP ${i}`);
      out.attacks.push({ kind: "strike", strikeIdx: idx, group: "Strike",
        name: a.label ?? a.item?.name ?? "Strike",
        img: a.item?.img ?? a.imageUrl ?? "icons/svg/sword.svg",
        sub: a.item?.name && a.item.name !== a.label ? a.item.name : "",
        variants });
    });
    for (const item of actor.items ?? []) {
      const t = item.type;
      if (t === "spell") {
        const isCantrip = item.isCantrip ?? item.system?.traits?.value?.includes?.("cantrip") ?? false;
        const rank = item.rank ?? item.system?.level?.value;
        const group = isCantrip ? T("qa.cantrip")
                    : (rank != null ? TF("qa.spellRank", { n: rank }) : T("qa.spells"));
        out.spells.push({ kind: "spell", itemId: item.id, name: item.name, img: img(item),
          sub: group, group });
      } else if (t === "action") {
        // PF2e actions/abilities live in the Actions tab alongside strikes, just
        // like the official sheet. Used via the item's chat card.
        out.attacks.push({ kind: "item", itemId: item.id, name: item.name, img: img(item), sub: "Action", group: "Action" });
      } else if (t === "feat") {
        const traits = item.system?.traits?.value ?? [];
        const actionType = item.system?.actionType?.value;
        const isActiveImpulse = traits.includes("impulse")
          && ["action", "reaction", "free"].includes(actionType);
        if (isActiveImpulse) {
          const actionCount = Number(item.system?.actions?.value);
          const actionLabel = actionType === "reaction" ? T("qa.reaction")
            : actionType === "free" ? T("qa.freeAction")
            : Number.isFinite(actionCount)
              ? `${TF("qa.actionCost", { n: actionCount })} · ${T("qa.impulse")}`
              : T("qa.impulse");
          out.attacks.push({ kind: "item", itemId: item.id, name: item.name, img: img(item),
            sub: actionLabel, group: T("qa.impulse") });
          continue;
        }
        // Feats grouped by category (class / skill / general / ancestry…).
        const g = cap(item.system?.category || "feat");
        out.feats.push({ kind: "item", itemId: item.id, name: item.name, img: img(item), sub: g, group: g });
      } else if (["consumable", "equipment", "weapon", "armor"].includes(t)) {
        out.items.push({ kind: "item", itemId: item.id, name: item.name, img: img(item),
          sub: cap(t), group: cap(t) });
      }
    }
    return out;
  }

  // Generic fallback for any other system.
  for (const item of actor.items ?? [])
    out.items.push({ kind: "item", itemId: item.id, name: item.name, img: img(item),
      sub: _qaTypeLabel(item.type), group: _qaTypeLabel(item.type) });
  return out;
}

// Perform one quick action, using the right per-system entry point.
// `variantIdx` picks the PF2e Multiple Attack Penalty variant (0 = full, 1 = -5,
// 2 = -10); ignored for everything else.
export async function useQuickAction(actor, entry, ev, variantIdx = 0) {
  if (!actor?.isOwner) return;
  const sys = game.system?.id;
  try {
    if (entry.kind === "strike") {
      const strike  = actor.system?.actions?.[entry.strikeIdx];
      const variant = strike?.variants?.[variantIdx] ?? strike?.variants?.[0];
      if (variant?.roll)  return void await variant.roll({ event: ev });
      if (strike?.attack) return void await strike.attack({ event: ev });
      ui.notifications?.warn(T("notify.qaCantUse"));
      return;
    }
    const item = actor.items.get(entry.itemId);
    if (!item) { ui.notifications?.warn(T("notify.qaCantUse")); return; }

    // 5e reads config.event to decide whether to skip the activity-choice dialog
    // (shift = fast-forward); passing it as the dialog config never reached it.
    if (sys === "dnd5e" && item.use)  return void await item.use({ event: ev?.originalEvent ?? ev });

    if (entry.kind === "spell") {
      // PF2e: cast through the owning spellcasting entry when possible.
      const entryId  = item.system?.location?.value;
      const entryDoc = entryId ? actor.items.get(entryId) : null;
      if (entryDoc?.cast) {
        const rank = item.rank ?? item.system?.level?.value;
        return void await entryDoc.cast(item, rank != null ? { rank } : {});
      }
    }
    if (item.toMessage) return void await item.toMessage(ev);
    if (item.toChat)    return void await item.toChat(ev);
    if (item.use)       return void await item.use();
    ui.notifications?.warn(T("notify.qaCantUse"));
  } catch (e) {
    console.warn("Velvet Party HUD | quick action failed:", e);
    ui.notifications?.error(T("notify.qaFailed"));
  }
}

export function closeQuickActionWindow() {
  const win = document.getElementById("vph-qa-window");
  win?._vphAbortController?.abort();
  win?.remove();
}

// The RPG popup. `category` picks the initial tab; the header carries the
// portrait + name; entries are click-to-use and drag-to-hotbar.
export function openQuickActionWindow(actorId, category, anchorEl) {
  closeQuickActionWindow();
  const actor = resolveActor(actorId);
  if (!actor) { ui.notifications?.warn(T("notify.actorNotFound")); return; }
  if (!actor.isOwner) return;
  const data = quickActionData(actor);

  const cats = [
    { key: "attacks", icon: "fa-gavel",          label: T("qa.attacks"), list: data.attacks },
    { key: "spells",  icon: "fa-hat-wizard",     label: T("qa.spells"),  list: data.spells },
    { key: "feats",   icon: "fa-scroll",         label: T("qa.feats"),   list: data.feats },
    { key: "items",   icon: "fa-briefcase",      label: T("qa.items"),   list: data.items }
  ].filter(c => c.list.length);

  if (!cats.length) { ui.notifications?.info(T("qa.emptyAll")); return; }
  let active = cats.find(c => c.key === category) ? category : cats[0].key;

  const portrait = actor.img || actor.prototypeToken?.texture?.src || _QA_IMG_FALLBACK;
  const win = document.createElement("div");
  win.id = "vph-qa-window";
  win.className = "vph-qa-window";
  win.classList.add(`vph-theme-${game.settings.get('velvet-party-hud', 'theme')}`);
  win.setAttribute("role", "dialog");
  win.setAttribute("aria-label", actor.name);

  const tabsHtml = cats.map(c =>
    `<button type="button" class="vph-qa-tab${c.key === active ? " vph-qa-tab-active" : ""}" data-cat="${c.key}">
       <i class="fas ${c.icon}"></i> ${_esc(c.label)} <span class="vph-qa-count">${c.list.length}</span>
     </button>`).join("");

  // Filter chips — by spell rank / cantrip and by item type. Reset per tab.
  let activeFilter = "";
  const groupsFor = (cat) => [...new Set(
    (cats.find(c => c.key === cat)?.list ?? []).map(e => e.group).filter(Boolean)
  )];
  const filtersHtml = (cat) => {
    const groups = groupsFor(cat);
    if (groups.length < 2) return "";   // nothing worth filtering
    return `<button type="button" class="vph-qa-filter${activeFilter === "" ? " vph-qa-filter-active" : ""}" data-g="">${_esc(T("qa.all"))}</button>` +
      groups.map(g => `<button type="button" class="vph-qa-filter${activeFilter === g ? " vph-qa-filter-active" : ""}" data-g="${_esc(g)}">${_esc(g)}</button>`).join("");
  };

  const gridHtml = (cat) => {
    const list = cats.find(c => c.key === cat)?.list ?? [];
    // Keep the ORIGINAL index in data-idx so the click handler still resolves
    // against the full list even when a filter hides some entries.
    const shown = list.map((e, i) => ({ e, i }))
      .filter(({ e }) => !activeFilter || e.group === activeFilter);
    if (!shown.length) return `<div class="vph-qa-empty">${_esc(T("qa.emptyCat"))}</div>`;
    return shown.map(({ e, i }) => {
      // PF2e strikes with Multiple Attack Penalty → a row of MAP buttons so the
      // player picks which attack (full / -5 / -10) instead of always the first.
      const mapRow = (e.kind === "strike" && e.variants && e.variants.length > 1)
        ? `<div class="vph-qa-map">` + e.variants.map((lbl, vi) =>
            `<button type="button" class="vph-qa-map-btn" data-v="${vi}" title="MAP ${vi}">${_esc(lbl || (vi === 0 ? "1st" : vi === 1 ? "-5" : "-10"))}</button>`
          ).join("") + `</div>`
        : "";
      return `<div class="vph-qa-entry${mapRow ? " vph-qa-has-map" : ""}" data-cat="${cat}" data-idx="${i}"${e.itemId ? ` data-item-id="${_esc(e.itemId)}" draggable="true"` : ""} role="button" tabindex="0" title="${_esc(e.name)}${e.sub ? " — " + _esc(e.sub) : ""}">
         <img src="${_esc(e.img)}" alt=""/>
         <div class="vph-qa-entry-text">
           <div class="vph-qa-entry-name">${_esc(e.name)}</div>
           ${e.sub ? `<div class="vph-qa-entry-sub">${_esc(e.sub)}</div>` : ""}
         </div>
         ${mapRow}
       </div>`;
    }).join("");
  };

  win.innerHTML = `
    <div class="vph-qa-header">
      <img class="vph-qa-portrait" src="${_esc(portrait)}" alt=""/>
      <span class="vph-qa-title">${_esc(actor.name)}</span>
      <button type="button" class="vph-qa-close" title="${_esc(T("ui.closeShort"))}"><i class="fas fa-times"></i></button>
    </div>
    <div class="vph-qa-tabs">${tabsHtml}</div>
    <div class="vph-qa-filters">${filtersHtml(active)}</div>
    <div class="vph-qa-grid">${gridHtml(active)}</div>`;

  const grid    = win.querySelector(".vph-qa-grid");
  const filters = win.querySelector(".vph-qa-filters");

  const rebuildFilters = () => {
    filters.innerHTML = filtersHtml(active);
    filters.style.display = filters.children.length ? "" : "none";
  };
  rebuildFilters();

  win.querySelector(".vph-qa-close").addEventListener("click", closeQuickActionWindow);

  win.querySelectorAll(".vph-qa-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      active = tab.dataset.cat;
      activeFilter = "";                 // reset filter when switching category
      win.querySelectorAll(".vph-qa-tab").forEach(t => t.classList.toggle("vph-qa-tab-active", t === tab));
      rebuildFilters();
      grid.innerHTML = gridHtml(active);
    });
  });

  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".vph-qa-filter");
    if (!btn) return;
    activeFilter = btn.dataset.g ?? "";
    filters.querySelectorAll(".vph-qa-filter").forEach(b => b.classList.toggle("vph-qa-filter-active", b === btn));
    grid.innerHTML = gridHtml(active);
  });

  grid.addEventListener("click", async (e) => {
    const cell = e.target.closest(".vph-qa-entry");
    if (!cell) return;
    const list = cats.find(c => c.key === cell.dataset.cat)?.list ?? [];
    const entry = list[Number(cell.dataset.idx)];
    if (!entry) return;
    // A MAP button rolls its specific variant; anywhere else uses variant 0.
    const mapBtn = e.target.closest(".vph-qa-map-btn");
    const variantIdx = mapBtn ? Number(mapBtn.dataset.v) : 0;
    // Close before the system opens its native roll/configuration dialog. This
    // prevents the HUD popup from remaining above PF2e's application window.
    closeQuickActionWindow();
    await useQuickAction(actor, entry, e, variantIdx);
  });
  grid.addEventListener("keydown", e => {
    if (e.target.matches(".vph-qa-entry") && ["Enter", " "].includes(e.key)) {
      e.preventDefault(); e.target.click();
    }
  });

  // Drag any real item to the macro hotbar, exactly like dragging from a sheet.
  grid.addEventListener("dragstart", (e) => {
    const cell = e.target.closest(".vph-qa-entry[data-item-id]");
    if (!cell) return;
    const item = actor.items.get(cell.dataset.itemId);
    const dd = item?.toDragData?.();
    if (dd) e.dataTransfer.setData("text/plain", JSON.stringify(dd));
  });

  document.body.appendChild(win);

  // Position beside the anchor, clamped to the viewport.
  const r = anchorEl?.getBoundingClientRect?.();
  const w = win.offsetWidth, h = win.offsetHeight;
  let left = r ? r.right + 8 : (window.innerWidth - w) / 2;
  let top  = r ? r.top : (window.innerHeight - h) / 2;
  if (left + w > window.innerWidth - 8)  left = r ? r.left - w - 8 : left;
  left = Math.max(8, Math.min(left, window.innerWidth  - w - 8));
  top  = Math.max(8, Math.min(top,  window.innerHeight - h - 8));
  win.style.left = `${left}px`;
  win.style.top  = `${top}px`;

  const ac = new AbortController();
  win._vphAbortController = ac;
  setTimeout(() => document.addEventListener("mousedown", (ev) => {
    if (!win.contains(ev.target)) { closeQuickActionWindow(); ac.abort(); }
  }, { signal: ac.signal }), 50);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { closeQuickActionWindow(); ac.abort(); }
  }, { signal: ac.signal });
}
