import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, dirname, join, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(process.env.PLAYWRIGHT_PATH ? pathToFileURL(join(process.env.PLAYWRIGHT_PATH, "index.mjs")).href : "playwright");
const locale = JSON.parse((await readFile(join(root, "language/es.json"), "utf8")).replace(/^\uFEFF/, ""));
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/fontawesome/css/all.min.css"><link rel="stylesheet" href="/styles/hud.css">
<style>body{margin:0;background:radial-gradient(ellipse at 50% 40%,#27303d,#101318);height:100vh;color:#eee;font-family:Arial}
.vph-roster-editor{position:fixed;left:450px;top:200px;width:450px;background:#24272f;border:1px solid #b0914a;z-index:20000}
button,input,select{font:13px Arial;color:#eee;background:#252a35;border:1px solid #84744e;padding:4px}
.vph-roster-editor button{cursor:pointer}#vne-main{display:grid;grid-template-columns:288px 1fr 288px}
.vne-side-panel{position:fixed;bottom:5px;color:#bbb}.vne-right-panel{right:5px}</style></head><body>
<div id="vne-main"><div class="vne-stage"><div class="vne-side-panel">Original VND player HUD</div><div class="vne-side-panel vne-right-panel">Original VND NPC HUD</div></div></div>
<script>
const translations=${JSON.stringify(locale)};
globalThis.handlers=new Map();globalThis.Hooks={on:(n,f)=>{if(!handlers.has(n))handlers.set(n,[]);handlers.get(n).push(f)},once:(n,f)=>Hooks.on(n,f)};
globalThis.emit=async(n,...args)=>{for(const f of handlers.get(n)||[])await f(...args)};
globalThis.values=new Map();globalThis.registrations=new Map();globalThis.menus=new Map();globalThis.used=[];
const modules=new Map([['velvet-party-hud',{active:true}],['vnd-enhanced',{active:true}]]);
globalThis.licenseCalls=[];globalThis.covered=false;
modules.set('velvet-license-hub',{active:true,api:{apiVersion:2,register:id=>{licenseCalls.push(id);return true},isLicensed:id=>covered&&id==='velvet-party-hud',openLicenseCard:()=>used.push('license-card')}});
class App{constructor(){this.options=this.constructor.DEFAULT_OPTIONS}async render(){this.element?.remove();this.element=document.createElement('section');this.element.className=(this.options.classes||[]).join(' ');
const content=document.createElement('div');content.className='window-content';this.element.append(content);document.body.append(this.element);this._replaceHTML(await this._renderHTML(),content);
this.element.addEventListener('click',e=>{const t=e.target.closest('[data-action]');if(t)this.options.actions[t.dataset.action]?.call(this,e,t)});return this}async close(){this.element.remove()}}
const collection=arr=>{arr.get=id=>arr.find(i=>i.id===id);arr.contents=arr;return arr};
function actor(id,name,owner=true){const a={id,uuid:'Actor.'+id,name,img:'/portrait.svg',hasPlayerOwner:owner,system:{attributes:{hp:{value:45,max:46},ac:{value:19},speed:{total:30}},actions:[{type:'strike',label:'Espada',variants:[{label:'1º',roll:()=>used.push('strike0')},{label:'-5',roll:()=>used.push('strike1')},{label:'-10',roll:()=>used.push('strike2')}]}]},
get isOwner(){return game.user.isGM||owner},temporaryEffects:[],testUserPermission:()=>owner,sheet:{render:()=>used.push('sheet-'+id)}};
a.items=collection([{id:'spell',type:'spell',name:'Heal',img:'/portrait.svg',rank:1,system:{location:{value:'casting'}},toDragData:()=>({type:'Item',uuid:a.uuid+'.Item.spell'})},
{id:'casting',type:'spellcastingEntry',cast:()=>used.push('cast')},
{id:'feat',type:'feat',name:'Shield Block',img:'/portrait.svg',system:{category:'general'},toMessage:()=>used.push('feat')},
{id:'gear',type:'equipment',name:'Potion',img:'/portrait.svg',toMessage:()=>used.push('item')}]);return a}
globalThis.hero=actor('hero','Velkan Ukrim');globalThis.second=actor('second','Elric Tharion');globalThis.third=actor('third','Tyron');
globalThis.enemy=actor('enemy','Bandit Swordsman',false);globalThis.secret=actor('secret','Secret NPC',false);
const actors=collection([hero,second,third,enemy,secret]);
globalThis.synthetic=Object.assign(Object.create(hero),{uuid:'Scene.scene.Token.unlinked.Actor.hero',isToken:true});
const all=new Map([...actors,synthetic].map(a=>[a.uuid,a]));
globalThis.foundry={utils:{fromUuidSync:uuid=>all.get(uuid),mergeObject:(a,b)=>({...a,...structuredClone(b)})},applications:{api:{ApplicationV2:App}}};
globalThis.canvas={scene:{id:'scene',tokens:[{actor:synthetic}]}};
globalThis.CONFIG={Item:{typeLabels:{}}};globalThis.ui={notifications:{warn:()=>{},error:()=>{},info:()=>{}}};
globalThis.combat={started:true,combatant:null,scene:{id:'scene'},turns:[{id:'c1',actor:hero,actorId:hero.id,initiative:16,name:hero.name},{id:'c2',actor:enemy,actorId:enemy.id,initiative:15,name:enemy.name},{id:'c3',actor:secret,actorId:secret.id,hidden:true,name:secret.name}]};combat.combatant=combat.turns[0];
globalThis.game={ready:true,world:{id:'world'},user:{id:'gm',isGM:true},modules,system:{id:'pf2e'},actors,combat,
i18n:{localize:(k,data={})=>Object.entries(data).reduce((s,[a,b])=>s.replaceAll('{'+a+'}',b),k.split('.').reduce((a,p)=>a?.[p],translations)??k)},
settings:{register:(id,k,o)=>{registrations.set(id+'.'+k,o);if(!values.has(id+'.'+k))values.set(id+'.'+k,structuredClone(o.default))},registerMenu:(id,k,o)=>menus.set(k,o),get:(id,k)=>values.get(id+'.'+k),
set:async(id,k,v)=>{values.set(id+'.'+k,structuredClone(v));registrations.get(id+'.'+k)?.onChange?.(structuredClone(v));return v}}};
values.set('vnd-enhanced.vnData',{leftCast:[{id:'hero',img:'/portrait.svg'}],rightCast:[{id:'enemy',img:'/portrait.svg'}]});
</script><script type="module">await import('/scripts/main.js');await emit('init');await emit('ready');globalThis.loaded=true;</script></body></html>`;
const server = createServer(async(req,res)=>{
  try {
    const url = new URL(req.url,"http://localhost");
    if(url.pathname==="/"){res.setHeader("Content-Type","text/html");return res.end(html)}
    if(url.pathname.endsWith(".svg")){res.setHeader("Content-Type","image/svg+xml");return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300"><rect width="240" height="300" fill="#111b27"/><circle cx="120" cy="80" r="48" fill="#c7b38a"/><path d="M35 300V170Q120 100 205 170V300" fill="#4b637e"/></svg>')}
    const fontRoot = resolve(root, "../../../Foundry Virtual Tabletop/resources/app/public/fonts/fontawesome");
    const isFont = url.pathname.startsWith("/fontawesome/");
    const file = isFont ? resolve(fontRoot, "."+url.pathname.replace("/fontawesome", "")) : resolve(root,"."+url.pathname);
    if(!file.startsWith((isFont?fontRoot:root)+"\\")){res.writeHead(403);return res.end()}
    res.setHeader("Content-Type",{".js":"text/javascript",".css":"text/css",".woff2":"font/woff2"}[extname(file)]??"text/plain");res.end(await readFile(file));
  }catch{res.writeHead(404);res.end()}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on("pageerror",e=>{errors.push(e.message);console.error(e.message)});
try{
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>globalThis.loaded);
  assert.deepEqual(await page.evaluate(()=>licenseCalls),['velvet-party-hud']);
  assert.equal(await page.evaluate(()=>game.modules.get('velvet-party-hud').api.isLicensed()),false);
  await page.evaluate(()=>{covered=true;game.modules.get('velvet-party-hud').api.openLicense()});
  assert.equal(await page.evaluate(()=>game.modules.get('velvet-party-hud').api.isLicensed()),true);
  assert.equal(await page.evaluate(()=>used.at(-1)),'license-card');
  assert.equal(await page.locator('#vph-license-reminder').count(),0,'no duplicate hub reminder');
  assert.equal(await page.locator('#vph-players [data-uuid]').count(),3);
  assert.equal(await page.locator('#vph-npcs [data-uuid]').count(),2);
  assert.equal(await page.locator('.vne-side-panel').first().isVisible(),false);
  await page.locator('#vph-players .vph-card-open').first().click();
  assert.equal(await page.locator('#vph-menu button').count(),5,"exactly five quick actions");
  await page.locator('#vph-menu [data-cat="attacks"]').click();
  await page.locator('.vph-qa-map-btn[data-v="1"]').click();
  assert.equal(await page.evaluate(()=>used.at(-1)),"strike1");
  await page.locator('#vph-players .vph-card-open').first().click();
  await page.locator('#vph-menu [data-cat="spells"]').click();
  await page.locator('.vph-qa-entry').first().click();
  assert.equal(await page.evaluate(()=>used.at(-1)),"cast");
  for(const [cat,result] of [["feats","feat"],["items","item"],["sheet","sheet-hero"]]){
    await page.locator('#vph-players .vph-card-open').first().click();await page.locator(`#vph-menu [data-cat="${cat}"]`).click();
    if(cat!=="sheet")await page.locator('.vph-qa-entry').first().click();
    assert.equal(await page.evaluate(()=>used.at(-1)),result);
  }
  await page.locator('#vph-players .vph-fold').first().click();
  await page.locator('#vph-players .vph-card-collapsed').waitFor();
  assert.equal(await page.locator('#vph-players .vph-card-collapsed .vph-cast-plate').isVisible(),false);
  assert.equal(await page.locator('#vph-players .vph-card-collapsed .vph-cast-img').isVisible(),true);
  await page.locator('#vph-players .vph-fold').first().click();
  await page.waitForFunction(()=>!document.querySelector('#vph-players .vph-card-collapsed'));
  await page.locator('#vph-npcs [data-action="minimize"]').click();
  await page.locator('#vph-npcs.vph-minimized').waitFor();
  assert.equal(await page.locator('#vph-npcs .vph-list').isVisible(),false);
  await page.locator('#vph-npcs [data-action="minimize"]').click();
  await page.waitForFunction(()=>!document.querySelector('#vph-npcs.vph-minimized'));
  const start=await page.locator('#vph-players').boundingBox();
  const header=await page.locator('#vph-players .vph-panel-drag').boundingBox();
  await page.mouse.move(header.x+40,header.y+10);await page.mouse.down();await page.mouse.move(header.x+190,header.y+80,{steps:4});await page.mouse.up();
  await page.waitForFunction(()=>game.settings.get('velvet-party-hud','layout').players.x>100);
  const moved=await page.locator('#vph-players').boundingBox();assert.ok(moved.x>start.x+100&&moved.y>start.y+50,"panel dragged and saved");
  const grip=await page.locator('#vph-players .vph-resize').boundingBox();
  await page.mouse.move(grip.x+3,grip.y+40);await page.mouse.down();await page.mouse.move(grip.x+75,grip.y+40,{steps:3});await page.mouse.up();
  await page.waitForFunction(()=>game.settings.get('velvet-party-hud','layout').players.width>350);
  assert.ok((await page.locator('#vph-players').boundingBox()).width>350);
  await page.evaluate(()=>emit('updateActor',hero));
  await page.waitForTimeout(30);assert.ok((await page.locator('#vph-players').boundingBox()).x>100,"refresh preserves position");
  const row1=page.locator('#vph-players [data-uuid]').nth(0),row3=page.locator('#vph-players [data-uuid]').nth(2);
  const transfer=await page.evaluateHandle(()=>new DataTransfer());
  await row3.locator('.vph-order-handle').dispatchEvent('dragstart',{dataTransfer:transfer});
  await row1.dispatchEvent('drop',{dataTransfer:transfer});
  await page.waitForFunction(()=>document.querySelector('#vph-players [data-uuid]').dataset.uuid==='Actor.third');
  await page.evaluate(async()=>{hero.system.attributes.hp.value=12;await emit('updateActor',hero)});
  await page.waitForFunction(()=>[...document.querySelectorAll('#vph-players .vph-cp-hp-text')].some(e=>e.textContent.startsWith('12 /')));
  await page.evaluate(()=>game.modules.get('velvet-party-hud').api.openRoster());
  await page.locator('.vph-roster-editor select').selectOption('Scene.scene.Token.unlinked.Actor.hero');
  await page.locator('.vph-roster-editor [data-action="add"][data-side="npcs"]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#vph-npcs [data-uuid]')].some(e=>e.dataset.uuid.includes('Token.unlinked')));
  await page.locator('.vph-roster-editor [data-action="remove"][data-uuid="Scene.scene.Token.unlinked.Actor.hero"]').click();
  await page.waitForFunction(()=>![...document.querySelectorAll('#vph-npcs [data-uuid]')].some(e=>e.dataset.uuid.includes('Token.unlinked')));
  await page.evaluate(()=>{document.querySelector('.vph-roster-editor').remove();game.user.isGM=false;emit('updateUser',game.user)});
  await page.waitForFunction(()=>document.querySelectorAll('#vph-npcs [data-uuid]').length===1);
  assert.equal(await page.locator('#vph-npcs .vph-cp-hp-text').count(),0,"NPC numbers hidden from players");
  await page.locator('#vph-npcs .vph-card-open').click();
  assert.equal(await page.locator('#vph-menu button:disabled').count(),5,"non-owner cannot invoke NPC actions");
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{game.user.isGM=true;game.modules.get('velvet-party-hud').api.renderHUD()});
  await mkdir(join(root,'tests/artifacts'),{recursive:true});
  for(const theme of ['classic','darkest','eclipse']){
    await page.evaluate(theme=>game.settings.set('velvet-party-hud','theme',theme),theme);
    await page.locator(`#vph-players.vph-theme-${theme}`).waitFor();
    await page.screenshot({path:join(root,`tests/artifacts/${theme}.png`)});
  }
  await page.setViewportSize({width:500,height:600});await page.waitForTimeout(80);
  for(const side of ['players','npcs']){
    const box=await page.locator('#vph-'+side).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=500,"panel clamped on smaller screen");assert.ok(box.y+box.height<=600);
  }
  await page.evaluate(()=>game.settings.set('velvet-party-hud','enabled',false));
  await page.waitForFunction(()=>!document.getElementById('vph-players'));
  assert.equal(await page.locator('.vne-side-panel').first().isVisible(),true,"VND restored when HUD disabled");
  await page.clock.install();
  await page.evaluate(async()=>{game.modules.get('velvet-license-hub').active=false;const license=await import('/scripts/license.js');globalThis.license=license;license.initializeLicense();await game.settings.set('velvet-party-hud','enabled',true)});
  await page.clock.fastForward(8001);
  assert.equal(await page.locator('#vph-license-reminder').count(),1,'GM fallback reminder after eight seconds');
  assert.equal(await page.locator('#vph-players').isVisible(),true,'unlicensed HUD stays functional');
  assert.equal(await page.locator('#vph-license-reminder').getAttribute('role'),'status');
  await page.clock.fastForward(30001);
  assert.equal(await page.locator('#vph-license-reminder').count(),0,'fallback auto hides');
  await page.clock.fastForward(600000);
  assert.equal(await page.locator('#vph-license-reminder').count(),1,'fallback returns without blocking');
  await page.evaluate(()=>{license.stopReminder();game.user.isGM=false;license.initializeLicense();license.openLicense()});
  await page.clock.fastForward(600000);
  assert.equal(await page.locator('#vph-license-reminder').count(),0,'players never get GM fallback');
  await page.evaluate(()=>{game.user.isGM=true;game.modules.get('velvet-license-hub').active=true;license.initializeLicense()});
  assert.deepEqual(await page.evaluate(()=>licenseCalls),['velvet-party-hud'],'registration remains idempotent');
  assert.deepEqual(errors,[]);
  console.log('PASS: five actions, PF2e MAP/casting/feats/items/sheet, card/panel collapse, drag, resize, persistence, reorder, HP updates, synthetic roster, permissions, three themes, responsive bounds, VND integration.');
}catch(error){ console.error('Browser errors:',errors); throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
