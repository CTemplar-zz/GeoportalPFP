import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../src/index.js';

const config=JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const origins=['https://ctemplar-zz.github.io','https://localhost','http://localhost','capacitor://localhost'];
for(const env of [{},config.vars])for(const origin of origins){
  test(`CORS y validación desde ${origin} (${env.ALLOWED_ORIGINS?'despliegue':'valores predeterminados'})`,async()=>{
    const preflight=await worker.fetch(new Request('https://worker.test/report',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Content-Type'}}),env);
    assert.equal(preflight.status,204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
    for(const path of ['/report','/validate']){
      const response=await worker.fetch(new Request(`https://worker.test${path}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({codigos:[]})}),env);
      assert.equal(response.status,400);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
      assert.equal((await response.json()).error,'INVALID_REQUEST');
    }
  });
}
test('un origen externo sigue sin autorización',async()=>{
  const response=await worker.fetch(new Request('https://worker.test/report',{method:'POST',headers:{Origin:'https://untrusted.example'},body:'{}'}),config.vars);
  assert.equal(response.status,403);
  assert.notEqual(response.headers.get('Access-Control-Allow-Origin'),'https://untrusted.example');
});
test('PDF y totales disponibles para la app; sesión INE cerrada',async(t)=>{
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url)=>{
    calls.push(url);
    if(url.endsWith('/registroSesion'))return Response.json({session_token:'test-session'});
    if(url.endsWith('/verificar-validar'))return Response.json({validado:true,cantidad_personas:12,cantidad_viviendas:4});
    if(url.endsWith('/generar-pdf'))return new Response('%PDF-1.4\nTEST');
    return Response.json({ok:true});
  });
  const response=await worker.fetch(new Request('https://worker.test/report',{method:'POST',headers:{Origin:'capacitor://localhost','Content-Type':'application/json'},body:JSON.stringify({codigos:['12345678901-D']})}),config.vars);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Content-Type'),'application/pdf');
  assert.equal(response.headers.get('X-INE-Personas'),'12');
  assert.match(response.headers.get('Access-Control-Expose-Headers'),/X-INE-Personas/);
  assert.match(await response.text(),/^%PDF/);
  assert.ok(calls.at(-1).endsWith('/salidaSesion'));
});
