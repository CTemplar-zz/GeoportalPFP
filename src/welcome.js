(function(){
  const welcome=document.getElementById('welcome');
  const slides=[...welcome.querySelectorAll('.welcome-photo')];
  const photos=window.MOBILE_WELCOME_PHOTOS||[];
  const authors=window.MOBILE_WELCOME_AUTHORS||[];
  const credit=document.getElementById('welcomeCredit');
  const updateCredit=()=>{credit.textContent=authors[index]?`Foto: ${authors[index]}`:'';};
  let active=0,index=0,timer=null,preloadTimer=null,generation=0;
  function prepare(slide,url){
    const image=slide.querySelector('img');
    image.src=url;slide.style.setProperty('--welcome-photo',`url("${url}")`);
    return image.decode();
  }
  function stop(){generation++;clearTimeout(timer);clearTimeout(preloadTimer);timer=null;preloadTimer=null;}
  function schedule(){
    stop();
    if(welcome.hidden||document.hidden||photos.length<2)return;
    const token=generation,next=(index+1)%photos.length,target=1-active;
    // Keep the outgoing photo intact until its .8-second fade has finished.
    // Reuse that slot to preload the next photo without decoding the whole album.
    const ready=new Promise(resolve=>{preloadTimer=setTimeout(()=>{
      prepare(slides[target],photos[next]).then(()=>resolve(true),()=>resolve(false));
    },850);});
    timer=setTimeout(async()=>{
      const loaded=await ready;
      if(token!==generation||welcome.hidden||document.hidden)return;
      index=next;
      if(loaded){slides[active].classList.remove('is-active');slides[target].classList.add('is-active');active=target;updateCredit();}
      schedule();
    },3000);
  }
  window.MobileWelcome={show(visible){welcome.hidden=!visible;schedule();}};
  if(photos.length)prepare(slides[0],photos[0]).catch(()=>{});
  updateCredit();
  document.addEventListener('visibilitychange',schedule);
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',schedule);
})();
