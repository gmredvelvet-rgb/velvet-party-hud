import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
globalThis.document = { getElementById: () => null };
globalThis.game = { view: 'game', user: { isGM: true }, modules: new Map() };
const license = await import('../scripts/license.js');

test('hub registers actual module once; no subscription is still a working soft gate', () => {
  const registered = [];
  const api = { apiVersion: 2, register: id => { registered.push(id); return true; }, isLicensed: () => false };
  game.modules.set(license.HUB_ID, { active: true, api });
  license.initializeLicense(); license.initializeLicense();
  assert.deepEqual(registered, ['velvet-party-hud']);
  assert.equal(license.isLicensed(), false);
});
test('coverage is requested for Party HUD and license card is delegated to the hub', () => {
  let requested, opened = 0;
  const api = { apiVersion: 2, register: () => true, isLicensed: id => { requested = id; return true; }, openLicenseCard: () => opened++ };
  game.modules.set(license.HUB_ID, { active: true, api });
  license.initializeLicense();
  assert.equal(license.isLicensed(), true);
  assert.equal(requested, 'velvet-party-hud');
  license.openLicense(); assert.equal(opened, 1);
  game.user.isGM = false; license.openLicense(); assert.equal(opened, 1);
  game.user.isGM = true;
});
test('an unavailable hub never throws from the license check', () => {
  game.modules.set(license.HUB_ID, { active: true, api: { apiVersion: 2, isLicensed: () => { throw Error('offline'); } } });
  assert.equal(license.isLicensed(), false);
  game.modules.get(license.HUB_ID).active = false;
  assert.equal(license.licenseHub(), null);
  license.stopReminder();
});
