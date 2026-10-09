'use strict';
const $ = id => document.getElementById(id);
const canvas = $('preview'), ctx = canvas.getContext('2d');
const names = ['新手指导','减脂减重','塑形训练','舒缓放松','能力提升','知识分享'];
let cards = names.map((title,i)=>({title,src:`assets/card-${i}.png`,image:null,original:true}));
let settings = {size:'1176,1144',duration:6,scale:100,background:'#f2f2f2',stack:true};
let time = 0, playing = false, last = 0, exporting = false, selected = 0, dragged = null, videoURL = null, cancelRecording = null;
const supportedMime = typeof MediaRecorder === 'undefined' ? '' : ['video/mp4;codecs=avc1.42001E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m)) || '';
const extension = supportedMime.startsWith('video/mp4') ? 'mp4' : 'webm';
let previewZoom = 'fit', previewFactor = 1;
const zoomSteps = [10,25,50,75,100,150,200,300,400];
function updatePreviewZoom(){
  const viewport=$('previewViewport'),stage=$('previewStage');
  if(!viewport.clientWidth||!viewport.clientHeight)return;
  previewFactor=previewZoom==='fit'?Math.min((viewport.clientWidth-4)/canvas.width,(viewport.clientHeight-4)/canvas.height):Number(previewZoom)/100;
  const width=Math.round(canvas.width*previewFactor),height=Math.round(canvas.height*previewFactor);
  canvas.style.width=width+'px';canvas.style.height=height+'px';
  stage.style.width=Math.max(width,viewport.clientWidth)+'px';stage.style.height=Math.max(height,viewport.clientHeight)+'px';
  viewport.scrollLeft=(viewport.scrollWidth-viewport.clientWidth)/2;viewport.scrollTop=(viewport.scrollHeight-viewport.clientHeight)/2;
  viewport.classList.toggle('pannable',width>viewport.clientWidth||height>viewport.clientHeight);
  $('previewZoom').value=previewZoom;$('zoomOut').disabled=previewFactor<=.1001;$('zoomIn').disabled=previewFactor>=3.999;
  $('previewZoom').options[0].textContent=previewZoom==='fit'?`适合窗口 (${Math.round(previewFactor*100)}%)`:'适合窗口';
}
function stepPreviewZoom(direction){
  const percent=previewFactor*100;
  previewZoom=String(direction>0?(zoomSteps.find(v=>v>percent+.1)||400):([...zoomSteps].reverse().find(v=>v<percent-.1)||10));updatePreviewZoom();
}
$('previewZoom').onchange=e=>{previewZoom=e.target.value;updatePreviewZoom();};
$('zoomOut').onclick=()=>stepPreviewZoom(-1);$('zoomIn').onclick=()=>stepPreviewZoom(1);
new ResizeObserver(updatePreviewZoom).observe($('previewViewport'));
let pan=null;
$('previewViewport').addEventListener('pointerdown',e=>{
  const viewport=e.currentTarget;if(e.button!==0||e.pointerType==='touch'||!viewport.classList.contains('pannable'))return;
  pan={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');e.preventDefault();
});
$('previewViewport').addEventListener('pointermove',e=>{if(!pan)return;const viewport=e.currentTarget;viewport.scrollLeft=pan.left+pan.x-e.clientX;viewport.scrollTop=pan.top+pan.y-e.clientY;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('previewViewport').addEventListener(event,e=>{pan=null;e.currentTarget.classList.remove('dragging');});
function notice(text){ $('notice').textContent=text; }
function invalidateVideo(){if(videoURL){URL.revokeObjectURL(videoURL);videoURL=null;$('download').hidden=true;notice('画面已修改，请重新导出视频。');}}
function imageFrom(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('图片无法读取，请换一张 PNG、JPG 或 WebP 图片。'));i.src=src;});}
function readFile(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('文件读取失败，请重新选择。'));r.readAsDataURL(file);});}
async function importImage(file,maxEdge=1600){
  if(!file || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPG 或 WebP 图片。');
  if(file.size>20*1024*1024) throw new Error('单张图片请控制在 20 MB 以内。');
  const raw=await readFile(file), image=await imageFrom(raw);
  if(image.width*image.height>50000000) throw new Error('图片像素过大，请缩小后再试。');
  const resize=Math.min(1,maxEdge/Math.max(image.width,image.height));
  const c=document.createElement('canvas');c.width=Math.round(image.width*resize);c.height=Math.round(image.height*resize);c.getContext('2d').drawImage(image,0,0,c.width,c.height);
  const src=c.toDataURL('image/png');return {src,image:await imageFrom(src),original:false};
}
function renderCards(){
  $('cards').replaceChildren();
  cards.forEach((card,i)=>{
    const el=document.createElement('div');el.className='card';
    const number=document.createElement('span');number.className='card-number';number.textContent=String(i+1).padStart(2,'0');number.draggable=true;number.title='拖动调整顺序';
    number.addEventListener('dragstart',e=>{dragged=i;e.dataTransfer.setData('text/plain',String(i));el.classList.add('dragging');});
    number.addEventListener('dragend',()=>{dragged=null;document.querySelectorAll('.card').forEach(x=>x.classList.remove('dragging','drop'));});
    el.addEventListener('dragover',e=>{if(dragged!==null){e.preventDefault();el.classList.add('drop');}});el.addEventListener('dragleave',()=>el.classList.remove('drop'));
    el.addEventListener('drop',e=>{e.preventDefault();if(dragged!==null)moveCard(dragged,i);dragged=null;});
    const btn=document.createElement('button');btn.className='card-image';btn.setAttribute('aria-label',`替换第 ${i+1} 张：${card.title}`);
    const img=document.createElement('img');img.src=card.src;img.alt=card.title;
    const text=document.createElement('span');text.className='replace';text.textContent='替换图片';btn.append(img,text);btn.onclick=()=>{selected=i;$('imageInput').click();};
    const input=document.createElement('input');input.value=card.title;input.maxLength=24;input.setAttribute('aria-label',`第 ${i+1} 张分类标题`);input.oninput=()=>{card.title=input.value;invalidateVideo();draw(time);};
    const order=document.createElement('div');order.className='card-order';
    [['前移',-1],['后移',1]].forEach(([label,delta])=>{const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',`第 ${i+1} 张${label}`);b.disabled=i+delta<0||i+delta>=cards.length;b.onclick=()=>moveCard(i,i+delta);order.append(b);});
    el.append(number,btn,input,order);$('cards').append(el);
  });
}
function moveCard(from,to){if(exporting)return;invalidateVideo();const [c]=cards.splice(from,1);cards.splice(to,0,c);renderCards();draw(time);}
const motion = window.AE_MOTION;
const compMap = new Map(motion.comps.map(c=>[c.id,c]));
let labelImages = [], stackImage = null, defaultStackImage = null, customStack = null;
function syncStackUI(){
  $('stackPreview').src=stackImage.src;
  $('stackName').textContent=customStack?customStack.name:'默认拖尾';
  $('resetStack').disabled=!customStack;
}
async function importStack(file){
  if(!file || (file.type!=='image/png' && !/\.png$/i.test(file.name)))throw new Error('拖尾请选择 PNG 图片。');
  if(file.size>20*1024*1024)throw new Error('拖尾 PNG 请控制在 20 MB 以内。');
  const signature=new Uint8Array(await file.slice(0,8).arrayBuffer());
  if([137,80,78,71,13,10,26,10].some((v,i)=>signature[i]!==v))throw new Error('文件不是有效的 PNG 图片。');
  const imported=await importImage(new File([file],file.name,{type:'image/png'}));
  return {src:imported.src,image:imported.image,name:file.name.slice(0,200)};
}
$('uploadStack').onclick=()=>$('stackInput').click();
$('stackInput').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file||exporting)return;
  try{const ready=await importStack(file);if(exporting)return;customStack={src:ready.src,name:ready.name};stackImage=ready.image;settings.stack=true;syncStackUI();syncSettings();notice('拖尾已替换，预览和导出将使用这张 PNG。');}catch(e){notice(e.message);}
};
$('resetStack').onclick=()=>{if(exporting)return;customStack=null;stackImage=defaultStackImage;syncStackUI();invalidateVideo();draw(time);notice('已恢复默认拖尾。');};
let backgroundImage=null, customBackground=null;
function syncBackgroundUI(){
  $('backgroundPreview').hidden=!customBackground;
  if(customBackground)$('backgroundPreview').src=customBackground.src;
  else $('backgroundPreview').removeAttribute('src');
  $('backgroundName').textContent=customBackground?customBackground.name:(activeTemplate==='smart'&&settings.originalBackground!==false?'当前使用原工程渐变背景':'当前使用纯色背景');
  $('clearBackground').disabled=!customBackground;
}
$('uploadBackground').onclick=()=>$('backgroundInput').click();
$('backgroundInput').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file||exporting)return;
  try{const ready=await importImage(file,4096);if(exporting)return;customBackground={src:ready.src,name:file.name.slice(0,200)};backgroundImage=ready.image;syncBackgroundUI();invalidateVideo();draw(time);notice('背景图片已替换，将用于预览和视频导出。');}catch(e){notice(e.message);}
};
$('clearBackground').onclick=()=>{if(exporting)return;customBackground=null;backgroundImage=null;if(activeTemplate==='smart')settings.originalBackground=false;syncBackgroundUI();invalidateVideo();draw(time);notice('已恢复纯色背景。');};
let activeTemplate='cards', longImage=null, defaultLongImage=null, longSource='assets/plain-long.png', longName='AE 原始长图';

