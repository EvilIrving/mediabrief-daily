import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const s = html.indexOf('const RAW=') + 'const RAW='.length;
const e = html.indexOf('];', s) + 1;
const RAW = JSON.parse(html.slice(s, e));
const SUF = src => (src === '财新' ? ['.txt', '.orig.txt'] : ['.txt', '.zh.txt', '.orig.txt']);
const jss = v => JSON.stringify(v).replace(/</g, '\\u003c');
function build({ lite }) {
  const raw2 = structuredClone(RAW);
  const entries = [];
  let missing = 0;
  for (const r of raw2) {
    const sufs = SUF(r.s);
    (r.n || []).forEach((sz, k) => {
      if (!sz || !sufs[k]) return;
      if (lite && sufs[k] === '.orig.txt') { r.n[k] = 0; return; }
      const rel = 'txt/' + r.i + sufs[k];
      const p = path.join(ROOT, rel);
      if (!fs.existsSync(p)) { r.n[k] = 0; missing++; return; }
      entries.push([rel, fs.readFileSync(p, 'utf8')]);
    });
  }
  const rawJs = 'const RAW=' + JSON.stringify(raw2) + ';';
  const textsJs = 'const TEXTS={' + entries.map(([k, v]) => jss(k) + ':' + jss(v)).join(',') + '};\n'
    + 'const TX=u=>Object.prototype.hasOwnProperty.call(TEXTS,u)?Promise.resolve(TEXTS[u]):fetch(u).then(r=>r.ok?r.text():Promise.reject());\n';
  let out = html.slice(0, html.indexOf('const RAW=')) + rawJs + html.slice(e);
  out = out.replace("if('serviceWorker' in navigator)addEventListener(", "if('serviceWorker' in navigator&&location.protocol!=='file:')addEventListener(");
  out = out.replace("fetch(u).then(r=>r.ok?r.text():Promise.reject())", 'TX(u)');
  out = out.replace("fetch(q.url).then(r=>r.ok&&r.text())", 'TX(q.url).catch(()=>null)');
  out = out.replace("try{const P=await import('https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.9/+esm');", "try{if(location.protocol==='file:')throw 0;const P=await import('https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.9/+esm');");
  out = out.replace(rawJs, () => rawJs + '\n' + textsJs);
  return { out, count: entries.length, missing, items: raw2.length };
}
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
for (const [name, opt] of [['mediabrief-standalone.html', { lite: false }], ['mediabrief-lite.html', { lite: true }]]) {
  const r = build(opt);
  const p = path.join(ROOT, 'dist', name);
  fs.writeFileSync(p, r.out);
  console.log(name, 'items=' + r.items, 'inlined=' + r.count, 'missing=' + r.missing, 'bytes=' + fs.statSync(p).size);
}
