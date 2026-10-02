import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'source');
const out = path.join(root, 'www');
// Remote GIS archives need not be committed just to discover their URLs.
const remoteManifest = JSON.parse(await fs.readFile(path.join(source, 'remote-assets.json'), 'utf8'));
const remote = remoteManifest.baseUrl;
await fs.mkdir(out, { recursive: true });
let html = (await fs.readFile(path.join(source, 'geoportal.html'), 'utf8')).replaceAll('\r\n', '\n');
function replaceOnce(from, to) {
  if (!html.includes(from)) throw new Error(`El geoportal cambió; revisar adaptación: ${from.slice(0, 100)}`);
  html = html.replace(from, to);
}
// Keep the validated geoportal renderer and its panels. Geometries are loaded only when enabled.
html = html.replace(/<script src="assets\/capas\/(?:geo_[^"/]+|Potenciales_M2\/geo_potenciales_m2)\.js"><\/script>/g, tag =>
  /geo_(limite|departamentos|apn|intersection|m4_intersection|ap_metrics_m2|deforestation_m3|burns_m3|landcover_m1)\.js/.test(tag) ? tag : '');
html = html.replace(/<link href="https:\/\/fonts.googleapis.com[^>]+>/, '');
replaceOnce('width=device-width,initial-scale=1', 'width=device-width,initial-scale=1,viewport-fit=cover');
replaceOnce('</head>', `<meta name="theme-color" content="#123e35"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="mobile/icon-192.png"><link rel="icon" href="mobile/icon.svg"><link rel="stylesheet" href="mobile/mobile.css"><link rel="stylesheet" href="mobile/welcome.css"><script src="mobile/runtime.js"></script></head>`);
replaceOnce('<body data-theme="light">', '<body data-theme="light" class="mobile-app">' + await fs.readFile(path.join(root, 'src/shell.html'), 'utf8'));
replaceOnce("let currentModule='2', currentAP=null;", "let currentModule='1', currentAP=null;");
replaceOnce("renderModule('2');", "renderModule('1');");
replaceOnce('setBasemap(savedBasemap);', '// El selector móvil inicializa el mapa base después de restaurar la vista.');
replaceOnce("for(const id of Object.keys(DATA_FILES)){", "for(const id of ['apn','limite','departamentos']){");
replaceOnce("if(DATA_FILES[id]&&geoData[id]) return createGeoJSONLayer(id,layerDef);", `if(DATA_FILES[id]&&geoData[id]) return createGeoJSONLayer(id,layerDef);
  if(DATA_FILES[id]) return createLazyGeoJSONLayer(id,{...layerDef,geojsonUrl:DATA_FILES[id]});
  if(layerDef.recordLayer) return createLazyGeoJSONLayer(id,{...layerDef,geojsonUrl:DATA_FILES.registros_peces_m2});`);
const fakeStart = html.indexOf('  // Capas simuladas para módulos 3-6');
const fakeEnd = html.indexOf("let currentModule='1'", fakeStart);
if (fakeStart < 0 || fakeEnd < 0) throw new Error('No se encontró el bloque de capas sin fuente');
html = html.slice(0, fakeStart) + `  const unavailable=L.layerGroup();
  unavailable.on('add',()=>window.dispatchEvent(new CustomEvent('mobile:notice',{detail:'Esta capa todavía no tiene una fuente cartográfica disponible.'})));
  return unavailable;
}
` + html.slice(fakeEnd);
// The source renderer supports retrying after connectivity returns.
replaceOnce("console.warn('No se pudo cargar capa GeoJSON:', layerDef.geojsonUrl, err);", "loading=null; window.dispatchEvent(new CustomEvent('mobile:notice',{detail:'No se pudo cargar '+(layerDef.name||id)+'. Comprueba la conexión y vuelve a activar la capa.'})); console.warn('No se pudo cargar capa GeoJSON:', layerDef.geojsonUrl, err);");
replaceOnce('geoData[id]=data;\n          loadedLayer', "geoData[id]=data;\n          if(layerDef.recordLayer) geoData.registros_peces_m2=data;\n          window.dispatchEvent(new CustomEvent('mobile:data',{detail:id}));\n          loadedLayer");
replaceOnce('</body>', '<script src="mobile/native.js"></script><script src="mobile/welcome.js"></script><script src="mobile/mobile.js"></script></body>');
await fs.mkdir(path.join(out, 'mobile'), { recursive: true });
await fs.cp(path.join(root, 'src/mobile.css'), path.join(out, 'mobile/mobile.css'));
await fs.cp(path.join(root, 'src/mobile.js'), path.join(out, 'mobile/mobile.js'));
await fs.cp(path.join(root, 'src/welcome.js'), path.join(out, 'mobile/welcome.js'));
await fs.cp(path.join(root, 'src/welcome.css'), path.join(out, 'mobile/welcome.css'));
await fs.cp(path.join(root, 'resources'), path.join(out, 'mobile'), { recursive: true });
await fs.copyFile(path.join(root, 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2'), path.join(out, 'mobile/inter-regular.woff2'));
await fs.copyFile(path.join(root, 'node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2'), path.join(out, 'mobile/inter-semibold.woff2'));
const remotes = [...new Set(remoteManifest.paths)];
const packaged = [];
async function copyAssets(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { await copyAssets(full); continue; }
    const rel = path.relative(source, full).replaceAll('\\', '/');
    const stat = await fs.stat(full);
    // GIS downloads and large tile archives stay on the existing portal. Census PDFs/Excel are bundled.
    const excluded = rel.endsWith('.zip') || rel.startsWith('assets/tiles/') || stat.size > 8 * 1024 * 1024;
    const unusedGeometryScript = /\/geo_[^/]+\.js$/.test(rel) && !html.includes(rel);
    if (unusedGeometryScript) continue;
    if (excluded) { if (!remotes.includes(rel)) remotes.push(rel); continue; }
    const dest = path.join(out, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(full, dest);
    packaged.push({ path: rel, bytes: stat.size });
  }
}
await copyAssets(path.join(source, 'assets'));
const remoteLookup = Object.fromEntries(remotes.map(rel => [rel, remote + rel]));
const welcomePhotoManifest=JSON.parse(await fs.readFile(path.join(root,'resources/welcome/photos.json'),'utf8'));
const welcomePhotos=welcomePhotoManifest.map(({file})=>'mobile/welcome/'+file);
const welcomeAuthors=welcomePhotoManifest.map(({source})=>path.parse(source).name);
const welcomePhotoHash=createHash('sha256').update(JSON.stringify(welcomeAuthors));for(const photo of welcomePhotos)welcomePhotoHash.update(await fs.readFile(path.join(out,photo)));
const welcomePhotoVersion=welcomePhotoHash.digest('hex');
const version='pfp-mobile-'+createHash('sha256').update(html).update(welcomePhotoVersion).update(await fs.readFile(path.join(root,'src/welcome.js'))).update(await fs.readFile(path.join(root,'src/welcome.css'))).update(await fs.readFile(path.join(root,'scripts/build.mjs'))).update(await fs.readFile(path.join(root,'src/mobile.js'))).update(await fs.readFile(path.join(root,'src/mobile.css'))).update(await fs.readFile(path.join(root,'src/native.js'))).update(JSON.stringify(packaged)).digest('hex').slice(0,12);
const runtime = `window.MOBILE_WELCOME_REVISION=${JSON.stringify(welcomePhotoVersion)};
window.MOBILE_WELCOME_PHOTOS=${JSON.stringify(welcomePhotos)};
window.MOBILE_WELCOME_AUTHORS=${JSON.stringify(welcomeAuthors)};
window.MOBILE_ASSETS=${JSON.stringify({ remote, remotes: remoteLookup, packaged, version })};
window.mobileAssetURL=function(value){const url=new URL(value,document.baseURI); const base=new URL('.',document.baseURI); const rel=decodeURI(url.pathname.slice(base.pathname.length)); return url.origin===base.origin&&window.MOBILE_ASSETS.remotes[rel]||value;};
const originalFetch=window.fetch.bind(window);window.fetch=(input,options)=>originalFetch(typeof input==='string'||input instanceof URL?window.mobileAssetURL(String(input)):input,options);
`;
await fs.writeFile(path.join(out, 'mobile/runtime.js'), runtime);
// Resolve PMTiles and download paths too (these bypass the fetch string adapter in libraries).
for (const rel of remotes) html = html.replaceAll(`'${rel}'`, `'${remoteLookup[rel]}'`).replaceAll(`"${rel}"`, `"${remoteLookup[rel]}"`);
await build({ entryPoints: [path.join(root, 'src/native.js')], outfile: path.join(out, 'mobile/native.js'), bundle: true, format: 'iife', target: ['safari15', 'chrome100'], minify: true });
await fs.writeFile(path.join(out, 'index.html'), html);
await fs.copyFile(path.join(root, 'src/manifest.webmanifest'), path.join(out, 'manifest.webmanifest'));
const shellFiles = ['index.html','manifest.webmanifest','mobile/mobile.css','mobile/mobile.js','mobile/welcome.js','mobile/welcome.css',...welcomePhotos,'mobile/native.js','mobile/runtime.js','mobile/icon.svg','mobile/icon-192.png','mobile/icon-512.png','mobile/inter-regular.woff2','mobile/inter-semibold.woff2', ...packaged.filter(a => /\.(js|css)$/.test(a.path) || /ine_.*\.(json|geojson)$|cuencas_nivel3_ine\.geojson$/.test(a.path)).map(a => a.path)];
try { await fs.access(path.join(out,'mobile/welcome.png')); shellFiles.push('mobile/welcome.png'); } catch {}
const sw = (await fs.readFile(path.join(root, 'src/sw.js'), 'utf8')).replace('__PRECACHE__', JSON.stringify(shellFiles)).replace('__VERSION__',version);
await fs.writeFile(path.join(out, 'sw.js'), sw);
await fs.writeFile(path.join(root, 'build-report.json'), JSON.stringify({ builtAt: new Date().toISOString(), packagedFiles: packaged.length, packagedMB: +(packaged.reduce((a,b)=>a+b.bytes,0)/1048576).toFixed(1), remoteFiles: remotes, source: 'source/geoportal.html', modules: 9 }, null, 2));
console.log(`Geoportal móvil listo: ${packaged.length} recursos locales; ${remotes.length} recursos remotos bajo demanda.`);
