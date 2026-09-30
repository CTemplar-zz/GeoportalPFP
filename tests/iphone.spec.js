import {test,expect} from '@playwright/test';

test('iPhone compacto y horizontal con zonas seguras simuladas',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:375,height:667});
  await page.goto('/');await page.locator('#enterMap').click();
  // Desktop WebKit has no notch; model its insets for layout checks, not native validation.
  await page.addStyleTag({content:':root{--safe-top:47px;--safe-bottom:34px}'});
  const header=await page.locator('.mobile-header').boundingBox();expect(header.y).toBeGreaterThanOrEqual(47);
  const nav=await page.locator('.mobile-nav').boundingBox();expect(nav.y+nav.height).toBeLessThanOrEqual(667);
  await page.locator('[data-panel="active"]').click();
  await expect(page.locator('.layer-order button').first()).toBeVisible();
  const button=await page.locator('.layer-order button').first().boundingBox();expect(button.width).toBeGreaterThanOrEqual(44);expect(button.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({path:'outputs/iphone-compacto.png',animations:'disabled'});
  await page.locator('#sheetClose').click();
  await page.setViewportSize({width:844,height:390});
  await page.addStyleTag({content:':root{--safe-top:0px;--safe-bottom:21px;--safe-left:47px;--safe-right:47px}'});
  const landscapeHeader=await page.locator('.mobile-header').boundingBox();expect(landscapeHeader.x).toBeGreaterThanOrEqual(47);expect(landscapeHeader.x+landscapeHeader.width).toBeLessThanOrEqual(844-47);
  await page.locator('[data-panel="layers"]').click();await expect(page.locator('[data-catalog]')).toHaveCount(9);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(844);
  await page.screenshot({path:'outputs/iphone-horizontal.png',animations:'disabled'});
  const sheet=await page.locator('#mobileSheet').boundingBox();expect(sheet.x).toBeGreaterThanOrEqual(47);
  await page.locator('#sheetClose').click();
  await page.locator('[data-panel="more"]').click();await page.locator('#showWelcome').click();
  await page.locator('#enterMap').scrollIntoViewIfNeeded();await expect(page.locator('#enterMap')).toBeVisible();await page.locator('#enterMap').click();
  expect(errors).toEqual([]);
});
