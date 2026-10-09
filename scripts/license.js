/**
 * VN Dialogues Enhanced soft gate, using the shared Velvet License Hub v2.
 * Copyright (c) 2024–2025 GM RedVelvet / The GM Studio. See LICENSE.
 * Licensing only selects the reminder; it must never prevent the HUD booting.
 */
import { ID, T, esc } from "./core.js";

export const HUB_ID = "velvet-license-hub";
export const HUB_MANIFEST = "https://github.com/gmredvelvet-rgb/velvet-license-hub/releases/latest/download/module.json";
export const FIRST_REMINDER_MS = 8000;
export const REMINDER_MS = 10 * 60 * 1000;
export const AUTO_HIDE_MS = 30 * 1000;
let firstTimer;
let reminderTimer;
let hideTimer;
let registeredApi;

export function licenseHub() {
  const hub = game.modules.get(HUB_ID);
  return hub?.active && hub.api?.apiVersion >= 2 ? hub.api : null;
}
export function isLicensed() {
  try { return licenseHub()?.isLicensed(ID) === true; }
  catch { return false; }
}
export function stopReminder() {
  clearTimeout(firstTimer); clearInterval(reminderTimer); clearTimeout(hideTimer);
  firstTimer = reminderTimer = hideTimer = undefined;
  document.getElementById("vph-license-reminder")?.remove();
}
function delegate() {
  const hub = licenseHub();
  if (!hub) return false;
  if (registeredApi !== hub) {
    if (hub.register(ID) === false) return false;
    registeredApi = hub;
  }
  stopReminder(); // With a working hub there is only its shared card.
  return true;
}
export function openLicense() {
  if (!game.user?.isGM) return;
  try {
    const hub = licenseHub();
    if (hub) return hub.openLicenseCard();
  } catch (error) { console.warn(`${ID} | License Hub unavailable`, error); }
  showReminder(false, true);
}
export function showReminder(autoHide = true, force = false) {
  if (!game.user?.isGM) return;
  try { if (!force && delegate()) return; }
  catch (error) { console.warn(`${ID} | License reminder fallback`, error); }
  if (document.getElementById("vph-license-reminder")) return;
  const card = document.createElement("aside");
  card.id = "vph-license-reminder";
  card.setAttribute("role", "status");
  card.innerHTML = `<strong>Velvet Party HUD</strong><p>${esc(T("license.fallback"))}</p>
    <a href="${HUB_MANIFEST}" target="_blank" rel="noopener noreferrer">${esc(T("license.installHub"))}</a>
    <button type="button">${esc(T("license.dismiss"))}</button>`;
  card.querySelector("button").addEventListener("click", () => { clearTimeout(hideTimer); card.remove(); });
  card.addEventListener("pointerenter", () => clearTimeout(hideTimer));
  document.body.append(card);
  if (autoHide) hideTimer = setTimeout(() => card.remove(), AUTO_HIDE_MS);
}
export function initializeLicense() {
  if (game.view && game.view !== "game") return;
  try { if (delegate()) return; }
  catch (error) { console.warn(`${ID} | License Hub registration failed; HUD remains available`, error); }
  stopReminder();
  if (!game.user?.isGM) return;
  firstTimer = setTimeout(showReminder, FIRST_REMINDER_MS);
  reminderTimer = setInterval(showReminder, REMINDER_MS);
}
// This menu exists only for a missing hub in init. API failures still expose
// the fallback card through the HUD's public API; they never block features.
export class LicenseMenu extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { window: { title: "VPH.license.title" } };
  render() { openLicense(); return this; }
  async _renderHTML() { return document.createElement("div"); }
  _replaceHTML(result, content) { content.replaceChildren(result); }
}
