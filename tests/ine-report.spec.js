import { test,expect } from '@playwright/test';
test.use({serviceWorkers:'block'});

const pdf='%PDF-1.4\nINE regression fixture\n%%EOF';
async function selectUnit(page){
  await page.route('**/ine_comunidades_m8.geojson',route=>route.fulfill({json:{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[-64,-17]},properties:{COD_INE:'12345678901-D',TIPO_UNIDAD:'COMUNIDAD_RURAL',NOMBRE:'Comunidad de prueba'}}]}}));
  await page.route('**/ine_manzanas_m8.geojson',route=>route.fulfill({json:{type:'FeatureCollection',features:[]}}));
  await page.goto('/');await page.locator('#enterMap').click();
  await page.locator('[data-panel="layers"]').click();await page.locator('[data-catalog="8"]').click();
  await page.locator('#sheetClose').click();await page.locator('[data-panel="data"]').click();
  await page.getByRole('button',{name:'Datos puntuales',exact:true}).click();
  await expect(page.locator('#m8Rectangle')).toBeVisible();
  await page.evaluate(()=>map.setView([-17,-64],6,{animate:false}));
  await page.locator('#m8Rectangle').click();
  await page.locator('#map').tap({position:{x:100,y:250}});
  await page.locator('#map').tap({position:{x:290,y:600}});
  await page.locator('[data-panel="data"]').click();
  await expect(page.locator('#m8Report')).toBeEnabled();
}
async function respondPdf(page){
  await page.route('**/report',route=>{
    expect(route.request().postDataJSON()).toEqual({codigos:['12345678901-D']});
    return route.fulfill({contentType:'application/pdf',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'X-INE-Personas, X-INE-Viviendas','X-INE-Personas':'12','X-INE-Viviendas':'4'},body:pdf});
  });
}
test('ficha generada se descarga en el navegador',async({page})=>{
  await respondPdf(page);await selectUnit(page);
  const downloadEvent=page.waitForEvent('download');await page.locator('#m8Report').click();
  const download=await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^Ficha_INE_\d{4}-\d{2}-\d{2}\.pdf$/);
  const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe(pdf);
  await expect(page.locator('.m8-status.success')).toContainText('Ficha descargada · 12 personas · 4 viviendas');
});
test('app espera el guardado nativo del PDF sin volver a descargarlo',async({page})=>{
  await respondPdf(page);await selectUnit(page);
  await page.evaluate(()=>{window.savedReports=[];window.MobileNative={native:true,async saveBlob(blob,filename){window.savedReports.push({text:await blob.text(),type:blob.type,filename});await new Promise(resolve=>{window.finishSaving=resolve;});}};});
  await page.locator('#m8Report').click();
  await page.waitForFunction(()=>savedReports.length===1);
  await expect(page.locator('#m8Report')).toBeDisabled();
  expect(await page.evaluate(()=>savedReports[0])).toMatchObject({text:pdf,type:'application/pdf'});
  await page.evaluate(()=>finishSaving());
  await expect(page.locator('.m8-status.success')).toContainText('Ficha preparada para guardar o compartir');
  await expect(page.locator('#m8Report')).toBeEnabled();
});
test('error al guardar permite reintentar y no anuncia una descarga exitosa',async({page})=>{
  await respondPdf(page);await selectUnit(page);
  await page.evaluate(()=>{window.MobileNative={native:true,async saveBlob(){throw new Error('No se pudo guardar la ficha');}};});
  await page.locator('#m8Report').click();
  await expect(page.locator('.m8-status.error')).toHaveText('No se pudo guardar la ficha');
  await expect(page.locator('#m8Report')).toBeEnabled();
  await page.evaluate(()=>{window.MobileNative.saveBlob=async()=>{};});
  await page.locator('#m8Report').click();await expect(page.locator('.m8-status.success')).toContainText('Ficha preparada');
});
test('errores de texto del servicio se muestran sin consumir dos veces la respuesta',async({page})=>{
  await page.route('**/report',route=>route.fulfill({status:502,contentType:'text/plain',headers:{'Access-Control-Allow-Origin':'*'},body:'INE temporalmente no disponible'}));
  await selectUnit(page);await page.locator('#m8Report').click();
  await expect(page.locator('.m8-status.error')).toHaveText('INE temporalmente no disponible');
  await expect(page.locator('#m8Report')).toBeEnabled();
});
