/* Mobile interaction layer around the existing, source-controlled geoportal engine. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const paths={map:'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zM9 3v15M15 6v15',layers:'m12 3 10 5-10 5L2 8l10-5zM2 12l10 5 10-5M2 16l10 5 10-5',stack:'M4 4h13v13H4zM8 20h12V8',chart:'M4 20V4M4 20h16M9 16v-5M14 16V7M19 16V3',more:'M5 12h.01M12 12h.01M19 12h.01',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',locate:'M12 2v3M12 19v3M2 12h3M19 12h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0',extent:'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',basemap:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',legend:'M4 6h2M10 6h10M4 12h2M10 12h10M4 18h2M10 18h10',close:'m6 6 12 12M6 18 18 6',arrow:'M4 12h16m-6-6 6 6-6 6',back:'M20 12H4m6-6-6 6 6 6',chevron:'m9 5 7 7-7 7',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0zM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',bookmark:'M6 3h12v18l-6-4-6 4V3z',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',share:'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6M9 11l6-5M9 14l6 4',info:'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',check:'m5 12 4 4L20 5',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',filter:'M3 4h18l-7 8v7l-4 2v-9L3 4',offline:'M4 17h16M7 13h10M10 9h4M3 3l18 18',sun:'M12 3v2M12 19v2M3 12h2M19 12h2M6 6l1 1M17 17l1 1M6 18l1-1M17 7l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0'};
  const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.map}"/></svg>`;
  const esc=value=>escapeHTML(String(value??''));
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  const sheet=$('mobileSheet'),content=$('sheetContent'),backdrop=$('sheetBackdrop');
  const right=$('right'),legend=$('legend');
  const rightHome=document.createComment('right panel home'),legendHome=document.createComment('legend home');
  right.before(rightHome);legend.before(legendHome);
  let panel=null, catalogModule=null, openedGroups=new Set(), toastTimer, locationMarker, installPrompt=null, returnFocus=null;
  const visited=new Set(['1']);
  let layerOrder=[]; // First entry is the topmost thematic layer, regardless of module.
  const layerKey=({mod,layer})=>mod+':'+layer.id;
  const stackPane=map.createPane('mobile-layer-stack');
  stackPane.style.zIndex='390'; // Above basemaps; below drawing, location, tooltips and popups.
  const layerPanes=new Map(), owners=new WeakMap();
  function paneFor(key){
    if(!layerPanes.has(key)){
      const name='mobile-layer-'+layerPanes.size,pane=map.createPane(name,stackPane);
      pane.dataset.layerKey=key;
      layerPanes.set(key,{name,pane,renderer:null});
    }
    return layerPanes.get(key);
  }
  function adoptLayer(layer,key){
    if(!layer||owners.get(layer)===key)return;
    const entry=paneFor(key);
    owners.set(layer,key);
    L.setOptions(layer,{pane:entry.name});
    if(layer instanceof L.Path){
      entry.renderer??=L.svg({pane:entry.name});
      L.setOptions(layer,{renderer:entry.renderer});
    }
    if(layer instanceof L.Marker)L.setOptions(layer,{shadowPane:entry.name});
    if(layer instanceof L.LayerGroup){
      // Lazy GeoJSON and filters can add new children after the group is on the map.
      const add=layer.addLayer;
      layer.addLayer=function(child){adoptLayer(child,key);return add.call(this,child);};
      layer.eachLayer(child=>adoptLayer(child,key));
    }
  }
  function prepareLayer(layer,key){
    if(!layer||owners.get(layer)===key)return;
    const visible=map.hasLayer(layer);
    if(visible)map.removeLayer(layer);
    adoptLayer(layer,key);
    if(visible)layer.addTo(map);
  }
  const originalBuild=buildModuleLayer;
  buildModuleLayer=function(id,mod){
    const layer=originalBuild(id,mod),modId=Object.keys(MODULES).find(key=>MODULES[key]===mod);
    if(modId)prepareLayer(layer,modId+':'+id);
    return layer;
  };
  const storage={get(key,fallback){try{return JSON.parse(localStorage.getItem('pfp.mobile.'+key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('pfp.mobile.'+key,JSON.stringify(value));}catch{}}};
  const mobileBases=[
    {id:'streets',name:'Calles',detail:'OpenStreetMap',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',preview:'https://tile.openstreetmap.org/5/10/17.png',attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:19},
    {id:'satellite',name:'Satélite',detail:'Esri World Imagery',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',preview:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/17/10',attribution:'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community',maxZoom:19},
    {id:'topo',name:'Relieve',detail:'Esri World Topographic',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',preview:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/5/17/10',attribution:'Tiles © Esri — Sources: Esri, HERE, Garmin, USGS, Intermap, NGA, GIS User Community',maxZoom:19},
    {id:'none',name:'Solo capas',detail:'Sin mapa base · sin conexión',url:null,preview:null}
  ];
  let baseId=storage.get('base','streets');
  function toast(message){clearTimeout(toastTimer);$('mobileToast').textContent=message;$('mobileToast').hidden=false;toastTimer=setTimeout(()=>$('mobileToast').hidden=true,5500);}
  window.addEventListener('mobile:notice',event=>toast(event.detail));
  const drawBar=document.createElement('div');drawBar.className='mobile-draw-bar';drawBar.hidden=true;drawBar.innerHTML='<span></span><button id="finishDrawing">Terminar</button><button id="cancelDrawing" aria-label="Cancelar dibujo">'+icon('close')+'</button>';document.body.append(drawBar);
  $('finishDrawing').onclick=()=>window.mobileINEFinishDrawing?.();$('cancelDrawing').onclick=()=>window.mobileINECancelDrawing?.();
  window.addEventListener('mobile:draw',e=>{drawBar.hidden=!e.detail;if(e.detail){close();drawBar.querySelector('span').textContent=e.detail==='rectangle'?'Toca dos esquinas opuestas':'Toca los vértices del polígono';$('finishDrawing').hidden=e.detail==='rectangle';}});
  function selected(){
    const list=Object.entries(MODULES).flatMap(([mod,m])=>visited.has(mod)?m.layers.filter(l=>l.on).map(layer=>({mod,layer})):[]);
    for(const item of list)if(!layerOrder.includes(layerKey(item)))layerOrder.push(layerKey(item));
    return list.sort((a,b)=>layerOrder.indexOf(layerKey(a))-layerOrder.indexOf(layerKey(b)));
  }
  function applyStackOrder(){
    const list=selected();
    list.forEach((item,index)=>{
      const key=layerKey(item);
      prepareLayer(moduleLayers[key],key);
      paneFor(key).pane.style.zIndex=String(list.length-index);
    });
  }
  function moveLayer(key,direction){
    const visible=selected().map(layerKey),index=visible.indexOf(key),other=visible[index+direction];
    if(!other)return;
    const a=layerOrder.indexOf(key),b=layerOrder.indexOf(other);
    [layerOrder[a],layerOrder[b]]=[layerOrder[b],layerOrder[a]];
    applyStackOrder();renderActive();saveState();
    const row=[...content.querySelectorAll('.mobile-layer')].find(el=>el.dataset.module+':'+el.dataset.layer===key);
    const button=row?.querySelector(`[data-action="${direction<0?'up':'down'}"]`);
    (button?.disabled?row.querySelector('.layer-toggle'):button)?.focus({preventScroll:true});
    toast('Orden actualizado. Las capas superiores se dibujan encima.');
  }
  function saveState(){const layers=selected().map(({mod,layer})=>({mod,id:layer.id,opacity:layer.opacity}));storage.set('state',{module:currentModule,visited:[...visited],order:[...layerOrder],layers,center:[map.getCenter().lat,map.getCenter().lng],zoom:map.getZoom()});}
  function updateSelectionChip(){const title=$('rightTitle').textContent;$('selectionName').textContent=title;$('selectionChip').hidden=!(selectedAPs.size||currentAP||(currentModule==='8'&&title&&title!=='Datos INE'));}
  function refreshData(){
    const custom=window['renderM'+currentModule+'DataPanel'];
    if(typeof custom==='function')custom();else renderRightPanelKPIs(currentModule);
  }
  function refresh(){
    applyStackOrder();
    $('activeCount').textContent=selected().length;
    $('mobileModuleTitle').textContent=MODULES[currentModule]?.title||'Bolivia';
    updateSelectionChip();
    if(panel==='active')renderActive();
    if(panel==='layers'&&catalogModule)renderGroups();
  }
  // Retain visible layers from visited modules when changing the data context.
  const originalRender=renderModule;
  renderModule=function(id){
    visited.add(id);
    for(const [key,layer] of Object.entries(moduleLayers))prepareLayer(layer,key);
    originalRender(id);
    for(const {mod,layer} of selected()){
      if(mod===id)continue;
      const key=mod+':'+layer.id;
      if(!moduleLayers[key])moduleLayers[key]=buildModuleLayer(layer.id,MODULES[mod]);
      const obj=moduleLayers[key];if(obj&&!map.hasLayer(obj))obj.addTo(map);
    }
    refresh();
  };
  const originalStatus=updateStatusLayers;
  updateStatusLayers=function(){originalStatus();requestAnimationFrame(refresh);};
  // Mobile starts with a small spatial context. Selecting a catalog never enables layers implicitly.
  for(const [id,m] of Object.entries(MODULES))for(const layer of m.layers){
    if(id!=='1')layer.on=false;
    else layer.on=['apn','departamentos'].includes(layer.id);
    if(layer.locked)layer.on=true;
  }
  function restoreHomes(){if(right.parentElement===content)rightHome.after(right);if(legend.parentElement===content)legendHome.after(legend);}
  function close(){
    if(!panel)return false;
    restoreHomes();panel=null;sheet.hidden=true;backdrop.hidden=true;
    document.querySelectorAll('.mobile-nav button').forEach(b=>b.classList.toggle('selected',b.dataset.panel==='map'));
    returnFocus?.focus({preventScroll:true});returnFocus=null;map.invalidateSize();return true;
  }
  function open(type){
    returnFocus=document.activeElement;
    restoreHomes();panel=type;content.innerHTML='';sheet.hidden=false;backdrop.hidden=false;
    const titles={layers:'Capas del mapa',active:'Capas activas',data:'Datos del territorio',bases:'Elige tu mapa base',legend:'Leyenda del mapa',search:'Encuentra un lugar',more:'Tu exploración',filters:'Áreas protegidas',saved:'Vistas guardadas'};
    $('sheetTitle').textContent=titles[type]||'Geoportal PFP';
    $('sheetEyebrow').textContent=type==='data'?`M${currentModule} · ${MODULES[currentModule].title}`:'EXPLORA EL TERRITORIO';
    document.querySelectorAll('.mobile-nav button').forEach(b=>b.classList.toggle('selected',b.dataset.panel===type));
    ({layers:renderCatalog,active:renderActive,data:()=>{if(['5','7'].includes(currentModule))content.innerHTML='<div class="inline-note">Este módulo dispone de información cartográfica. Activa una capa y toca sus elementos en el mapa para consultar sus atributos. No tiene un panel de indicadores consolidados disponible.</div>';else content.append(right);},bases:renderBases,legend:()=>{legend.classList.remove('collapsed');content.append(legend);},search:renderSearch,more:renderMore,filters:renderFilters,saved:renderSaved}[type]||renderMore)();
    $('sheetClose').focus({preventScroll:true});
  }
  function renderCatalog(){
    catalogModule=null;
    content.innerHTML='<p class="panel-intro">Elige un módulo y despliega un grupo para activar sus capas. Las capas activas se conservan en el mapa.</p><div class="module-list">'+Object.entries(MODULES).map(([id,m])=>`<button class="module-card ${id===currentModule?'current':''}" data-catalog="${id}"><span class="module-symbol" style="color:${m.color}">${m.icon}</span><span class="module-copy"><span class="module-code">MÓDULO ${id.padStart(2,'0')}</span><strong>${esc(m.title)}</strong><small>${m.layers.length} capas · ${new Set(m.layers.map(l=>l.group)).size} grupos</small></span>${icon('chevron')}</button>`).join('')+'</div>';
    content.querySelectorAll('[data-catalog]').forEach(button=>button.onclick=()=>{
      catalogModule=button.dataset.catalog;openedGroups.clear();renderModule(catalogModule);renderGroups();saveState();
    });
  }
  function layerHTML(mod,layer,index=null,total=0){
    const ordering=index!==null;
    return `<div class="mobile-layer" data-layer="${esc(layer.id)}" data-module="${mod}">${ordering?`<div class="layer-stack-heading"><span class="active-module-label">${index+1} · M${mod} · ${esc(MODULES[mod].title)}</span><div class="layer-order"><button data-action="up" aria-label="Subir ${esc(layer.name)}" title="Subir capa" ${index===0?'disabled':''}>${icon('back')}</button><button data-action="down" aria-label="Bajar ${esc(layer.name)}" title="Bajar capa" ${index===total-1?'disabled':''}>${icon('arrow')}</button></div></div>`:''}<div class="layer-top"><button class="layer-toggle" role="switch" aria-checked="${!!layer.on}" aria-label="${esc(layer.name)}" ${layer.locked?'disabled':''}><span class="switch"></span><span>${esc(layer.name)}</span></button></div>${layer.on?`<div class="layer-options"><label>Transparencia <output>${Math.round(100-layer.opacity)}%</output><input type="range" min="0" max="100" value="${100-layer.opacity}" aria-label="Transparencia de ${esc(layer.name)}"></label><button data-action="zoom" aria-label="Ver extensión de ${esc(layer.name)}">${icon('extent')}</button><button data-action="info" aria-label="Información de ${esc(layer.name)}">${icon('info')}</button></div>`:''}</div>`;
  }
  function bindLayers(){content.querySelectorAll('.mobile-layer').forEach(row=>{
    const mod=row.dataset.module,id=row.dataset.layer,layer=MODULES[mod].layers.find(l=>l.id===id);
    row.querySelector('.layer-toggle').onclick=()=>{
      layer.on=!layer.on;const key=mod+':'+id;
      if(layer.on&&!layerOrder.includes(key))layerOrder.unshift(key);
      if(!moduleLayers[key])moduleLayers[key]=buildModuleLayer(id,MODULES[mod]);
      if(layer.on)moduleLayers[key].addTo(map);else map.removeLayer(moduleLayers[key]);
      if(mod===currentModule){renderLayerList(mod,MODULES[mod]);refreshData();renderMapLegend(mod);}
      refresh();saveState();
    };
    row.querySelector('input')?.addEventListener('input',event=>{
      const v=Number(event.target.value);layer.opacity=100-v;layer.transparency=v;row.querySelector('output').textContent=v+'%';
      applyLayerOpacity(id,moduleLayers[mod+':'+id],layer.opacity);saveState();
    });
    row.querySelector('[data-action="info"]')?.addEventListener('click',()=>openMetadata(layer));
    row.querySelector('[data-action="up"]')?.addEventListener('click',()=>moveLayer(mod+':'+id,-1));
    row.querySelector('[data-action="down"]')?.addEventListener('click',()=>moveLayer(mod+':'+id,1));
    row.querySelector('[data-action="zoom"]')?.addEventListener('click',async()=>{close();try{await zoomAndHighlightLayer(mod,layer);}catch{toast('La extensión estará disponible cuando termine de cargar la capa.');}});
  });}
  function renderGroups(){
    const m=MODULES[catalogModule];if(!m)return;
    const groups=[...new Set(m.layers.map(l=>l.group||'Otras capas'))];
    content.innerHTML=`<button class="back-link" id="catalogBack">${icon('back')} Todos los módulos</button><p class="panel-intro"><strong>${esc(m.title)}</strong><br>${esc(m.sub)}</p>`+groups.map(group=>{
      const list=m.layers.filter(l=>(l.group||'Otras capas')===group),expanded=openedGroups.has(group);
      return `<div class="group-card"><button class="group-button" data-group="${esc(group)}" aria-expanded="${expanded}"><span>${esc(group)}</span><small>${list.filter(l=>l.on).length}/${list.length}</small>${icon('chevron')}</button>${expanded?list.map(l=>layerHTML(catalogModule,l)).join(''):''}</div>`;
    }).join('');
    $('catalogBack').onclick=renderCatalog;
    content.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{const g=b.dataset.group;openedGroups.has(g)?openedGroups.delete(g):openedGroups.add(g);renderGroups();});bindLayers();
  }
  function renderActive(){
    const list=selected();
    content.innerHTML=`<p class="panel-intro">${list.length} capas visibles. Usa las flechas para subir o bajar cada capa: <strong>las primeras se dibujan encima</strong>, incluso entre módulos.</p>`;
    if(!list.length){content.innerHTML+=`<div class="empty-state">${icon('layers')}<br>No hay capas activas.<br>Abre Capas para explorar el catálogo.</div>`;return;}
    content.innerHTML+=`<div class="group-card active-stack">${list.map(({mod,layer},index)=>layerHTML(mod,layer,index,list.length)).join('')}</div>`;
    bindLayers();
  }
  function setBase(id){
    const base=mobileBases.find(b=>b.id===id)||mobileBases[0];baseId=base.id;
    if(activeTileLayer){map.removeLayer(activeTileLayer);activeTileLayer=null;}
    if(base.url){activeTileLayer=L.tileLayer(base.url,{maxZoom:base.maxZoom,attribution:base.attribution}).addTo(map);activeTileLayer.bringToBack();}
    storage.set('base',baseId);
  }
  function renderBases(){
    content.innerHTML='<p class="panel-intro">Un contexto distinto para cada exploración. Los mapas base necesitan conexión a internet.</p><div class="base-grid">'+mobileBases.map(base=>`<button class="base-card ${base.id===baseId?'selected':''}" data-base="${base.id}"><div class="base-preview base-empty">${base.preview?`<img src="${base.preview}" alt="" loading="lazy">`:''}${base.id===baseId?`<span class="base-check">${icon('check')}</span>`:''}</div><strong>${base.name}<small>${base.detail}</small></strong></button>`).join('')+'</div>';
    content.querySelectorAll('[data-base]').forEach(b=>b.onclick=()=>{setBase(b.dataset.base);close();});
  }
  function renderSearch(){
    content.innerHTML='<input id="mobileSearch" class="search-box" type="search" placeholder="Cuencas, especies, áreas protegidas…" aria-label="Buscar en el geoportal"><div id="mobileResults"></div>';
    function results(query){
      const key=normalizeSearchText(query),out=$('mobileResults');
      if(!key){out.innerHTML='<p class="inline-note">Busca entre las capas de los nueve módulos y las áreas protegidas de Bolivia.</p>';return;}
      const layers=allModuleLayerEntries().filter(e=>normalizeSearchText(layerSearchText(e)).includes(key)).slice(0,12);
      const aps=APN.filter(a=>normalizeSearchText(a.name).includes(key)).slice(0,8);
      out.innerHTML=(aps.length?'<div class="section-caption">Áreas protegidas</div>':'')+aps.map((a,i)=>`<button class="result-button" data-ap="${i}">${icon('pin')}<span>${esc(a.name)}<small>Ver mapa e indicadores</small></span>${icon('chevron')}</button>`).join('')+(layers.length?'<div class="section-caption">Capas del catálogo</div>':'')+layers.map((e,i)=>`<button class="result-button" data-result="${i}">${icon('layers')}<span>${esc(e.layer.name)}<small>${esc(e.mod?.title||MODULES[e.modId]?.title||'Capa')}</small></span>${icon('chevron')}</button>`).join('');
      if(!aps.length&&!layers.length)out.innerHTML='<div class="empty-state">No encontramos coincidencias.</div>';
      out.querySelectorAll('[data-ap]').forEach(b=>b.onclick=()=>{selectAP(aps[+b.dataset.ap]);close();refresh();});
      out.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>{const e=layers[+b.dataset.result];catalogModule=e.modId;openedGroups=new Set([e.layer.group||'Otras capas']);panel='layers';renderModule(e.modId);$('sheetTitle').textContent='Capas del mapa';renderGroups();});
    }
    $('mobileSearch').oninput=e=>results(e.target.value);results('');setTimeout(()=>$('mobileSearch')?.focus(),200);
  }
  function moreRow(id,name,detail,ico){return `<button class="more-row" id="${id}">${icon(ico)}<span class="label">${name}<small>${detail}</small></span>${icon('chevron')}</button>`;}
  function renderMore(){
    content.innerHTML=moreRow('moreFilter','Filtrar áreas protegidas','El filtro actualiza mapa e indicadores','filter')+moreRow('saveView','Guardar esta vista','Capas, ubicación y escala del mapa','bookmark')+moreRow('savedViews','Mis vistas guardadas',`${storage.get('views',[]).length} vistas disponibles`,'map')+moreRow('shareView','Compartir ubicación','Enviar la ubicación central del mapa','share')+moreRow('offlinePack','Preparar consulta sin conexión','Fichas de cuencas, indicadores y geometrías locales','download')+moreRow('installApp','Instalar aplicación','Añadir este geoportal a la pantalla de inicio','download')+moreRow('showWelcome','Acerca del geoportal','Una mirada viva a Bolivia','info')+'<div class="inline-note">Geoportal PFP · Bolivia<br>Datos del geoportal original. La cartografía y los indicadores conservan sus fuentes. Los servicios remotos y mapas base requieren conexión. La ilustración de bienvenida es conceptual.</div>';
    $('moreFilter').onclick=()=>open('filters');$('saveView').onclick=()=>{const views=storage.get('views',[]);saveState();views.unshift({name:$('rightTitle').textContent==='Bolivia'?MODULES[currentModule].title:$('rightTitle').textContent,date:new Date().toISOString(),state:storage.get('state',{})});storage.set('views',views.slice(0,30));toast('Vista guardada en este dispositivo.');renderMore();};
    $('savedViews').onclick=()=>open('saved');
    $('shareView').onclick=async()=>{const c=map.getCenter(),url=`https://www.openstreetmap.org/?mlat=${c.lat.toFixed(5)}&mlon=${c.lng.toFixed(5)}#map=${map.getZoom()}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}`;try{await window.MobileNative.share(url);toast('Ubicación lista para compartir.');}catch(e){if(e.name!=='AbortError')toast('No se pudo compartir la ubicación.');}};
    $('showWelcome').onclick=()=>{close();$('welcome').hidden=false;};
    $('offlinePack').onclick=downloadOffline;
    $('installApp').onclick=async()=>{if(window.MobileNative.native){toast('Ya estás usando la aplicación instalada.');return;}if(installPrompt){await installPrompt.prompt();installPrompt=null;}else toast('En iPhone: Safari → Compartir → Añadir a inicio. En Android: menú del navegador → Instalar aplicación.');};
  }
  async function downloadOffline(){
    const button=$('offlinePack');button.disabled=true;
    try{
      if(window.MobileNative.native){toast('Las fichas INE y las geometrías locales ya están incluidas en esta aplicación. Usa Solo capas cuando no tengas conexión.');return;}
      if(!('caches' in window)||!navigator.serviceWorker.controller)throw new Error('Espera a que termine de preparar la aplicación y vuelve a intentarlo.');
      const files=window.MOBILE_ASSETS.packaged.filter(a=>/fichas_cuenca\/|Datos_Poblacionales_Cuencas|ine_.*\.json$|cuencas_nivel3_ine|AreasProtegidas_Bolivia|Departamentos_Bolivia/.test(a.path));
      const cache=await caches.open(window.MOBILE_ASSETS.version+'-data');let n=0;
      for(const file of files){if(!await cache.match(file.path)){const response=await fetch(file.path);if(!response.ok)throw new Error('Una ficha no pudo descargarse. Puedes volver a intentarlo.');await cache.put(file.path,response);}n++;button.querySelector('small').textContent=`Guardando ${n} de ${files.length}`;}
      await navigator.storage?.persist?.();toast('Paquete INE disponible sin conexión. Los mapas base y servicios remotos siguen necesitando internet.');
    }catch(e){toast(e.message);}finally{button.disabled=false;}
  }
  function renderSaved(){
    const views=storage.get('views',[]);
    content.innerHTML=views.length?views.map((v,i)=>`<div class="favorite"><button class="result-button" data-view="${i}">${icon('bookmark')}<span>${esc(v.name)}<small>${new Date(v.date).toLocaleDateString('es-BO')} · ${v.state.layers?.length||0} capas</small></span></button><button class="round subtle" data-delete="${i}" aria-label="Eliminar vista ${esc(v.name)}">${icon('trash')}</button></div>`).join(''):'<div class="empty-state">Todavía no guardaste ninguna vista.<br>Encuentra un lugar y guárdalo desde Más.</div>';
    content.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{restoreState(views[+b.dataset.view].state);close();toast('Vista restaurada.');});
    content.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{views.splice(+b.dataset.delete,1);storage.set('views',views);renderSaved();});
  }
  function renderFilters(){
    content.innerHTML='<p class="panel-intro">Selecciona una o varias áreas para consultar sus indicadores.</p><input class="search-box" id="apMobileSearch" placeholder="Buscar área protegida…" aria-label="Buscar área protegida"><button class="back-link" id="clearFilters">Quitar filtro de áreas protegidas</button><div id="apMobileList"></div>';
    const draw=()=>{$('apMobileList').innerHTML=APN.filter(a=>normalizeSearchText(a.name).includes(normalizeSearchText($('apMobileSearch').value))).map(a=>`<button class="result-button" data-name="${esc(a.name)}" aria-pressed="${selectedAPs.has(a.name)}">${icon(selectedAPs.has(a.name)?'check':'pin')}<span>${esc(a.name)}</span></button>`).join('');$('apMobileList').querySelectorAll('button').forEach(b=>b.onclick=()=>{const names=new Set(selectedAPs);names.has(b.dataset.name)?names.delete(b.dataset.name):names.add(b.dataset.name);window.setProtectedAreaFilter?.([...names]);draw();refresh();});};
    $('apMobileSearch').oninput=draw;$('clearFilters').onclick=()=>{window.clearProtectedAreaFilter?.();draw();refresh();};draw();
  }
  function restoreState(state){
    Object.values(moduleLayers).forEach(l=>{if(map.hasLayer(l))map.removeLayer(l);});
    const savedOrder=Array.isArray(state.order)?state.order:(state.layers||[]).map(l=>l.mod+':'+l.id);
    layerOrder=[...new Set(savedOrder.filter(key=>typeof key==='string'&&Object.entries(MODULES).some(([mod,m])=>m.layers.some(l=>mod+':'+l.id===key))))];
    visited.clear();for(const mod of state.visited||['1'])if(MODULES[mod])visited.add(mod);
    for(const m of Object.values(MODULES))for(const l of m.layers)l.on=!!l.locked;
    for(const saved of state.layers||[]){const l=MODULES[saved.mod]?.layers.find(l=>l.id===saved.id);if(l){l.on=true;l.opacity=Number.isFinite(saved.opacity)?saved.opacity:100;visited.add(saved.mod);}}
    renderModule(MODULES[state.module]?state.module:'1');
    if(Array.isArray(state.center)&&state.center.every(Number.isFinite))map.setView(state.center,Number.isFinite(state.zoom)?state.zoom:5);
    refresh();saveState();
  }
  document.querySelectorAll('.mobile-nav button').forEach(b=>b.onclick=()=>b.dataset.panel==='map'?close():open(b.dataset.panel));
  $('sheetClose').onclick=close;backdrop.onclick=close;$('modulePill').onclick=()=>open('layers');$('baseOpen').onclick=()=>open('bases');$('legendOpen').onclick=()=>open('legend');$('searchOpen').onclick=()=>open('search');$('selectionData').onclick=()=>open('data');$('brandHome').onclick=()=>open('more');
  $('extent').onclick=()=>map.fitBounds([[-23.1,-69.8],[-9.5,-57.3]],{paddingTopLeft:[28,140],paddingBottomRight:[65,115]});
  $('locate').onclick=async()=>{
    const b=$('locate');b.disabled=true;
    try{const {coords}=await window.MobileNative.locate();if(locationMarker)map.removeLayer(locationMarker);locationMarker=L.circleMarker([coords.latitude,coords.longitude],{radius:8,color:'#fff',weight:3,fillColor:'#2774c4',fillOpacity:1}).addTo(map).bindPopup('Tu ubicación · precisión aproximada '+Math.round(coords.accuracy)+' m');map.setView([coords.latitude,coords.longitude],13);toast('Ubicación encontrada.');}
    catch{toast('No se pudo obtener tu ubicación. Habilita el permiso de ubicación y vuelve a intentarlo.');}finally{b.disabled=false;}
  };
  $('enterMap').onclick=()=>{$('welcome').hidden=true;storage.set('welcomed',true);map.invalidateSize();};
  $('welcome').hidden=storage.get('welcomed',false);
  const connectivity=()=>{$('offlineBadge').hidden=navigator.onLine;};window.addEventListener('online',connectivity);window.addEventListener('offline',()=>{connectivity();toast('Sin conexión. Puedes consultar los recursos guardados; los mapas base no estarán disponibles.');});connectivity();
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')close();
    if(e.key==='Tab'&&panel){const items=[...sheet.querySelectorAll('button:not(:disabled),a[href],input,select,[tabindex="0"]')].filter(e=>e.getClientRects().length),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  });
  let swipeStart=null;sheet.querySelector('.sheet-handle').addEventListener('touchstart',e=>swipeStart=e.touches[0].clientY,{passive:true});sheet.addEventListener('touchend',e=>{if(swipeStart!==null&&e.changedTouches[0].clientY-swipeStart>60)close();swipeStart=null;},{passive:true});
  // Use the native share sheet for PDFs/Excel; keep downloads functional in browsers too.
  document.addEventListener('click',async e=>{
    const a=e.target.closest('a[download]');if(!a||a.dataset.nativeHandled==='true')return;
    if(!window.MobileNative.native)return;
    e.preventDefault();e.stopPropagation();const url=window.mobileAssetURL(a.getAttribute('href'));let filename=a.download||decodeURIComponent(new URL(url,document.baseURI).pathname.split('/').pop());
    try{toast('Preparando archivo…');await window.MobileNative.download(url,filename);}catch(error){toast(error.message||'No se pudo guardar el archivo.');}
  },true);
  new MutationObserver(updateSelectionChip).observe($('rightTitle'),{childList:true,subtree:true,characterData:true});
  window.addEventListener('mobile:data',()=>{if(currentModule==='2'){renderM2Stats();renderM2Donut();}});
  map.on('moveend',saveState);
  window.addEventListener('resize',()=>map.invalidateSize());
  window.MobileUI={open,close,toast,getState:()=>({panel,currentModule,active:selected().map(x=>({module:x.mod,id:x.layer.id})),base:baseId})};
  const saved=storage.get('state',null);if(saved)restoreState(saved);else renderModule('1');setBase(baseId);
  if(!window.MobileNative.native&&'serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>toast('No se pudo preparar el modo sin conexión.'));
})();
