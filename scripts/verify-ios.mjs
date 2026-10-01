import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFile(path.join(root,file),'utf8');
const config=JSON.parse(await read('capacitor.config.json'));
const nativeConfig=JSON.parse(await read('ios/App/App/capacitor.config.json'));
assert.equal(config.appId,nativeConfig.appId);
assert.equal(config.server?.url,undefined,'No se admite servidor de desarrollo en la entrega.');
assert.equal(nativeConfig.server?.url,undefined);
assert.equal(config.webDir,'www');
const project=await read('ios/App/App.xcodeproj/project.pbxproj');
// Debug + Release for the app and its separate screenshot UI-test runner.
assert.equal((project.match(/TARGETED_DEVICE_FAMILY = 1;/g)||[]).length,4);
assert.equal((project.match(/PRODUCT_BUNDLE_IDENTIFIER = org\.howwe\.geoportal\.uitests;/g)||[]).length,2);
assert.equal((project.match(/PRODUCT_BUNDLE_IDENTIFIER = org\.howwe\.geoportal;/g)||[]).length,2);
assert.equal((project.match(/MARKETING_VERSION = 1\.0;/g)||[]).length,2);
assert(project.includes('PrivacyInfo.xcprivacy in Resources'));
const info=await read('ios/App/App/Info.plist');
for(const key of ['NSLocationWhenInUseUsageDescription','NSLocationAlwaysAndWhenInUseUsageDescription','UIApplicationSceneManifest'])assert(info.includes(`<key>${key}</key>`));
assert(!info.includes('NSAllowsArbitraryLoads'),'No desactivar ATS globalmente.');
assert(!info.includes('UIBackgroundModes'),'No se solicita ubicación en segundo plano.');
const privacy=await read('ios/App/App/PrivacyInfo.xcprivacy');
assert(privacy.includes('NSPrivacyAccessedAPICategoryFileTimestamp')&&privacy.includes('C617.1'));
const swift=await read('ios/App/CapApp-SPM/Package.swift');
for(const [,relative] of swift.matchAll(/path: "([^"]+)"/g))await fs.access(path.resolve(root,'ios/App/CapApp-SPM',relative));
assert(!/[A-Z]:[\\/]/.test(swift),'No deben existir dependencias absolutas de Windows.');
const scheme=await read('ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme');
assert(scheme.includes('ArchiveAction buildConfiguration="Release"'));
const target=project.match(/([A-F0-9]{24}) \/\* App \*\/ = \{\s*isa = PBXNativeTarget;/)?.[1];
assert(target,'No se encontró el target App.');
for(const [,id] of scheme.matchAll(/BlueprintIdentifier="([^"]+)"/g))assert.equal(id,target,'El esquema debe referenciar el target nativo real.');
const icon=await sharp(path.join(root,'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')).metadata();
assert.equal(icon.width,1024);assert.equal(icon.height,1024);assert.equal(icon.hasAlpha,false);
async function compare(dir=''){
  let count=0;
  for(const entry of await fs.readdir(path.join(root,'www',dir),{withFileTypes:true})){
    const rel=path.join(dir,entry.name);
    if(entry.isDirectory()){count+=await compare(rel);continue;}
    const a=await fs.readFile(path.join(root,'www',rel)),b=await fs.readFile(path.join(root,'ios/App/App/public',rel));
    assert(a.equals(b),`Recurso desactualizado: ${rel}`);count++;
  }
  return count;
}
const files=await compare();
assert((await read('src/mobile.js')).includes('function moveLayer('));
console.log(`OK: proyecto iPhone, permisos, manifiesto, icono opaco 1024×1024, rutas SPM relativas, esquema Release y ${files} recursos sincronizados.`);
console.log('Comprobación estática; no sustituye la compilación con Xcode ni las pruebas en un iPhone real.');
