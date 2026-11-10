// Behaviour tests for index.html, run in jsdom: `npm test` (or `node tests/site.test.js [manifest.json]`).
// The page is loaded twice: with manifest.json (normal operation) and with the manifest unavailable.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(process.argv[2] || path.join(root, 'manifest.json'), 'utf8'));
const BASE = 'https://projects.pawsey.org.au/phrogstructures-public/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) fails++; };

async function load(url, withManifest) {
  const alerts = [];
  const dom = new JSDOM(html, {
    url, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.alert = (m) => alerts.push(m);
      w.scrollTo = () => {};
      w.fetch = (u) => (withManifest && u === 'manifest.json'
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) })
        : Promise.resolve({ ok: false }));
    },
  });
  await sleep(100);
  return { w: dom.window, d: dom.window.document, alerts };
}
const go = async (w, hash) => { w.location.hash = hash; await sleep(50); };
const srcs = (d, sel) => [...d.querySelectorAll(sel)].map((i) => i.getAttribute('src'));

(async () => {
  const site = 'https://linsalrob.github.io/PHROG_structures_dev/';
  const { w, d, alerts } = await load(site, true);
  const inp = () => d.getElementById('phrogInput');
  ok(inp(), 'home renders search box');
  ok(d.getElementById('year').textContent === String(new Date().getFullYear()), 'footer year is current');

  // montages come from Acacia
  await go(w, '#/montages/oligomers');
  let s = srcs(d, '.montage-list img');
  ok(s.length === 389 && s[388] === `${BASE}oligomer_montage/phrog_388_montage.png`, `oligomer montages from Acacia (${s[388]})`);
  ok([...d.querySelectorAll('.montage-list img')].every((i) => i.getAttribute('loading') === 'lazy'), 'montages lazy');
  await go(w, '#/montages/monomers');
  ok(srcs(d, '.montage-list img')[0] === `${BASE}montage/phrog_000_montage.png`, 'monomer montage path');

  // group pages list only PHROGs in the manifest, thumbnails from Acacia
  await go(w, '#/dataset/monomers/phrog_001');
  s = srcs(d, '.grid img');
  ok(s.length === 100 && s[0] === `${BASE}thumbnails/phrog_001/phrog_00100.png`, `monomer group 001 has 100 thumbnails (${s.length})`);
  await go(w, '#/dataset/oligomers/phrog_000');
  const olig = [...d.querySelectorAll('.grid img')].map((i) => i.alt);
  ok(olig.length > 0 && olig.length < 100 && olig.includes('phrog_00006'), `oligomer group 000 lists only existing PHROGs (${olig.length})`);
  ok(d.querySelector('#app p').textContent.includes(`(${olig.length} of 100)`), 'group page states how many PHROGs it shows');
  ok(srcs(d, '.grid img').every((u) => u.startsWith(`${BASE}oligomer_thumbnails/phrog_000/`) || u === 'images/not_available.png'), 'oligomer thumbnails from Acacia');

  // viewer: image and PDB from Acacia
  await go(w, '#/dataset/oligomers/phrog_000/phrog_00006');
  ok(d.getElementById('fullImage').getAttribute('src') === `${BASE}oligomer_png/phrog_000/phrog_00006.png`, 'oligomer full image from Acacia');
  ok(d.getElementById('downloadLink').href === `${BASE}oligomer_pdb/phrog_000/phrog_00006.pdb.gz`, 'oligomer PDB from Acacia');
  await go(w, '#/dataset/monomers/phrog_005/phrog_00505');
  ok(d.getElementById('downloadLink').href === `${BASE}pdb/phrog_005/phrog_00505.pdb.gz`, 'monomer PDB from Acacia');
  ok(!/github(usercontent)?\.com/.test(d.getElementById('app').innerHTML), 'no GitHub-hosted asset URLs');

  // PHROG with a PDB but no image (oligomer 25222): message, download still offered
  await go(w, '#/dataset/oligomers/phrog_252/phrog_25222');
  ok(!d.getElementById('fullImage').getAttribute('src') && d.getElementById('errorMessage').style.display === 'block'
     && d.getElementById('downloadLink').style.display === 'inline', 'missing image: message shown, PDB download kept');
  // PHROG with no oligomer structure at all
  await go(w, '#/dataset/oligomers/phrog_000/phrog_00001');
  ok(d.getElementById('errorMessage').textContent === 'PHROG 1 has no oligomer structure.'
     && d.getElementById('downloadLink').style.display === 'none', 'no structure: message, no download link');
  await go(w, '#/montages/monomers');
  ok(d.getElementById('errorMessage').style.display === 'none', 'error cleared on navigation');

  // search, autocomplete, mode switch
  await go(w, '#/');
  const search = async (v, mode = 'monomers') => { inp().value = v; w.goToPhrog(mode); await sleep(50); return w.location.hash; };
  ok(await search('388') === '#/dataset/monomers/phrog_003/phrog_00388', 'search 388 opens PHROG 388');
  await go(w, '#/');
  for (const bad of ['0', '38881', 'abc']) await search(bad);
  ok(alerts.length === 3 && w.location.hash === '#/', 'invalid input alerts');
  const auto = (v) => { inp().value = v; w.phrogAutocomplete(inp()); return [...d.querySelectorAll('#autocomplete-list div')].map((e) => e.textContent); };
  ok(JSON.stringify(auto('3888')) === '["3888","38880"]', 'autocomplete');
  await go(w, '#/dataset/monomers/phrog_000/phrog_00006');
  d.querySelector('.mode-toggle button').click(); await sleep(50);
  ok(w.location.hash === '#/dataset/oligomers/phrog_000/phrog_00006', 'switch mode keeps PHROG');

  // hostile hashes never reach innerHTML
  for (const h of ['#/dataset/<img src=x onerror=alert(1)>/phrog_001', '#/montages/<img src=x>', '#/dataset/monomers/phrog_389']) {
    await go(w, h);
    ok(d.getElementById('app').innerHTML === '<p>Page not found</p>', `rejected ${h}`);
  }

  // without the manifest: every possible image is requested, failures fall back
  const f = await load(`${site}#/dataset/oligomers/phrog_000`, false);
  ok(f.d.querySelectorAll('.grid img').length === 100, 'no manifest: 100 tiles requested');
  await go(f.w, '#/dataset/oligomers/phrog_000/phrog_00001');
  ok(f.d.getElementById('fullImage').getAttribute('src') === `${BASE}oligomer_png/phrog_000/phrog_00001.png`, 'no manifest: image requested');
  f.d.getElementById('fullImage').onerror();
  ok(f.d.getElementById('errorMessage').style.display === 'block' && f.d.getElementById('linkWrapper').style.display === 'none',
     'no manifest: failed image hides links');

  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