const painNames=['单薄易晃','安装劝退','功能单一','木杆毛刺割手'];
let painCards=painNames.map((name,i)=>({name,src:`assets/pain-${i}.png`,image:null,textSlot:i})),painDefaults=[],painTexts=[],painIcons=null,painSelected=0,painKeepText=true;
function renderPain(){
 $('painCards').replaceChildren();$('painText').checked=painKeepText;$('painCount').textContent=`${painCards.length} 个画面 · ${painCards.length} 个进度标记`;$('addPain').disabled=painCards.length>=12;
 painCards.forEach((card,i)=>{
  const wrap=document.createElement('div');wrap.className='pain-item';const b=document.createElement('button');b.className='pain-card';b.setAttribute('aria-label',`替换痛点第 ${i+1} 屏`);const im=document.createElement('img');im.src=card.src;im.alt=card.name;const label=document.createElement('span');label.textContent=`${i+1}. ${card.textSlot==null?'自定义画面':painNames[card.textSlot]} · 替换`;b.append(im,label);b.onclick=()=>{painSelected=card;$('painInput').click();};
  const remove=document.createElement('button');remove.className='text-button pain-remove';remove.textContent='删除此画面';remove.setAttribute('aria-label',`删除第 ${i+1} 个画面`);remove.disabled=painCards.length<=1;remove.onclick=()=>{if(exporting||painCards.length<=1)return;painCards.splice(i,1);renderPain();invalidateVideo();time=0;draw(time);syncTime();notice(`已删除画面，底部 UI 已同步为 ${painCards.length} 个标记。`);};wrap.append(b,remove);$('painCards').append(wrap);
 });
}
$('painInput').onchange=async e=>{const file=e.target.files[0],card=painSelected;e.target.value='';if(!file||exporting)return;try{const ready=await importImage(file,3000);if(exporting||!painCards.includes(card))return;Object.assign(card,ready,{name:file.name.slice(0,200)});renderPain();invalidateVideo();draw(time);notice('画面已替换。');}catch(e){notice(e.message);}};
$('addPain').onclick=()=>$('painAddInput').click();
$('painAddInput').onchange=async e=>{const files=[...e.target.files];e.target.value='';if(!files.length||exporting)return;try{if(files.length+painCards.length>12)throw new Error('最多支持 12 个画面，请减少所选图片。');const ready=await Promise.all(files.map(async file=>({...await importImage(file,3000),name:file.name.slice(0,200),textSlot:null})));if(exporting)return;if(ready.length+painCards.length>12)throw new Error('最多支持 12 个画面。');painCards.push(...ready);renderPain();invalidateVideo();draw(time);notice(`已增加 ${ready.length} 个画面，底部 UI 已同步为 ${painCards.length} 个标记。`);}catch(e){notice(e.message);}};
$('resetPain').onclick=()=>{painCards=painDefaults.map(c=>({...c}));renderPain();invalidateVideo();time=0;draw(time);syncTime();notice('已恢复原始四个画面。');};
$('painText').onchange=e=>{painKeepText=e.target.checked;invalidateVideo();draw(time);};
function painSample(l,t){const f=Math.min(l.samples.length-1,Math.max(0,t*100)),i=Math.floor(f),j=Math.min(i+1,l.samples.length-1);return l.samples[i].map((v,k)=>v+(l.samples[j][k]-v)*(f-i));}
function painTransform(l,t){const [x,y,sx,sy,rot,alpha,ax,ay]=painSample(l,t);ctx.translate(x,y);ctx.rotate(rot*Math.PI/180);ctx.scale(sx/100,sy/100);ctx.translate(-ax,-ay);return alpha/100;}
const painIconCanvas=document.createElement('canvas'),painIconContext=painIconCanvas.getContext('2d');
let painIconFrame=-1;
function paintPainIcon(at){
 const a=window.PAIN_MOTION.atlas,f=Math.min(a.frames-1,Math.floor(at*25)),padding=8;
 if(f!==painIconFrame){
  if(painIconCanvas.width!==a.width+padding*2||painIconCanvas.height!==a.height+padding*2){painIconCanvas.width=a.width+padding*2;painIconCanvas.height=a.height+padding*2;}
  painIconContext.clearRect(0,0,painIconCanvas.width,painIconCanvas.height);
  // Copy one frame at native resolution before scaling. Sampling the packed atlas
  // directly can blend adjacent rows into the capsule's transparent edge.
  painIconContext.imageSmoothingEnabled=false;
  painIconContext.drawImage(painIcons,(f%a.columns)*a.width,Math.floor(f/a.columns)*a.height,a.width,a.height,padding,padding,a.width,a.height);
  painIconFrame=f;
 }
 ctx.drawImage(painIconCanvas,a.box[0]-padding,a.box[1]-padding);
}
function painProgress(at,count){
 const parent=window.PAIN_MOTION.layers.find(l=>l.index===3);
 if(count===4)return (750-painSample(parent,at)[0])/1500;
 const phase=at/8*count,index=Math.floor(phase),local=phase-index;
 const sampleTime=1.2+Math.max(0,Math.min(1,(local-.6)/.4))*.6;
 return index+(750-painSample(parent,sampleTime)[0])/1500;
}
function paintVariablePainIcon(at,progress,count){
 const current=Math.floor(progress)%count,next=(current+1)%count,blend=progress-Math.floor(progress),diameter=16.5,gap=16.5;
 const widths=Array.from({length:count},(_,i)=>diameter+58.5*(count===1?1:i===current?1-blend:i===next?blend:0));
 let x=745.25-(widths.reduce((a,b)=>a+b,0)+gap*(count-1))/2;
 const dwell=Math.min(1,(at/8*count%1)/.6);
 ctx.save();ctx.globalAlpha*=.98;
 widths.forEach((width,i)=>{ctx.fillStyle='#898989';ctx.beginPath();ctx.roundRect(x,1242, width,diameter,diameter/2);ctx.fill();
  if(i===current&&blend<.00001){ctx.save();ctx.beginPath();ctx.roundRect(x,1242,width,diameter,diameter/2);ctx.clip();ctx.fillStyle='#000';ctx.beginPath();ctx.roundRect(x,1242,width*dwell,diameter,diameter/2);ctx.fill();ctx.restore();}x+=width+gap;
 });ctx.restore();
}
function drawPain(t){
 const m=window.PAIN_MOTION;if(!painIcons||painCards.some(c=>!c.image))return;
 const at=Math.min(7.9999,Math.max(0,t/settings.duration*8)),fit=Math.min(canvas.width/1500,canvas.height/1342),count=painCards.length,progress=count===1?0:painProgress(at,count);
 ctx.save();ctx.translate((canvas.width-1500*fit)/2,(canvas.height-1342*fit)/2);ctx.scale(fit,fit);ctx.beginPath();ctx.rect(0,0,1500,1342);ctx.clip();
 const first=Math.floor(progress);
 for(let i=first;i<=first+1;i++){
  const card=painCards[i%count],im=card.image,z=Math.max(1500/im.width,1342/im.height);
  ctx.save();ctx.translate((i-progress)*1500,0);ctx.beginPath();ctx.rect(0,0,1500,1342);ctx.clip();ctx.drawImage(im,(1500-im.width*z)/2,(1342-im.height*z)/2,im.width*z,im.height*z);if(painKeepText&&card.textSlot!=null)ctx.drawImage(painTexts[card.textSlot],0,0);ctx.restore();
 }
 if(count===4){ctx.save();ctx.globalAlpha*=painTransform(m.layers[0],at);paintPainIcon(at);ctx.restore();}else paintVariablePainIcon(at,progress,count);
 ctx.restore();
}
function embeddedImage(im){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);return c.toDataURL('image/png');}
async function openPainProject(p){
 const s=p.settings,valid=a=>a&&typeof a.src==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(a.src)&&typeof a.name==='string'&&a.name.length<=200;
 if(![1,2].includes(p.version)||!s||![...$('size').options].some(o=>o.value===s.size)||!Number.isFinite(s.duration)||s.duration<3||s.duration>18||!/^#[0-9a-f]{6}$/i.test(s.background)||typeof p.showText!=='boolean'||!Array.isArray(p.images)||p.images.length<1||p.images.length>12||(p.version===1&&p.images.length!==4)||!p.images.every(valid)||(p.version===2&&p.images.some(a=>a.textSlot!==null&&(!Number.isInteger(a.textSlot)||a.textSlot<0||a.textSlot>3)))||(p.backgroundImage!=null&&!valid(p.backgroundImage)))throw new Error('四大痛点模板参数或素材无效。');
 const ims=await Promise.all(p.images.map(async (a,i)=>({...a,textSlot:p.version===1?i:a.textSlot,image:await imageFrom(a.src)}))),bg=p.backgroundImage?await imageFrom(p.backgroundImage.src):null;
 switchTemplate('pain');painCards=ims;painKeepText=p.showText;settings={size:s.size,duration:s.duration,background:s.background,scale:100,stack:false};customBackground=p.backgroundImage||null;backgroundImage=bg;time=0;renderPain();syncBackgroundUI();syncSettings();notice('四大痛点模板已打开。');
}


const buyerSpecs=[{id:17,width:3000,height:3000},{id:18,width:3000,height:3000},{id:16,width:2589,height:2000},{id:15,width:1080,height:1440}];
let buyerCards=buyerSpecs.map((_,i)=>({src:`assets/buyer-${i}.png`,image:null,name:['买家秀05.png','买家秀06.png','买家秀07.png','买家秀3.png'][i]})),buyerSelected=0;
function renderBuyer(){
 $('buyerCards').replaceChildren();$('buyerCount').textContent=`已上传 ${buyerCards.filter(c=>c.image).length} / ${buyerCards.length} 张`;$('addBuyer').disabled=buyerCards.length>=12;
 buyerCards.forEach((card,i)=>{const wrap=document.createElement('div');wrap.className='pain-item';const b=document.createElement('button');b.className='pain-card buyer-card';b.setAttribute('aria-label',`上传买家秀第 ${i+1} 张`);
 if(card.src){const im=document.createElement('img');im.src=card.src;im.alt=card.name;b.append(im);}else{const empty=document.createElement('div');empty.className='buyer-empty';empty.textContent=String(i+1).padStart(2,'0');b.append(empty);}
 const label=document.createElement('span');label.textContent=`第 ${i+1} 张 · ${card.src?'替换图片':'上传图片'}`;b.append(label);b.onclick=()=>{buyerSelected=card;$('buyerInput').click();};const clear=document.createElement('button');clear.className='text-button pain-remove';clear.textContent='清空图片';clear.disabled=!card.src;clear.setAttribute('aria-label',`清空买家秀第 ${i+1} 张`);clear.onclick=()=>{if(exporting)return;buyerCards[i]={src:null,image:null,name:''};renderBuyer();invalidateVideo();draw(time);};const remove=document.createElement('button');remove.className='text-button pain-remove';remove.textContent='删除此画面';remove.setAttribute('aria-label',`删除买家秀第 ${i+1} 个画面`);remove.disabled=buyerCards.length<=1;remove.onclick=()=>{if(exporting||buyerCards.length<=1)return;buyerCards.splice(i,1);renderBuyer();invalidateVideo();time=0;draw(time);syncTime();notice(`已删除画面，当前共 ${buyerCards.length} 个画面。`);};const actions=document.createElement('div');actions.className='buyer-item-actions';actions.append(clear,remove);wrap.append(b,actions);$('buyerCards').append(wrap);});
}
$('buyerInput').onchange=async e=>{const file=e.target.files[0],card=buyerSelected;e.target.value='';if(!file||exporting)return;try{const ready=await importImage(file,3000);if(exporting||!buyerCards.includes(card))return;Object.assign(card,ready,{name:file.name.slice(0,200)});renderBuyer();invalidateVideo();draw(time);notice('买家秀图片已替换。');}catch(e){notice(e.message);}};
$('batchBuyer').onclick=()=>$('buyerBatchInput').click();
$('buyerBatchInput').onchange=async e=>{const files=[...e.target.files];e.target.value='';if(!files.length||exporting)return;try{if(files.length>buyerCards.length)throw new Error(`当前共 ${buyerCards.length} 个画面，请使用添加图片来增加画面。`);const targets=buyerCards.slice(0,files.length);const ready=await Promise.all(files.map(async f=>({...await importImage(f,3000),name:f.name.slice(0,200)})));if(exporting)return;ready.forEach((c,i)=>{if(buyerCards.includes(targets[i]))Object.assign(targets[i],c);});renderBuyer();invalidateVideo();draw(time);notice(`已替换前 ${ready.length} 张买家秀图片。`);}catch(e){notice(e.message);}};
$('addBuyer').onclick=()=>$('buyerAddInput').click();
$('buyerAddInput').onchange=async e=>{const files=[...e.target.files];e.target.value='';if(!files.length||exporting)return;try{if(files.length+buyerCards.length>12)throw new Error('最多支持 12 个画面，请减少所选图片。');const ready=await Promise.all(files.map(async f=>({...await importImage(f,3000),name:f.name.slice(0,200)})));if(exporting)return;if(ready.length+buyerCards.length>12)throw new Error('最多支持 12 个画面。');buyerCards.push(...ready);renderBuyer();invalidateVideo();time=0;draw(time);syncTime();notice(`已增加 ${ready.length} 个画面，当前共 ${buyerCards.length} 个画面。`);}catch(e){notice(e.message);}};
function drawVariableBuyer(t){
 const count=buyerCards.length,phase=Math.min(.999999,Math.max(0,t/settings.duration))*count,step=Math.floor(phase),progress=count===1?0:step+Math.min(1,(phase-step)/.8),first=Math.floor(progress),fit=Math.min(canvas.width/3000,canvas.height/3000);
 ctx.save();ctx.translate((canvas.width-3000*fit)/2,(canvas.height-3000*fit)/2);ctx.scale(fit,fit);ctx.beginPath();ctx.rect(0,0,3000,3000);ctx.clip();
 for(let i=first;i<=first+1;i++){const index=i%count,card=buyerCards[index];ctx.save();ctx.translate((i-progress)*3000,0);ctx.beginPath();ctx.rect(0,0,3000,3000);ctx.clip();if(card.image){const z=Math.max(3000/card.image.width,3000/card.image.height);ctx.drawImage(card.image,(3000-card.image.width*z)/2,(3000-card.image.height*z)/2,card.image.width*z,card.image.height*z);}else{ctx.fillStyle='#e9eef7';ctx.fillRect(0,0,3000,3000);ctx.fillStyle='#7082a0';ctx.textAlign='center';ctx.font='600 300px sans-serif';ctx.fillText(String(index+1).padStart(2,'0'),1500,1400);ctx.font='100px "Microsoft YaHei",sans-serif';ctx.fillText('等待上传图片',1500,1700);}ctx.restore();}ctx.restore();
}
function drawBuyer(t){
 if(buyerCards.length!==4){drawVariableBuyer(t);return;}

 const m=window.BUYER_MOTION,at=Math.min(5.99999,Math.max(0,t/settings.duration*6)),fit=Math.min(canvas.width/3000,canvas.height/3000);
 function transform(l,t){const f=Math.min(l.samples.length-1,Math.max(0,t*m.sampleRate)),i=Math.floor(f),j=Math.min(i+1,l.samples.length-1),v=l.samples[i].map((x,k)=>x+(l.samples[j][k]-x)*(f-i));ctx.translate(v[0],v[1]);ctx.rotate(v[4]*Math.PI/180);ctx.scale(v[2]/100,v[3]/100);ctx.translate(-v[6],-v[7]);ctx.globalAlpha*=v[5]/100;}
 function comp(id,t){const co=m.comps.find(c=>c.id===id);ctx.save();ctx.beginPath();ctx.rect(0,0,co.width,co.height);ctx.clip();for(const l of [...co.layers].reverse()){ctx.save();transform(l,t);if(m.comps.some(c=>c.id===l.source))comp(l.source,(t-l.startTime)*100/l.stretch);else{const slot=buyerSpecs.findIndex(x=>x.id===l.source);if(slot>=0){const card=buyerCards[slot],sp=buyerSpecs[slot],w=sp.width,h=sp.height;ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();if(card.image){const z=Math.max(w/card.image.width,h/card.image.height);ctx.drawImage(card.image,(w-card.image.width*z)/2,(h-card.image.height*z)/2,card.image.width*z,card.image.height*z);}else{ctx.fillStyle=['#e9eef7','#edf2f6','#e8edf4','#f0f3f8'][slot];ctx.fillRect(0,0,w,h);ctx.fillStyle='#7082a0';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${w*.12}px sans-serif`;ctx.fillText(String(slot+1).padStart(2,'0'),w/2,h/2-w*.07);ctx.font=`${w*.035}px "Microsoft YaHei",sans-serif`;ctx.fillText('等待上传图片',w/2,h/2+w*.05);}ctx.restore();}}ctx.restore();}ctx.restore();}
 ctx.save();ctx.translate((canvas.width-3000*fit)/2,(canvas.height-3000*fit)/2);ctx.scale(fit,fit);comp(2,at);ctx.restore();
}
async function openBuyerProject(p){
 const s=p.settings,valid=a=>a&&typeof a.name==='string'&&a.name.length<=200&&typeof a.src==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(a.src);
 if(![1,2].includes(p.version)||!s||![...$('size').options].some(o=>o.value===s.size)||!Number.isFinite(s.duration)||s.duration<3||s.duration>18||!/^#[0-9a-f]{6}$/i.test(s.background)||!Array.isArray(p.images)||p.images.length<1||p.images.length>12||(p.version===1&&p.images.length!==4)||!p.images.every(a=>a===null||valid(a))||(p.backgroundImage!=null&&!valid(p.backgroundImage)))throw new Error('买家秀模板参数或图片无效。');
 const ims=await Promise.all(p.images.map(async a=>a?{...a,image:await imageFrom(a.src)}:{src:null,image:null,name:''})),bg=p.backgroundImage?await imageFrom(p.backgroundImage.src):null;
 switchTemplate('buyer');buyerCards=ims;settings={size:s.size,duration:s.duration,background:s.background,scale:100,stack:false};customBackground=p.backgroundImage||null;backgroundImage=bg;time=0;renderBuyer();syncBackgroundUI();syncSettings();notice('买家秀模板已打开。');
}


let bodyCards=[0,1].map(i=>({name:['男生画面','女生画面'][i],src:`assets/body-${i}.png`,image:null})),bodyDefaults=[],bodyUi=[],bodySelected=null;
function renderBody(){
 $('bodyCards').replaceChildren();bodyCards.forEach((card,i)=>{const b=document.createElement('button');b.className='pain-card body-card';b.setAttribute('aria-label',`替换体型不设限第 ${i+1} 张`);const im=document.createElement('img');im.src=card.src;im.alt=card.name;const label=document.createElement('span');label.textContent=`${i===0?'左侧画面':'右侧画面'} · 替换图片`;b.append(im,label);b.onclick=()=>{bodySelected=card;$('bodyInput').click();};$('bodyCards').append(b);});
}
$('bodyInput').onchange=async e=>{const file=e.target.files[0],target=bodySelected;e.target.value='';if(!file||exporting)return;try{const ready=await importImage(file,4096);if(exporting||!bodyCards.includes(target))return;Object.assign(target,ready,{name:file.name.slice(0,200)});renderBody();invalidateVideo();draw(time);notice('图片已替换，分隔线动画保持不变。');}catch(e){notice(e.message);}};
$('resetBody').onclick=()=>{if(exporting)return;bodyCards=bodyDefaults.map(c=>({...c}));renderBody();invalidateVideo();draw(time);notice('已恢复原工程的两张图片。');};
function drawBody(t){
 const m=window.BODY_MOTION;if(bodyCards.some(c=>!c.image)||bodyUi.length!==4)return;
 const at=Math.min(3.99999,Math.max(0,t/settings.duration*4)),f=at*m.sampleRate,i=Math.floor(f),j=Math.min(i+1,400),mix=f-i;
 const sample=l=>l.samples[i].map((v,k)=>v+(l.samples[j][k]-v)*mix),fit=Math.min(canvas.width/m.width,canvas.height/m.height);
 ctx.save();ctx.translate((canvas.width-m.width*fit)/2,(canvas.height-m.height*fit)/2);ctx.scale(fit,fit);ctx.beginPath();ctx.rect(0,0,m.width,m.height);ctx.clip();
 function paint(slot,layer){const v=sample(layer),im=bodyCards[slot].image,z=Math.max(2450/im.width,3925/im.height);ctx.save();ctx.translate(v[0],v[1]);ctx.rotate(v[4]*Math.PI/180);ctx.scale(v[2]/100,v[3]/100);ctx.translate(-v[6],-v[7]);ctx.globalAlpha*=v[5]/100;ctx.beginPath();ctx.rect(0,0,2450,3925);ctx.clip();ctx.drawImage(im,(2450-im.width*z)/2,(3925-im.height*z)/2,im.width*z,im.height*z);ctx.restore();}
 paint(1,m.layers[3]);
 const mask=sample(m.layers[1]);ctx.save();ctx.beginPath();ctx.rect(mask[0]-8-2792,mask[1]-8-1592,5584,3184);ctx.clip();paint(0,m.layers[2]);ctx.restore();
 const v=sample(m.layers[0]);m.groups.forEach((g,k)=>{const alpha=(g.opacity[i]+(g.opacity[j]-g.opacity[i])*mix)/100,b=g.box;ctx.save();ctx.globalAlpha*=alpha*v[5]/100;if(k===3)ctx.drawImage(bodyUi[k],b[0]+v[0]-1225,0,b[2]-b[0],3500);else ctx.drawImage(bodyUi[k],b[0]+v[0]-1225,b[1]+v[1]-1750);ctx.restore();});ctx.restore();
}
async function openBodyProject(p){
 const s=p.settings,valid=a=>a&&typeof a.name==='string'&&a.name.length<=200&&typeof a.src==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(a.src);
 if(p.version!==1||!s||![...$('size').options].some(o=>o.value===s.size)||!Number.isFinite(s.duration)||s.duration<3||s.duration>18||!/^#[0-9a-f]{6}$/i.test(s.background)||!Array.isArray(p.images)||p.images.length!==2||!p.images.every(valid)||(p.backgroundImage!=null&&!valid(p.backgroundImage)))throw new Error('体型不设限模板参数或图片无效。');
 const ims=await Promise.all(p.images.map(async a=>({...a,image:await imageFrom(a.src)}))),bg=p.backgroundImage?await imageFrom(p.backgroundImage.src):null;
 switchTemplate('body');bodyCards=ims;settings={size:s.size,duration:s.duration,background:s.background,scale:100,stack:false};customBackground=p.backgroundImage||null;backgroundImage=bg;time=0;renderBody();syncBackgroundUI();syncSettings();notice('体型不设限模板已打开。');
}

const templateStates={};
function switchTemplate(mode){
  if(exporting||mode===activeTemplate)return;
  templateStates[activeTemplate]={settings:{...settings},customBackground,backgroundImage,time};
  pauseSmart();activeTemplate=mode;
  const saved=templateStates[mode];
  settings=saved?saved.settings:{size:mode==='smart'?'1668,1455':mode==='body'?'980,1400':mode==='buyer'?'1080,1080':mode==='pain'?'1500,1342':'1500,1214',duration:mode==='smart'?10.44:mode==='body'?4:mode==='buyer'?6:8,scale:100,background:mode==='smart'?'#ffe3c9':'#ffffff',stack:false};
  customBackground=saved?saved.customBackground:null;backgroundImage=saved?saved.backgroundImage:null;time=saved?saved.time:0;
  $('templateMode').value=mode;
  $('smartMaterials').hidden=mode!=='smart';$('bodyMaterials').hidden=mode!=='body';$('buyerMaterials').hidden=mode!=='buyer';$('painMaterials').hidden=mode!=='pain';$('cardMaterials').hidden=mode!=='cards';$('longMaterials').hidden=mode!=='plain';$('cardScale').hidden=mode!=='cards';$('trailSettings').hidden=mode!=='cards';
  canvas.setAttribute('aria-label',mode==='smart'?'智能互联动态人物轮播预览':mode==='body'?'体型不设限左右对比预览':mode==='buyer'?'买家秀横向轮播预览':mode==='pain'?'四大痛点轮播预览':mode==='plain'?'长图横向滚动预览':'六张课程卡片循环轮播预览');
  syncBackgroundUI();syncSettings();notice('');if(mode==='smart'&&!smartReady){notice('正在加载动态人物素材…');ensureSmart().catch(()=>{});}
}
$('templateMode').onchange=e=>switchTemplate(e.target.value);
function syncLongUI(){$('longPreview').src=longSource;$('longName').textContent=longName;}
$('uploadLong').onclick=()=>$('longInput').click();
$('longInput').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file||exporting)return;try{const ready=await importImage(file,8192);if(exporting)return;longImage=ready.image;longSource=ready.src;longName=file.name.slice(0,200);syncLongUI();invalidateVideo();draw(time);notice('长图已替换。');}catch(e){notice(e.message);}};
$('resetLong').onclick=()=>{longImage=defaultLongImage;longSource=defaultLongImage.src;longName='AE 原始长图';syncLongUI();invalidateVideo();draw(time);};
function drawLong(t){
  if(!longImage)return;
  const m=window.PLAIN_MOTION,l=m.layers[0],at=Math.min(m.duration-.00001,t/settings.duration*m.duration),f=Math.min(l.samples.length-1,Math.max(0,at*m.sampleRate)),i=Math.floor(f),j=Math.min(i+1,l.samples.length-1),v=l.samples[i].map((x,k)=>x+(l.samples[j][k]-x)*(f-i));
  const fit=Math.min(canvas.width/m.width,canvas.height/m.height);
  const width=longImage.width*1214/longImage.height;
  const progress=(l.samples[0][0]-v[0])/3400;
  const distance=Math.max(0,width-1500)*(3400/3401);
  ctx.save();ctx.translate((canvas.width-m.width*fit)/2,(canvas.height-m.height*fit)/2);ctx.scale(fit,fit);ctx.beginPath();ctx.rect(0,0,m.width,m.height);ctx.clip();
  ctx.drawImage(longImage,-.5-progress*distance,v[1]-v[7],width,1214);ctx.restore();
}
async function openLongProject(p){
  const s=p.settings,asset=p.longImage,bg=p.backgroundImage;
  if(p.version!==1||!s||![...$('size').options].some(o=>o.value===s.size)||!Number.isFinite(s.duration)||s.duration<3||s.duration>18||!/^#[0-9a-f]{6}$/i.test(s.background))throw new Error('长图模板参数无效。');
  const valid=a=>a&&typeof a.src==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(a.src)&&typeof a.name==='string'&&a.name.length<=200;
  if(!valid(asset)||(bg!=null&&!valid(bg)))throw new Error('长图模板素材无效。');
  const [im,bim]=await Promise.all([imageFrom(asset.src),bg?imageFrom(bg.src):Promise.resolve(null)]);
  switchTemplate('plain');longImage=im;longSource=asset.src;longName=asset.name;settings={size:s.size,duration:s.duration,background:s.background,scale:100,stack:false};customBackground=bg||null;backgroundImage=bim;time=0;syncLongUI();syncBackgroundUI();syncSettings();notice('长图模板已打开。');
}
function sampleLayer(layer,t){
  const f=Math.max(0,Math.min(600,t*motion.sampleRate)),i=Math.floor(f),j=Math.min(600,i+1),p=f-i;
  return layer.samples[i].map((v,k)=>v+(layer.samples[j][k]-v)*p);
}
function paintCard(card,w,h){
  if(!card.image)return;
  ctx.save();
  // Keep the AE footage's own alpha and pixel geometry for the supplied cards.
  if(card.original){ctx.drawImage(card.image,0,0,w,h);}
  else {
    ctx.beginPath();ctx.roundRect(0,0,w,h,w*0.035);ctx.clip();
    const z=Math.max(w/card.image.width,h/card.image.height);
    ctx.drawImage(card.image,(w-card.image.width*z)/2,(h-card.image.height*z)/2,card.image.width*z,card.image.height*z);
  }
  ctx.restore();
}
function paintLabel(source){
  const spec=motion.labels[source],card=cards[spec.slot],box=spec.box;
  const originalIndex=names.indexOf(card.title);
  if(originalIndex>=0&&labelImages[originalIndex]){
    ctx.drawImage(labelImages[originalIndex],box[0],box[1]);
  }else{
    ctx.fillStyle='#a3a3a3';ctx.font='32px "Microsoft YaHei",sans-serif';ctx.textBaseline='top';
    ctx.fillText(card.title,box[0],box[1]-2,300);
  }
}
function paintComp(id,t){
  const comp=compMap.get(id);
  for(let n=comp.layers.length-1;n>=0;n--){
    const layer=comp.layers[n];
    if(t<layer.inPoint||t>=layer.outPoint)continue;
    if([165,161,159].includes(layer.source))continue;
    if(layer.source===153&&!settings.stack)continue;
    const [x,y,sx,sy,rotation,alpha,ax,ay]=sampleLayer(layer,t);
    if(alpha<=0)continue;
    ctx.save();ctx.globalAlpha*=alpha/100;ctx.translate(x,y);ctx.rotate(rotation*Math.PI/180);ctx.scale(sx/100,sy/100);ctx.translate(-ax,-ay);
    if(compMap.has(layer.source))paintComp(layer.source,(t-layer.startTime)*100/layer.stretch);
    else if(motion.cards[layer.source]){const spec=motion.cards[layer.source];paintCard(cards[spec.slot],spec.width,spec.height);}
    else if(motion.labels[layer.source])paintLabel(layer.source);
    else if(layer.source===153&&stackImage)ctx.drawImage(stackImage,0,0,392,607);
    ctx.restore();
  }
}
function draw(t){
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle=settings.background;ctx.fillRect(0,0,w,h);
  if(backgroundImage){const z=Math.max(w/backgroundImage.width,h/backgroundImage.height);ctx.drawImage(backgroundImage,(w-backgroundImage.width*z)/2,(h-backgroundImage.height*z)/2,backgroundImage.width*z,backgroundImage.height*z);}
  if(activeTemplate==='plain'){drawLong(t);return;}
  if(activeTemplate==='pain'){drawPain(t);return;}
  if(activeTemplate==='buyer'){drawBuyer(t);return;}
  if(activeTemplate==='body'){drawBody(t);return;}
  if(activeTemplate==='smart'){drawSmart(t);return;}
  if(!stackImage)return;
  // Use the actual 2351 × 2285 AE composition, centered and fitted without distortion.
  const fit=Math.min(w/motion.width,h/motion.height)*settings.scale/100;
  const aeTime=Math.min(5.9999,Math.max(0,t/settings.duration*motion.duration));
  ctx.save();ctx.translate(w/2,h/2);ctx.scale(fit,fit);ctx.translate(-motion.width/2,-motion.height/2);
  paintComp(57,aeTime);ctx.restore();
}
function syncTime(){ $('timeline').value=time;$('timecode').textContent=time.toFixed(2).padStart(5,'0'); }
function setPlaying(value){if(!value)pauseSmart();playing=value;last=0;$('play').textContent=value?'Ⅱ':'▶';$('play').setAttribute('aria-label',value?'暂停动画':'播放动画');}
function loop(timestamp){if(playing&&!exporting){if(last)time=(time+(timestamp-last)/1000)%settings.duration;last=timestamp;draw(time);syncTime();}requestAnimationFrame(loop);}
function syncSettings(){
  invalidateVideo();
  $('formatLabel').textContent=supportedMime?`${extension.toUpperCase()} · ${activeTemplate==='body'?30:activeTemplate==='plain'?24:25} FPS`:'暂不支持';
  ['size','duration','scale','background'].forEach(k=>$(k).value=settings[k]);$('stack').checked=settings.stack;
  [canvas.width,canvas.height]=settings.size.split(',').map(Number);
  $('canvasLabel').textContent=$('size').selectedOptions[0].textContent;$('durationValue').textContent=`${settings.duration} 秒`;$('durationLabel').textContent=settings.duration.toFixed(2).padStart(5,'0');$('timeline').max=settings.duration;$('scaleValue').textContent=`${settings.scale}%`;$('colorValue').textContent=settings.background.toUpperCase();time=Math.min(time,settings.duration);draw(time);syncTime();updatePreviewZoom();
}
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function saveProject(){try{
 if(activeTemplate==='smart'){await saveSmartProject();return;}
 if(activeTemplate==='body'){if(bodyCards.some(c=>!c.image))throw new Error('请等待素材加载完成。');downloadBlob(new Blob([JSON.stringify({type:'body-compare',version:1,settings,images:bodyCards.map(c=>({name:c.name,src:embeddedImage(c.image)})),backgroundImage:customBackground})],{type:'application/json'}),'体型不设限模板.json');notice('体型不设限模板已保存。');return;}
 if(activeTemplate==='buyer'){downloadBlob(new Blob([JSON.stringify({type:'buyer-carousel',version:2,settings,images:buyerCards.map(c=>c.image?{name:c.name,src:embeddedImage(c.image)}:null),backgroundImage:customBackground})],{type:'application/json'}),'买家秀模板.json');notice('买家秀模板已保存，可下次继续上传图片。');return;}
  if(activeTemplate==='pain'){if(painCards.some(c=>!c.image))throw new Error('请等待素材加载完成。');downloadBlob(new Blob([JSON.stringify({type:'pain-carousel',version:2,settings,showText:painKeepText,images:painCards.map(c=>({name:c.name,src:embeddedImage(c.image),textSlot:c.textSlot})),backgroundImage:customBackground})],{type:'application/json'}),'四大痛点轮播模板.json');notice('四大痛点模板已保存，包含全部图片、画面数量、文案开关和画面参数。');return;}
  if(activeTemplate==='plain'){
    if(!longImage)throw new Error('请等待长图加载完成。');
    const temp=document.createElement('canvas');temp.width=longImage.width;temp.height=longImage.height;temp.getContext('2d').drawImage(longImage,0,0);
    downloadBlob(new Blob([JSON.stringify({type:'long-scroll',version:1,settings,longImage:{src:temp.toDataURL('image/png'),name:longName},backgroundImage:customBackground})],{type:'application/json'}),'长图横向滚动模板.json');notice('长图模板已保存，包含长图、背景和画面参数。');return;
  }
  const exported=cards.map(c=>{const temp=document.createElement('canvas');temp.width=c.image.width;temp.height=c.image.height;temp.getContext('2d').drawImage(c.image,0,0);return {title:c.title,src:temp.toDataURL('image/png'),original:!!c.original};});
  downloadBlob(new Blob([JSON.stringify({type:'course-carousel',version:1,settings,cards:exported,trail:customStack,backgroundImage:customBackground})],{type:'application/json'}),'课程轮播模板.json');notice('模板已保存，包含六张图片、拖尾、背景图片和画面参数。下次用「打开模板」继续编辑。');
}catch(e){notice('保存失败：'+e.message);}}
function validateProject(p){
  if(p.type!=='course-carousel'||p.version!==1||!Array.isArray(p.cards)||p.cards.length!==6)throw new Error('这不是有效的轮播模板文件。');
  if(p.trail!=null&&(typeof p.trail.src!=='string'||!/^data:image\/png;base64,/.test(p.trail.src)||typeof p.trail.name!=='string'||p.trail.name.length>200))throw new Error('模板拖尾素材无效。');
  if(p.backgroundImage!=null&&(typeof p.backgroundImage.src!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(p.backgroundImage.src)||typeof p.backgroundImage.name!=='string'||p.backgroundImage.name.length>200))throw new Error('模板背景图片无效。');
  const s=p.settings,allowed=[...$('size').options].map(o=>o.value);
  if(!s||!allowed.includes(s.size)||!Number.isFinite(s.duration)||s.duration<3||s.duration>18||!Number.isFinite(s.scale)||s.scale<65||s.scale>115||!/^#[0-9a-f]{6}$/i.test(s.background)||typeof s.stack!=='boolean')throw new Error('模板中的画面参数无效。');
  for(const c of p.cards)if(typeof c.title!=='string'||c.title.length>24||typeof c.src!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(c.src))throw new Error('模板图片或标题无效。');
}
async function exportVideo(){
  if(exporting)return;
  if(activeTemplate==='buyer'&&buyerCards.some(c=>!c.image)){notice('请先补齐当前所有画面的图片，再导出视频。');return;}
  if(!supportedMime||!canvas.captureStream){notice('当前浏览器不支持视频导出，请使用最新版 Chrome 或 Edge 打开此页面。');return;}
  if(activeTemplate==='smart'?!smartReady:activeTemplate==='body'?(bodyCards.some(c=>!c.image)||bodyUi.length!==4):activeTemplate==='plain'?!longImage:activeTemplate==='pain'?(!painIcons||painCards.some(c=>!c.image)):cards.some(c=>!c.image)){notice('请等待图片加载完成后导出。');return;}
  exporting=true;setPlaying(false);document.body.classList.add('exporting');$('exportState').hidden=false;$('exportProgress').value=0;$('download').hidden=true;notice('');
  const editorControls=[...document.querySelectorAll('.editor button,.editor input,.editor select')].map(el=>({el,disabled:el.disabled}));editorControls.forEach(x=>x.el.disabled=true);
  const disableIds=['play','replay','timeline','saveProject','loadProject','exportTop','templateMode'];disableIds.forEach(id=>$(id).disabled=true);
  let stream,recorder,raf,timer,cancelled=false;
  try{
    if(activeTemplate==='smart')await prepareSmartExport();time=0;draw(0);syncTime();stream=canvas.captureStream(activeTemplate==='body'?30:activeTemplate==='plain'?24:25);
    recorder=new MediaRecorder(stream,{mimeType:supportedMime,videoBitsPerSecond:12000000});
    const chunks=[];
    await new Promise((resolve,reject)=>{
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>reject(e.error||new Error('浏览器编码失败。'));
      recorder.onstop=()=>resolve();cancelRecording=()=>{cancelled=true;if(recorder.state!=='inactive')recorder.stop();};
      recorder.start(200);const start=performance.now();
      const frame=now=>{if(recorder.state==='inactive')return;const elapsed=(now-start)/1000;time=Math.min(elapsed,settings.duration);draw(Math.min(time,settings.duration-.001));syncTime();const pc=Math.min(100,Math.round(elapsed/settings.duration*100));$('exportProgress').value=pc;$('exportMessage').textContent=`正在导出 · ${pc}%`;if(elapsed>=settings.duration){recorder.stop();return;}raf=requestAnimationFrame(frame);};
      raf=requestAnimationFrame(frame);timer=setTimeout(()=>{cancelled=true;if(recorder.state!=='inactive')recorder.stop();},(settings.duration+15)*1000);
    });
    if(cancelled){notice('导出已取消。保持页面在前台后可重新导出。');return;}
    if(!chunks.length)throw new Error('未生成视频数据，请重试。');
    const blob=new Blob(chunks,{type:recorder.mimeType||supportedMime});if(videoURL)URL.revokeObjectURL(videoURL);videoURL=URL.createObjectURL(blob);
    $('download').href=videoURL;$('download').download=`${activeTemplate==='smart'?'智能互联动态人物':activeTemplate==='body'?'体型不设限':activeTemplate==='buyer'?'买家秀':activeTemplate==='pain'?'四大痛点轮播':activeTemplate==='plain'?'长图横向滚动':'课程轮播'}-${canvas.width}x${canvas.height}.${extension}`;$('download').textContent=`下载 ${extension.toUpperCase()} 视频 · ${(blob.size/1024/1024).toFixed(1)} MB`;$('download').hidden=false;
    notice('视频已生成，点击下方链接保存到电脑。');
  }catch(e){notice('导出未完成：'+e.message+' 请降低尺寸后重试。');}
  finally{cancelAnimationFrame(raf);clearTimeout(timer);if(recorder&&recorder.state!=='inactive')recorder.stop();if(stream)stream.getTracks().forEach(t=>t.stop());exporting=false;cancelRecording=null;document.body.classList.remove('exporting');$('exportState').hidden=true;disableIds.forEach(id=>$(id).disabled=false);editorControls.forEach(x=>x.el.disabled=x.disabled);time=0;draw(0);syncTime();}
}
$('play').onclick=()=>setPlaying(!playing);$('replay').onclick=()=>{time=0;draw(0);syncTime();setPlaying(true);};$('timeline').oninput=()=>{setPlaying(false);time=Number($('timeline').value);draw(time);syncTime();};
['size','duration','scale','background','stack'].forEach(k=>$(k).addEventListener('input',()=>{if(k==='background'&&activeTemplate==='smart'){settings.originalBackground=false;syncBackgroundUI();}settings[k]=k==='stack'?$(k).checked:['duration','scale'].includes(k)?Number($(k).value):$(k).value;syncSettings();}));
$('resetSettings').onclick=()=>{settings=activeTemplate==='smart'?{size:'1668,1455',duration:10.44,scale:100,background:'#ffe3c9',stack:false,originalBackground:true}:activeTemplate==='body'?{size:'980,1400',duration:4,scale:100,background:'#ffffff',stack:false}:activeTemplate==='buyer'?{size:'1080,1080',duration:6,scale:100,background:'#ffffff',stack:false}:activeTemplate==='pain'?{size:'1500,1342',duration:8,scale:100,background:'#ffffff',stack:false}:activeTemplate==='plain'?{size:'1500,1214',duration:8,scale:100,background:'#ffffff',stack:false}:{size:'1176,1144',duration:6,scale:100,background:'#f2f2f2',stack:true};syncSettings();};
$('imageInput').onchange=async e=>{const file=e.target.files[0],index=selected;e.target.value='';if(!file)return;try{const result=await importImage(file);Object.assign(cards[index],result);invalidateVideo();renderCards();draw(time);notice(`第 ${index+1} 张卡片已替换。`);}catch(e){notice(e.message);}};
$('batchUpload').onclick=()=>$('batchInput').click();$('batchInput').onchange=async e=>{const files=[...e.target.files];e.target.value='';if(!files.length)return;if(files.length>6){notice('一次最多选择 6 张图片，请重新选择。');return;}try{const imported=await Promise.all(files.map(file=>importImage(file)));imported.forEach((c,i)=>Object.assign(cards[i],c));invalidateVideo();renderCards();draw(time);notice(`已按所选文件顺序替换前 ${files.length} 张卡片，可用前移、后移调整。`);}catch(e){notice(e.message);}};
$('saveProject').onclick=saveProject;$('loadProject').onclick=()=>$('projectInput').click();$('projectInput').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>300*1024*1024)throw new Error('模板文件过大，请选择 300 MB 以内的文件。');const p=JSON.parse(await file.text());if(p.type==='smart-carousel'){await openSmartProject(p);return;}if(p.type==='body-compare'){await openBodyProject(p);return;}if(p.type==='buyer-carousel'){await openBuyerProject(p);return;}if(p.type==='pain-carousel'){await openPainProject(p);return;}if(p.type==='long-scroll'){await openLongProject(p);return;}validateProject(p);const ready=await Promise.all(p.cards.map(async c=>({...c,image:await imageFrom(c.src)})));const trailImage=p.trail?await imageFrom(p.trail.src):defaultStackImage;const loadedBackground=p.backgroundImage?await imageFrom(p.backgroundImage.src):null;switchTemplate('cards');cards=ready;settings=p.settings;customBackground=p.backgroundImage||null;backgroundImage=loadedBackground;syncBackgroundUI();customStack=p.trail||null;stackImage=trailImage;syncStackUI();time=0;renderCards();syncSettings();notice('模板已打开，可以继续替换素材。');}catch(e){notice('打开失败：'+e.message);}};
$('export').onclick=exportVideo;$('exportTop').onclick=exportVideo;$('cancelExport').onclick=()=>cancelRecording?.();document.addEventListener('visibilitychange',()=>{if(document.hidden&&exporting)cancelRecording?.();});
$('formatLabel').textContent=supportedMime?`${extension.toUpperCase()} · 25 FPS`:'暂不支持';$('formatHint').textContent=supportedMime?`导出 ${extension.toUpperCase()} 无声视频，包含完整一轮。${extension==='webm'?'此浏览器不支持 MP4 录制，将使用 WebM。':''}`:'请用最新版 Chrome 或 Edge 导出视频。';
Promise.all([Promise.all(bodyCards.map(async c=>{c.image=await imageFrom(c.src);})).then(()=>{bodyDefaults=bodyCards.map(c=>({...c}));renderBody();}),Promise.all([0,1,2,3].map(i=>imageFrom(`assets/body-ui-${i}.png`))).then(ims=>bodyUi=ims),Promise.all(buyerCards.map(async c=>{c.image=await imageFrom(c.src);})),Promise.all(painCards.map(async c=>{c.image=await imageFrom(c.src);})).then(()=>{painDefaults=painCards.map(c=>({...c}));renderPain();}),Promise.all(painNames.map((_,i)=>imageFrom(`assets/pain-text-${i}.png`))).then(ims=>painTexts=ims),imageFrom('assets/pain-icons.png').then(im=>painIcons=im),imageFrom('assets/plain-long.png').then(im=>{longImage=defaultLongImage=im;syncLongUI();}),Promise.all(cards.map(async c=>{c.image=await imageFrom(c.src);})),Promise.all(names.map((_,i)=>imageFrom(`assets/label-${i}.png`))).then(images=>labelImages=images),imageFrom('assets/stack.png').then(img=>{stackImage=defaultStackImage=img;syncStackUI();})]).then(()=>{renderBuyer();renderCards();syncSettings();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)setPlaying(true);requestAnimationFrame(loop);}).catch(e=>notice('素材加载失败：'+e.message));

setupSmart();
