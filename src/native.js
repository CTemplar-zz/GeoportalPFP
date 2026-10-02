import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
const native=Capacitor.isNativePlatform();
window.MobileNative={
  native,
  async locate(){return Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:18000,maximumAge:30000});},
  async download(url,filename){
    const response=await fetch(url);if(!response.ok)throw new Error('Archivo no disponible. Comprueba la conexión.');
    const blob=await response.blob();
    return window.MobileNative.saveBlob(blob,filename);
  },
  async saveBlob(blob,filename){
    if(!native){const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);return;}
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
    const saved=await Filesystem.writeFile({path:'fichas/'+filename.replace(/[^\p{L}\p{N}._ -]/gu,'_'),data:base64,directory:Directory.Cache,recursive:true});
    await Share.share({title:filename,files:[saved.uri],dialogTitle:'Guardar o compartir ficha'});
  },
  async share(url){if(native)return Share.share({title:'Geoportal PFP · Bolivia',url});if(navigator.share)return navigator.share({title:'Geoportal PFP · Bolivia',url});await navigator.clipboard.writeText(url);return 'copied';}
};
if(native){
  SplashScreen.hide().catch(()=>{});
  StatusBar.setStyle({style:Style.Dark}).catch(()=>{});
  App.addListener('backButton',()=>{if(window.MobileUI?.close())return;window.dispatchEvent(new CustomEvent('mobile:notice',{detail:'Usa el gesto de inicio para salir del Geoportal.'}));});
}
