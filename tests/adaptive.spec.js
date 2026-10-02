import {test,expect} from '@playwright/test';

const wideSizes=[{name:'ipad-vertical',width:768,height:1024},{name:'ipad-horizontal',width:1180,height:820},{name:'ipad-pro',width:1366,height:1024}];
for(const size of wideSizes){
  test(`${size.name}: mapa interactivo junto a capas y datos`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setViewportSize({width:size.width,height:size.height});
    await page.goto('/');await page.locator('#enterMap').click();
    await page.addStyleTag({content:':root{--safe-top:24px;--safe-bottom:20px;--safe-left:0px;--safe-right:0px}'});
    await expect(page.locator('#map')).toHaveJSProperty('clientWidth',size.width);
    await expect(page.locator('#map')).toHaveJSProperty('clientHeight',size.height);
    await page.locator('[data-panel="layers"]').click();
    await expect(page.locator('#mobileSheet')).toHaveAttribute('aria-modal','false');
    await expect(page.locator('#sheetBackdrop')).toBeHidden();
    const sheet=await page.locator('#mobileSheet').boundingBox(),nav=await page.locator('.mobile-nav').boundingBox();
    expect(sheet.width).toBeLessThanOrEqual(400);
    expect(sheet.y).toBeGreaterThanOrEqual(140+24);
    expect(sheet.y+sheet.height).toBeLessThan(nav.y);
    // Panning the exposed map must not dismiss the tablet panel.
    const center=await page.evaluate(()=>({lat:map.getCenter().lat,lng:map.getCenter().lng}));
    await page.mouse.move(size.width-180,size.height/2);
    await page.mouse.down();await page.mouse.move(size.width-270,size.height/2+50,{steps:10});await page.mouse.up();
    await expect.poll(()=>page.evaluate(()=>map.getCenter().lng)).not.toBe(center.lng);
    await expect(page.locator('#mobileSheet')).toBeVisible();
    await page.locator('[data-catalog="8"]').click();
    // Tablet navigation remains usable with a panel open.
    await page.locator('[data-panel="data"]').click();
    await page.getByRole('button',{name:'Por cuenca',exact:true}).click();
    await expect(page.getByRole('link',{name:'Descargar Excel'})).toBeVisible();
    // Keep full population totals on one line instead of splitting digits.
    const population=page.locator('.sheet-content .kpi .val').first();
    const metrics=await population.evaluate(el=>({height:el.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(el).lineHeight)}));
    expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight+1);
    await page.screenshot({path:`outputs/${size.name}-adaptado.png`,animations:'disabled'});
    await page.locator('#sheetClose').focus();await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(()=>document.activeElement.closest('#mobileSheet')===null)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(size.width);
    expect(errors).toEqual([]);
  });
}

test('panel abierto se adapta al rotar y pasar a Split View estrecho',async({page})=>{
  await page.setViewportSize({width:820,height:1180});await page.goto('/');await page.locator('#enterMap').click();
  await page.locator('[data-panel="layers"]').click();await page.locator('[data-catalog="8"]').click();
  for(const size of [{width:1180,height:820},{width:375,height:1024},{width:320,height:744},{width:820,height:1180}]){
    await page.setViewportSize(size);
    const wide=size.width>=700;
    await expect(page.locator('#mobileSheet')).toHaveAttribute('aria-modal',String(!wide));
    if(wide)await expect(page.locator('#sheetBackdrop')).toBeHidden();else await expect(page.locator('#sheetBackdrop')).toBeVisible();
    await expect(page.locator('.group-button')).toHaveCount(2);
    await expect.poll(()=>page.evaluate(()=>({width:map.getSize().x,height:map.getSize().y}))).toEqual(size);
    const sheet=await page.locator('#mobileSheet').boundingBox();
    expect(sheet.x).toBeGreaterThanOrEqual(0);expect(sheet.x+sheet.width).toBeLessThanOrEqual(size.width);
    expect(sheet.y).toBeGreaterThanOrEqual(0);expect(sheet.y+sheet.height).toBeLessThanOrEqual(size.height);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(size.width);
  }
});

test('iPhone horizontal: catálogo desplazable con panel y zonas seguras',async({page})=>{
  await page.setViewportSize({width:844,height:390});await page.goto('/');
  await page.locator('#enterMap').scrollIntoViewIfNeeded();await page.locator('#enterMap').click();
  await page.addStyleTag({content:':root{--safe-left:47px;--safe-right:47px;--safe-top:0px;--safe-bottom:21px}'});
  await page.locator('[data-panel="layers"]').click();
  await expect(page.locator('#mobileSheet')).toHaveAttribute('aria-modal','true');
  await page.locator('[data-catalog="9"]').click();
  await expect(page.locator('.group-button').first()).toBeVisible();
  const sheet=await page.locator('#mobileSheet').boundingBox();
  expect(sheet.x).toBeGreaterThanOrEqual(47);expect(sheet.y+sheet.height).toBeLessThanOrEqual(390-21);
  await page.screenshot({path:'outputs/iphone-horizontal-adaptado.png',animations:'disabled'});
});
