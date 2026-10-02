import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=(await fs.readFile(new URL('../src/native.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
function bridge(writeFile,share){
  class FileReader{
    readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result='data:application/pdf;base64,'+Buffer.from(bytes).toString('base64');this.onload();}).catch(error=>this.onerror(error));}
  }
  const context={window:{},Capacitor:{isNativePlatform:()=>true},Filesystem:{writeFile},Share:{share},Directory:{Cache:'CACHE'},FileReader,Geolocation:{},SplashScreen:{hide:async()=>{}},StatusBar:{setStyle:async()=>{}},Style:{Dark:'DARK'},App:{addListener:()=>{}},fetch};
  vm.runInNewContext(source,context);
  return context.window.MobileNative;
}
test('guarda bytes del PDF en caché y comparte la URI nativa',async()=>{
  let written,shared;
  const native=bridge(async options=>{written=options;return {uri:'file:///cache/fichas/Ficha_INE.pdf'};},async options=>{shared=options;});
  await native.saveBlob(new Blob(['%PDF-1.4\nprueba']), '../Ficha:INE.pdf');
  assert.equal(Buffer.from(written.data,'base64').toString(),'%PDF-1.4\nprueba');
  assert.equal(written.directory,'CACHE');
  assert.equal(written.recursive,true);
  assert.equal(written.path,'fichas/.._Ficha_INE.pdf');
  assert.deepEqual(Array.from(shared.files),['file:///cache/fichas/Ficha_INE.pdf']);
});
test('un error de escritura no abre compartir y se propaga al panel',async()=>{
  let shared=false;
  const native=bridge(async()=>{throw Error('Sin espacio');},async()=>{shared=true;});
  await assert.rejects(native.saveBlob(new Blob(['%PDF']), 'INE.pdf'),/Sin espacio/);
  assert.equal(shared,false);
});
test('un error del sistema al compartir se propaga al panel',async()=>{
  const native=bridge(async()=>({uri:'file:///cache/INE.pdf'}),async()=>{throw Error('No se pudo compartir');});
  await assert.rejects(native.saveBlob(new Blob(['%PDF']), 'INE.pdf'),/No se pudo compartir/);
});
