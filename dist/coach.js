'use strict';
const COACH_DURATION=7.985766302548825;
const coachOriginalCopy=[{"title":"AI 饮食计划","body":"热量识别\n科学减脂","enabled":true},{"title":"AI 智能搜课","body":"课程匹配\n开练不纠结","enabled":true},{"title":"AI 智能复盘","body":"每次训练都有迹\n可循复盘即进阶","enabled":false}];
let coachCards=coachOriginalCopy.map((text,i)=>({...text,name:`原始私教画面 ${i+1}`,src:`assets/coach-card-${i}.webp`,kind:'image',image:null,original:true}));
let coachBackdrop={src:'assets/coach-background.webp',name:'原工程背景',image:null,original:true};
let coachMotion=null,coachOriginalImages=[],coachOriginalBackdrop=null;
function coachDefaultSettings(){return {size:'1500,1766',duration:COACH_DURATION,scale:100,contentScale:100,background:'#fffcf6',stack:false};}
async function ensureCoach(){
  const [motion,images,backdrop]=await Promise.all([
    window.COACH_MOTION?Promise.resolve(window.COACH_MOTION):fetch('coach-motion.json').then(r=>{if(!r.ok)throw Error('私教动画参数加载失败。');return r.json();}),
    Promise.all([0,1,2].map(i=>imageFrom(`assets/coach-card-${i}.webp`))),imageFrom('assets/coach-background.webp')
  ]);
  coachMotion=motion;coachOriginalImages=images;coachOriginalBackdrop=backdrop;
  coachCards.forEach((c,i)=>{if(!c.image)c.image=images[i];});if(!coachBackdrop.image)coachBackdrop.image=backdrop;
}
function setupCoach(){renderCoach();}
function renderCoach(){
  const host=$('coachMaterials');if(!host)return;host.replaceChildren();
  const heading=document.createElement('div');heading.className='section-heading';const badge=document.createElement('span');badge.className='step';badge.textContent='03';const h=document.createElement('h2');h.textContent='替换私教素材';heading.append(badge,h);host.append(heading);
  const help=document.createElement('p');help.className='hint';help.textContent='保留 AE 原始横移、裁剪和文案透明度。三个画面支持图片或视频，底图可单独替换。';host.append(help);
  const grid=document.createElement('div');grid.className='flip-cards';grid.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px';host.append(grid);
  coachCards.forEach((card,i)=>{
    const wrap=document.createElement('div');wrap.className='flip-item';const button=document.createElement('button');button.className='pain-card';button.setAttribute('aria-label',`替换私教第 ${i+1} 张图片或视频`);
    const image=document.createElement('img');image.src=mediaPoster(card.image,card.src);image.alt=card.name;const cap=document.createElement('span');cap.textContent=`${i+1} · 替换图片 / 视频`;button.append(image,cap);wrap.append(button);
    const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp,video/mp4,video/webm';input.hidden=true;button.onclick=()=>{if(!exporting)input.click();};
    input.onchange=async()=>{const file=input.files[0];input.value='';if(!file||exporting)return;try{const media=await importMedia(file,3000);Object.assign(card,media,{name:file.name,original:false});renderCoach();invalidateVideo();draw(time);notice('私教画面已替换。');}catch(e){notice(e.message);}};wrap.append(input);
    for(const [key,label,max]of[['title','标题',36],['body','正文（最多两行）',60]]){const field=document.createElement('label');field.className='field';field.textContent=label;const box=document.createElement(key==='body'?'textarea':'input');box.value=card[key];box.maxLength=max;box.setAttribute('aria-label',`私教第 ${i+1} 组${label}`);if(key==='body')box.rows=2;box.oninput=()=>{if(exporting)return;card[key]=box.value;invalidateVideo();draw(time);};field.append(box);wrap.append(field);}
    const enable=document.createElement('label');enable.className='hint';const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=card.enabled;toggle.onchange=()=>{card.enabled=toggle.checked;invalidateVideo();draw(time);};enable.append(toggle,document.createTextNode(' 显示这组文案'));wrap.append(enable);
    const restore=document.createElement('button');restore.className='text-button';restore.textContent='恢复此组默认';restore.onclick=()=>{if(exporting)return;pauseTemplateMedia();Object.assign(card,coachOriginalCopy[i],{name:`原始私教画面 ${i+1}`,src:`assets/coach-card-${i}.webp`,image:coachOriginalImages[i],kind:'image',original:true});renderCoach();invalidateVideo();draw(time);};wrap.append(restore);grid.append(wrap);
  });
  const bg=document.createElement('div');bg.className='field';const label=document.createElement('strong');label.textContent='原工程底图';const preview=document.createElement('img');preview.src=coachBackdrop.src;preview.alt='私教底图预览';preview.style.cssText='width:100%;max-height:160px;object-fit:contain;border-radius:10px;background:#f5f3ef';
  const picker=document.createElement('input');picker.type='file';picker.accept='image/png,image/jpeg,image/webp';picker.hidden=true;const upload=document.createElement('button');upload.className='secondary';upload.textContent='替换底图';upload.onclick=()=>{if(!exporting)picker.click();};picker.onchange=async()=>{const file=picker.files[0];picker.value='';if(!file||exporting)return;try{const media=await importImage(file,3000);coachBackdrop={...media,name:file.name,original:false};renderCoach();invalidateVideo();draw(time);}catch(e){notice(e.message);}};
  const reset=document.createElement('button');reset.className='text-button';reset.textContent='恢复原工程底图';reset.onclick=()=>{if(exporting)return;coachBackdrop={src:'assets/coach-background.webp',name:'原工程背景',image:coachOriginalBackdrop,original:true};renderCoach();invalidateVideo();draw(time);};bg.append(label,preview,upload,reset,picker);host.append(bg);
}
function coachSample(samples,t){
  const pos=Math.max(0,Math.min(samples.length-1,t*(coachMotion.sampleRate||60))),a=Math.floor(pos),b=Math.min(a+1,samples.length-1),k=pos-a;
  if(Array.isArray(samples[a]))return samples[a].map((v,i)=>v+(samples[b][i]-v)*k);return samples[a]+(samples[b]-samples[a])*k;
}
function drawCoach(t){
  if(!coachMotion||!coachBackdrop.image)return;
  const at=Math.max(0,Math.min(COACH_DURATION-.00001,t/settings.duration*COACH_DURATION)),fit=Math.min(canvas.width/3000,canvas.height/3532);
  ctx.save();ctx.translate((canvas.width-3000*fit)/2,(canvas.height-3532*fit)/2);ctx.scale(fit,fit);ctx.beginPath();ctx.rect(0,0,3000,3532);ctx.clip();ctx.drawImage(coachBackdrop.image,0,0,3000,3532);
  const samples=coachMotion.samples;
  const sample=Array.isArray(samples)?coachSample(samples,at):[3943.412704,1990.125],px=Array.isArray(sample)?sample[0]:sample,py=Array.isArray(sample)?sample[1]:1990.125;
  ctx.save();ctx.beginPath();const clip=coachMotion.clip;ctx.roundRect(clip.center[0]-clip.size[0]/2,clip.center[1]-clip.size[1]/2,clip.size[0],clip.size[1],[{x:clip.radius[0],y:clip.radius[1]}]);ctx.clip();ctx.translate(px,py);ctx.scale(1.02,1.02);ctx.translate(-3000,-1540);
  const poses=[[997.5761245,1660.8888855,1000,734,2000,1468],[3004.2274612,1660.8888855,1001,734.5,2002,1469],[5011.029235,1660.8888855,1000,734,2000,1468]];
  coachCards.forEach((card,i)=>{const im=card.image;if(!im)return;const [x,y,ax,ay,w,h]=poses[i];if(card.original)ctx.drawImage(im,x-ax,y-ay,w,h);else{const iw=im.videoWidth||im.naturalWidth||im.width,ih=im.videoHeight||im.naturalHeight||im.height,z=Math.max(w/iw,h/ih),sw=w/z,sh=h/z;if(iw&&ih)ctx.drawImage(im,(iw-sw)/2,(ih-sh)/2,sw,sh,x-ax,y-ay,w,h);}});ctx.restore();
  coachCards.forEach((card,i)=>{if(!card.enabled)return;const alpha=sample[i+2]/100;
    const x=[1154.100525,1888.915833,2623.73114][i],y=i===2?2935.68602:3195.68602;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.scale(.33,.33);ctx.translate(-1500,-1540);
    const m=3.066221629375815;ctx.fillStyle='#212121';ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.letterSpacing=`${-.054*104*m}px`;ctx.font=`500 ${104*m}px "HarmonyOS Sans SC","Microsoft YaHei",sans-serif`;const tx=1437.427383-253.344009*m,ty=1174.167221+39.897003*m;coachFitText(card.title,tx,ty,2050);
    ctx.letterSpacing=`${-.054*72*m}px`;ctx.font=`${72*m}px "HarmonyOS Sans SC","Microsoft YaHei",sans-serif`;const bx=1083.127014-138.348007*m,by=1694.850616-15.34336*m;card.body.split(/\r?\n/).slice(0,2).forEach((line,j)=>coachFitText(line,bx,by+j*86*m,2050));ctx.restore();
  });ctx.restore();
}
function coachFitText(text,x,y,maxWidth){const width=ctx.measureText(text).width;ctx.save();if(width>maxWidth){const current=parseFloat(ctx.font.match(/[\d.]+px/)[0]);ctx.font=ctx.font.replace(/[\d.]+px/,`${current*maxWidth/width}px`);}ctx.fillText(text,x,y);ctx.restore();}
async function saveCoachProject(){
  if(coachCards.some(c=>!c.image)||!coachBackdrop.image)throw Error('请等待私教素材加载完成。');
  const cards=coachCards.map(c=>({title:c.title,body:c.body,enabled:c.enabled,name:c.name,kind:mediaKind(c.image),original:c.original===true,src:embeddedImage(c.image)}));
  const backdrop={src:embeddedImage(coachBackdrop.image),name:coachBackdrop.name,kind:'image',original:coachBackdrop.original===true};
  downloadBlob(new Blob([JSON.stringify({type:'private-coach',version:1,settings,cards,backdrop,backgroundImage:customBackground})],{type:'application/json'}),'私教模板.json');notice('私教模板已保存，包含图片、视频、文案和背景。');
}
async function openCoachProject(p){
  const s=p.settings,valid=c=>c&&validMediaSource(c)&&typeof c.name==='string'&&c.name.length<=200;
  if(p.version!==1||!s||!validFrameSettings(s)||!Number.isFinite(s.duration)||s.duration<3||s.duration>18||!/^#[0-9a-f]{6}$/i.test(s.background)||!Array.isArray(p.cards)||p.cards.length!==3||!p.cards.every(c=>valid(c)&&typeof c.title==='string'&&c.title.length<=36&&typeof c.body==='string'&&c.body.length<=60&&typeof c.enabled==='boolean')||!valid(p.backdrop)||!/^data:image\//.test(p.backdrop.src)||(p.backgroundImage!=null&&(!valid(p.backgroundImage)||!/^data:image\//.test(p.backgroundImage.src))))throw Error('私教模板参数或素材无效。');
  await ensureTemplateAssets('coach');const [cards,bg,backdrop]=await Promise.all([Promise.all(p.cards.map(async c=>({...c,image:await mediaFrom(c.src),original:c.original===true&&c.kind!=='video'}))),p.backgroundImage?imageFrom(p.backgroundImage.src):null,imageFrom(p.backdrop.src)]);
  switchTemplate('coach');coachCards=cards;coachBackdrop={...p.backdrop,image:backdrop};settings={...coachDefaultSettings(),...frameExtras(s),size:s.size,duration:s.duration,background:s.background};customBackground=p.backgroundImage||null;backgroundImage=bg;time=0;renderCoach();syncBackgroundUI();syncSettings();notice('私教模板已打开。');
}
