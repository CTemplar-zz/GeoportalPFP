import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('seis fotos, cambio cada tres segundos y pausa al entrar al mapa',async({page})=>{
  await page.clock.install();await page.clock.pauseAt(new Date());
  await page.goto('/');await page.waitForFunction(()=>window.MobileUI);
  const photos=await page.evaluate(()=>MOBILE_WELCOME_PHOTOS);
  expect(photos).toHaveLength(6);
  const authors=['Albert Backer','Daniel Guzman Duchen','Javier Hurtado Vaca','Karen rek','Nevado Sajama','Pam JCB'];
  expect(await page.evaluate(()=>MOBILE_WELCOME_AUTHORS)).toEqual(authors);
  await expect(page.locator('#welcomeCredit')).toHaveText('Foto: '+authors[0]);
  const current=page.locator('.welcome-photo.is-active img');
  await expect(current).toHaveAttribute('src',photos[0]);
  await page.clock.runFor(2900);await expect(current).toHaveAttribute('src',photos[0]);
  await page.clock.runFor(100);await expect(current).toHaveAttribute('src',photos[1]);
  await expect(page.locator('#welcomeCredit')).toHaveText('Foto: '+authors[1]);
  await expect(page.locator('.welcome-photo:not(.is-active) img')).toHaveAttribute('src',photos[0]);
  await page.clock.runFor(800);
  await expect(page.locator('.welcome-photo:not(.is-active) img')).toHaveAttribute('src',photos[0]);
  await page.clock.runFor(50);
  for(let i=2;i<=6;i++){
    await page.waitForFunction(()=>[...document.querySelectorAll('.welcome-photo img')].every(img=>img.complete&&img.naturalWidth>0));
    await page.clock.runFor(3000);await expect(current).toHaveAttribute('src',photos[i%6]);
    await expect(page.locator('#welcomeCredit')).toHaveText('Foto: '+authors[i%6]);
  }
  await page.screenshot({path:'outputs/09-inicio-fotos-iphone.png'});
  await page.locator('#enterMap').click();await page.clock.runFor(9000);
  await expect(current).toHaveAttribute('src',photos[0]);
  await page.locator('[data-panel="more"]').click();await page.locator('#showWelcome').click();
  await expect(page.locator('#welcome')).toBeVisible();
  await page.clock.runFor(3000);await expect(current).toHaveAttribute('src',photos[1]);
});

test('filtro directo debajo de Leyenda actualiza selección y se puede limpiar',async({page})=>{
  await page.goto('/');await page.locator('#enterMap').click();
  const filter=page.getByRole('button',{name:'Filtrar áreas protegidas',exact:true});
  const legend=await page.locator('#legendOpen').boundingBox(),button=await filter.boundingBox();
  expect(button.y).toBeGreaterThan(legend.y+legend.height);expect(button.x).toBe(legend.x);
  await filter.click();await expect(page.locator('#sheetTitle')).toHaveText('Áreas protegidas');
  await page.locator('#apMobileSearch').fill('Madidi');
  await page.locator('#apMobileList [data-name="Madidi"]').click();
  await expect(filter).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>[...selectedAPs])).toEqual(['Madidi']);
  await page.locator('#clearFilters').click();await expect(filter).toHaveAttribute('aria-pressed','false');
  await page.locator('#sheetClose').click();
  await page.screenshot({path:'outputs/10-filtro-directo-iphone.png'});
  await page.locator('[data-panel="more"]').click();await expect(page.locator('#moreFilter')).toHaveCount(0);
});

test('fotos centradas a altura completa y textos visibles en teléfono y tableta',async({page})=>{
  for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:768,height:1024},{width:1180,height:820}]){
    await page.setViewportSize(size);await page.goto('/');
    await page.waitForFunction(()=>document.querySelector('.welcome-photo.is-active img').naturalWidth>0);
    const image=await page.locator('.welcome-photo.is-active img').boundingBox();
    expect(image.height).toBeCloseTo(size.height,0);
    expect(image.x+image.width/2).toBeCloseTo(size.width/2,0);
    const heading=page.locator('.welcome h1');
    await expect(heading).toHaveText('Una mirada a las áreas protegidas de Bolivia');
    const title=await heading.boundingBox(),brand=await page.locator('.welcome-top').boundingBox(),enter=await page.locator('#enterMap').boundingBox();
    const credit=await page.locator('#welcomeCredit').boundingBox(),footer=await page.locator('.welcome-copy>small').boundingBox();
    expect(credit.x+credit.width).toBeLessThanOrEqual(size.width);expect(credit.y+credit.height).toBeLessThanOrEqual(size.height);expect(credit.y).toBeGreaterThanOrEqual(footer.y+footer.height);
    expect(title.y).toBeGreaterThanOrEqual(0);expect(enter.y+enter.height).toBeLessThanOrEqual(size.height);
    expect(title.y>=brand.y+brand.height||title.x>=brand.x+brand.width).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    if(size.width===1180)await page.screenshot({path:'outputs/11-inicio-fotos-ipad.png'});
  }
});
