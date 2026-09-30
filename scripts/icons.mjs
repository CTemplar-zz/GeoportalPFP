import sharp from 'sharp';
import fs from 'node:fs/promises';
const svg='resources/icon.svg';
for(const size of [192,512,1024])await sharp(svg).resize(size,size).png().toFile(`resources/icon-${size}.png`);
const android='android/app/src/main/res';
try{await fs.access(android);for(const [density,size] of Object.entries({mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192})){
  const dir=`${android}/mipmap-${density}`;await fs.mkdir(dir,{recursive:true});
  for(const name of ['ic_launcher','ic_launcher_round'])await sharp(svg).resize(size,size).png().toFile(`${dir}/${name}.png`);
  await sharp(svg).resize(Math.round(size*2.25),Math.round(size*2.25)).png().toFile(`${dir}/ic_launcher_foreground.png`);
}}catch{}
const iosIconDir='ios/App/App/Assets.xcassets/AppIcon.appiconset';
await fs.access(iosIconDir);
await sharp(svg).resize(1024,1024).flatten({background:'#123e35'}).removeAlpha().png().toFile(`${iosIconDir}/AppIcon-512@2x.png`);
const splash=async(width,height)=>{
  const size=Math.round(Math.min(width,height)*.28);
  const mark=await sharp(svg).resize(size,size).png().toBuffer();
  return sharp({create:{width,height,channels:4,background:'#123e35'}}).composite([{input:mark,gravity:'centre'}]).png().toBuffer();
};
try{for(const entry of await fs.readdir(android,{withFileTypes:true})){
  if(!entry.isDirectory()||!entry.name.startsWith('drawable'))continue;
  const file=`${android}/${entry.name}/splash.png`;
  try{const {width,height}=await sharp(file).metadata();await fs.writeFile(file,await splash(width,height));}catch{}
}}catch{}
try{const dir='ios/App/App/Assets.xcassets/Splash.imageset';await fs.access(dir);const buffer=await splash(2732,2732);for(const file of ['splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png'])await fs.writeFile(`${dir}/${file}`,buffer);}catch{}
console.log('Iconos PWA / Android / iOS generados.');
