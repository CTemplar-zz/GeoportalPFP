// Runs only on the Codemagic Mac. Captures real iOS screens via XCTest.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const ipad = process.env.CAPTURE_DEVICE === 'ipad';
const size = ipad ? [2064, 2752] : [1284, 2778];
const folder = ipad ? 'iPad-13-2064x2752' : 'iPhone-65-1284x2778';
const root = path.resolve('build/ios/screenshots');
const result = path.join(root, 'Screenshots.xcresult');
const attachments = path.join(root, 'attachments');
const output = path.join(root, folder);
await fs.mkdir(root, { recursive: true });
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...options });
const runtimes = JSON.parse(run('xcrun', ['simctl', 'list', 'runtimes', '--json'], { stdio: 'pipe' })).runtimes;
const runtime = runtimes.filter(r => r.isAvailable && r.identifier.includes('.iOS-'))
  .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
if (!runtime) throw new Error('No installed iOS simulator runtime');
const device = run('xcrun', ['simctl', 'create', 'Geoportal-PFP-Capturas-65',
  ipad ? 'com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M4' : 'com.apple.CoreSimulator.SimDeviceType.iPhone-13-Pro-Max', runtime.identifier], { stdio: 'pipe' }).toString().trim();
await fs.writeFile(path.join(root, 'device.json'), JSON.stringify({ device, runtime, resolution: size }, null, 2));
console.log(`Capturing ${folder} on ${runtime.name}: ${device}`);
let failure;
try {
  run('xcrun', ['simctl', 'boot', device]);
  run('xcrun', ['simctl', 'bootstatus', device, '-b']);
  run('xcrun', ['simctl', 'status_bar', device, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--batteryState', 'charged', '--batteryLevel', '100']);
  run('xcodebuild', ['test', '-project', 'ios/App/App.xcodeproj', '-scheme', 'Screenshots',
    '-destination', `platform=iOS Simulator,id=${device}`, '-destination-timeout', '120',
    ...(ipad ? ['-only-testing:AppUITests/Screenshots/testAppStoreIPad'] : ['-only-testing:AppUITests/Screenshots/testAppStorePortrait']),
    '-configuration', 'Debug', '-derivedDataPath', path.join(root, 'DerivedData'),
    '-resultBundlePath', result, '-parallel-testing-enabled', 'NO',
    '-maximum-concurrent-test-simulator-destinations', '1',
    'CODE_SIGN_IDENTITY=', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGNING_ALLOWED=NO']);
} catch (error) { failure = error; }
try {
  const log = run('xcrun', ['simctl', 'spawn', device, 'log', 'show', '--last', '15m', '--style', 'compact', '--predicate', 'eventMessage CONTAINS "GeoportalDiagnostic" OR (process == "App" AND messageType == error)'], { stdio: 'pipe' });
  await fs.writeFile(path.join(root, 'native-startup.log'), log);
} catch (error) { console.warn('Native diagnostic log unavailable:', error.message); }
try {
  await fs.access(result);
  run('xcrun', ['xcresulttool', 'export', 'attachments', '--path', result, '--output-path', attachments]);
} catch (error) { failure ??= error; }
try { run('xcrun', ['simctl', 'shutdown', device]); } catch {}
if (failure) throw failure;

const expected = ipad ? ['08-ipad-mapa'] : ['01-mapa','02-modulos','03-grupos-capas','04-capas-activas','05-mapas-base','06-datos-cuenca','07-indicadores-cuenca'];
const files = [];
async function walk(dir) {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) await walk(full); else files.push(full);
  }
}
await walk(attachments);
const named = new Map();
for (const file of files.filter(f => f.endsWith('.png'))) {
  const name = expected.find(n => path.basename(file).includes(`PFP-${n}`));
  if (name) named.set(name, file);
}
// Xcode may use UUID filenames and store the human-readable name in manifest.json.
function indexManifest(node) {
  if (!node || typeof node !== 'object') return;
  const strings = Object.values(node).filter(v => typeof v === 'string');
  const name = expected.find(n => strings.some(s => s.includes(`PFP-${n}`)));
  const exported = strings.find(s => s.endsWith('.png'));
  if (name && exported) {
    const file = files.find(f => path.basename(f) === path.basename(exported));
    if (file) named.set(name, file);
  }
  Object.values(node).forEach(indexManifest);
}
for (const file of files.filter(f => f.endsWith('.json'))) indexManifest(JSON.parse(await fs.readFile(file, 'utf8')));
await fs.mkdir(output, { recursive: true });
const report = [];
for (const name of expected) {
  const file = named.get(name);
  if (!file) throw new Error(`Missing named XCTest screenshot PFP-${name}; inspect attachments manifest`);
  const metadata = await sharp(file).metadata();
  if (metadata.width !== size[0] || metadata.height !== size[1]) throw new Error(`Wrong native resolution for ${name}: ${metadata.width}x${metadata.height}`);
  // Lossless PNG, discard an unused alpha channel only; never resize or crop.
  await sharp(file).removeAlpha().png().toFile(path.join(output, `${name}.png`));
  report.push({ file: `${name}.png`, width: metadata.width, height: metadata.height, nativeScreenshot: true });
}
await fs.writeFile(path.join(output, 'resoluciones.json'), JSON.stringify(report, null, 2));
run('ditto', ['-c', '-k', '--keepParent', output, path.join(root, ipad ? 'Geoportal-PFP-Capturas-iPad-13.zip' : 'Geoportal-PFP-Capturas-iPhone-65.zip')]);
console.log(`Verified ${report.length} native screenshots at ${size.join("x")}; no resizing.`);
