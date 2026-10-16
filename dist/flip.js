'use strict';
const flipCopy = [
  {category:'休闲',title:'自由/团队跑步',body:'沉浸绝美风景\n奇遇沿途惊喜'},
  {category:'娱乐',title:'多人组队',body:'线上团练\n团队竞速'},
  {category:'竞技',title:'影子PK排位赛',body:'与历史最强战绩\n一决高下'},
  {category:'赛事',title:'巅峰联赛',body:'征战多级联赛\n解锁限定外观'}
];
let flipCards=flipCopy.map((c,i)=>({...c,name:`原始画面 ${i+1}`,src:`assets/flip-card-${i}.webp`,image:null,original:true}));
let flipDefaults=[],flipBlues=[],flipLabels=[],flipMotion=null,flipSelected=null;
const flipSurfaces=[];
let flipTintedLabels=[],flipTintColor=null;
let flipBlurCanvas=null,flipShutterCanvas=null;
function flipDefaultSettings(){return {size:'1500,1508',duration:10,scale:100,contentScale:100,background:'#eceff2',flipAccent:'#ebb300',flipBodyColor:'#010101',flipLineColor:'#ffffff',flipAccentOpacity:100,stack:false};}
async function ensureFlip(){
  const [motion,originals,blues,labels]=await Promise.all([
    window.FLIP_MOTION?Promise.resolve(window.FLIP_MOTION):fetch('flip-motion.json').then(r=>{if(!r.ok)throw Error('翻页动画参数加载失败。');return r.json();}),
    loadDefaultCards(flipCards),
    Promise.all([0,1,2].map(i=>imageFrom(`assets/flip-blue-${i}.webp`))),
    Promise.all([0,1,2,3].map(i=>imageFrom(`assets/flip-label-${i}.webp`)))
  ]);
  flipMotion=motion;flipDefaults=originals;flipBlues=blues;flipLabels=labels;
  if(!flipSurfaces.length)for(let i=0;i<8;i++){const canvas=document.createElement('canvas');canvas.width=1352;canvas.height=764;flipSurfaces.push({canvas,key:null});}
}
function syncFlipColor(){
  const lineColor=settings.flipLineColor||'#ffffff';$('flipLinePicker').value=lineColor;$('flipLineHex').value=lineColor.toUpperCase();$('flipLineHex').removeAttribute('aria-invalid');$('flipLineHint').textContent='仅修改滑块下方横线的颜色，保留原始 16% 透明度。';
  const bodyColor=settings.flipBodyColor||'#010101';$('flipBodyPicker').value=bodyColor;$('flipBodyHex').value=bodyColor.toUpperCase();$('flipBodyHex').removeAttribute('aria-invalid');$('flipBodyHint').textContent='四组下方两行正文同步变色，保留选中与非选中的透明度联动。';
  const opacity=settings.flipAccentOpacity??100;$('flipAccentOpacity').value=opacity;$('flipAccentOpacityNumber').value=opacity;
  const color=settings.flipAccent||'#ebb300';$('flipAccentPicker').value=color;$('flipAccentHex').value=color.toUpperCase();$('flipAccentHex').removeAttribute('aria-invalid');$('flipColorHint').textContent='滑块与四组第一行文案同步变色，保留透明度联动。';
}
function setFlipColor(value){
  const raw=value.trim(),color=raw.startsWith('#')?raw:'#'+raw;
  if(!/^#[0-9a-f]{6}$/i.test(color)){$('flipAccentHex').setAttribute('aria-invalid','true');$('flipColorHint').textContent='请输入 6 位十六进制色值，例如 #EBB300 或 12B8E8。';return;}
  settings.flipAccent=color.toLowerCase();$('flipAccentPicker').value=settings.flipAccent;$('flipAccentHex').removeAttribute('aria-invalid');$('flipColorHint').textContent='滑块与四组第一行文案同步变色，保留透明度联动。';invalidateVideo();draw(time);
}
function setFlipBodyColor(value){
  const raw=value.trim(),color=raw.startsWith('#')?raw:'#'+raw;
  if(!/^#[0-9a-f]{6}$/i.test(color)){$('flipBodyHex').setAttribute('aria-invalid','true');$('flipBodyHint').textContent='请输入 6 位十六进制色值，例如 #010101 或 12B8E8。';return;}
  settings.flipBodyColor=color.toLowerCase();$('flipBodyPicker').value=settings.flipBodyColor;$('flipBodyHex').removeAttribute('aria-invalid');$('flipBodyHint').textContent='四组下方两行正文同步变色，保留选中与非选中的透明度联动。';invalidateVideo();draw(time);
}
function setFlipLineColor(value){
  const raw=value.trim(),color=raw.startsWith('#')?raw:'#'+raw;
  if(!/^#[0-9a-f]{6}$/i.test(color)){$('flipLineHex').setAttribute('aria-invalid','true');$('flipLineHint').textContent='请输入 6 位十六进制色值，例如 #FFFFFF 或 12B8E8。';return;}
  settings.flipLineColor=color.toLowerCase();$('flipLinePicker').value=settings.flipLineColor;$('flipLineHex').removeAttribute('aria-invalid');$('flipLineHint').textContent='仅修改滑块下方横线的颜色，保留原始 16% 透明度。';invalidateVideo();draw(time);
}
function flipLabelImages(){
  const color=settings.flipAccent||'#ebb300',bodyColor=settings.flipBodyColor||'#010101',key=color+'|'+bodyColor;if(color==='#ebb300'&&bodyColor==='#010101')return flipLabels;
  if(flipTintColor===key)return flipTintedLabels;
  flipTintColor=key;flipTintedLabels=flipLabels.map(im=>{
    const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const q=c.getContext('2d'),header=44;
    q.drawImage(im,0,0,im.width,header,0,0,im.width,header);q.globalCompositeOperation='source-in';q.fillStyle=color;q.fillRect(0,0,c.width,c.height);
    q.globalCompositeOperation='source-over';
    const body=document.createElement('canvas');body.width=im.width;body.height=im.height-header;const b=body.getContext('2d');b.drawImage(im,0,header,im.width,im.height-header,0,0,body.width,body.height);b.globalCompositeOperation='source-in';b.fillStyle=bodyColor;b.fillRect(0,0,body.width,body.height);q.drawImage(body,0,header);return c;
  });return flipTintedLabels;
}
function renderFlip(){
  $('flipCards').replaceChildren();
  flipCards.forEach((card,i)=>{
    const wrap=document.createElement('div');wrap.className='flip-item';
    const button=document.createElement('button');button.className='pain-card';button.setAttribute('aria-label',`替换翻页第 ${i+1} 个画面`);
    const im=document.createElement('img');im.src=mediaPoster(card.image,card.src);im.alt=card.name;
    const caption=document.createElement('span');caption.textContent=`${i+1} · 替换图片 / 视频`;button.append(im,caption);
    button.onclick=()=>{flipSelected=card;$('flipInput').click();};wrap.append(button);
    for(const [key,label,max] of [['category','分类',6],['title','标题',20],['body','正文（最多两行）',48]]){
      const field=document.createElement('label');field.className='field';field.textContent=label;
      const input=document.createElement(key==='body'?'textarea':'input');input.value=card[key];input.maxLength=max;input.setAttribute('aria-label',`第 ${i+1} 组${label}`);
      if(key==='body')input.rows=2;
      input.oninput=()=>{card[key]=input.value;invalidateVideo();draw(time);};field.append(input);wrap.append(field);
    }
    $('flipCards').append(wrap);
  });
}
function setupFlip(){
  $('flipBodyPicker').oninput=e=>{if(exporting)return;setFlipBodyColor(e.target.value);syncFlipColor();};
  $('flipBodyHex').oninput=e=>{if(!exporting)setFlipBodyColor(e.target.value);};
  $('flipBodyHex').onblur=()=>{if($('flipBodyHex').getAttribute('aria-invalid')!=='true')syncFlipColor();};
  $('resetFlipBodyColor').onclick=()=>{if(exporting)return;setFlipBodyColor('#010101');syncFlipColor();};
  $('flipLinePicker').oninput=e=>{if(exporting)return;setFlipLineColor(e.target.value);syncFlipColor();};
  $('flipLineHex').oninput=e=>{if(!exporting)setFlipLineColor(e.target.value);};
  $('flipLineHex').onblur=()=>{if($('flipLineHex').getAttribute('aria-invalid')!=='true')syncFlipColor();};
  $('resetFlipLineColor').onclick=()=>{if(exporting)return;setFlipLineColor('#ffffff');syncFlipColor();};
  const setOpacity=e=>{if(exporting||e.target.value==='')return;const value=Number(e.target.value);if(!Number.isFinite(value))return;settings.flipAccentOpacity=Math.max(0,Math.min(100,Math.round(value)));$('flipAccentOpacity').value=settings.flipAccentOpacity;$('flipAccentOpacityNumber').value=settings.flipAccentOpacity;invalidateVideo();draw(time);};
  $('flipAccentOpacity').oninput=setOpacity;$('flipAccentOpacityNumber').oninput=setOpacity;
  $('flipAccentOpacityNumber').onblur=()=>{$('flipAccentOpacityNumber').value=settings.flipAccentOpacity??100;};
  $('resetFlipOpacity').onclick=()=>{if(exporting)return;settings.flipAccentOpacity=100;syncFlipColor();invalidateVideo();draw(time);};
  $('flipAccentPicker').oninput=e=>{if(exporting)return;setFlipColor(e.target.value);syncFlipColor();};
  $('flipAccentHex').oninput=e=>{if(!exporting)setFlipColor(e.target.value);};
  $('flipAccentHex').onblur=()=>{if($('flipAccentHex').getAttribute('aria-invalid')!=='true')syncFlipColor();};
  $('resetFlipColor').onclick=()=>{if(exporting)return;setFlipColor('#ebb300');syncFlipColor();};
  $('flipInput').onchange=async e=>{
    const file=e.target.files[0],card=flipSelected;e.target.value='';if(!file||exporting)return;
    try{const ready=await importMedia(file,3000);if(exporting||!flipCards.includes(card))return;Object.assign(card,ready,{name:file.name.slice(0,200)});flipSurfaces.forEach(b=>b.key=null);renderFlip();invalidateVideo();draw(time);notice('翻页素材已替换，文案和指示条继续同步。');}catch(e){notice(e.message);}
  };
  $('resetFlip').onclick=()=>{if(exporting||!templateReady.has('flip'))return;pauseTemplateMedia();flipCards=flipDefaults.map(c=>({...c}));flipSurfaces.forEach(b=>b.key=null);renderFlip();invalidateVideo();time=0;draw(time);syncTime();notice('已恢复原始四组画面和文案。');};
}
function flipSample(samples,t){
  const f=Math.max(0,Math.min(samples.length-1,t*flipMotion.sampleRate)),i=Math.floor(f),j=Math.min(i+1,samples.length-1);
  return samples[i].map((v,k)=>v+(samples[j][k]-v)*(f-i));
}
function flipSurface(layerIndex,slot,z){
  const card=flipCards[slot],im=card.image,buffer=flipSurfaces[layerIndex];
  const photo=Math.max(0,Math.min(1,1-z/90)),rank=Math.max(1,Math.min(3,z/180));
  const key=[card.original,Math.round(z*100),isVideoMedia(im)?im.currentTime:0].join('|');
  if(buffer.key===key&&buffer.image===im)return buffer.canvas;
  buffer.key=key;buffer.image=im;const q=buffer.canvas.getContext('2d');q.clearRect(0,0,1352,764);
  for(let i=0;i<3;i++){q.globalAlpha=Math.max(0,1-Math.abs(rank-(i+1)))*(1-photo);if(q.globalAlpha>0)q.drawImage(flipBlues[i],0,0,1352,764);}
  if(photo>0&&im){q.save();q.globalAlpha=photo;
    if(card.original)q.drawImage(im,0,0,1352,764);
    else {q.beginPath();q.roundRect(0,0,1352,764,90);q.clip();const scale=Math.max(1352/im.width,764/im.height);q.drawImage(im,(1352-im.width*scale)/2,(764-im.height*scale)/2,im.width*scale,im.height*scale);}
    q.restore();
  }
  q.globalAlpha=1;return buffer.canvas;
}
// AE camera: [676,637,-3200], zoom 3200; card anchor [676,764,0].
// Horizontal strips preserve perspective during the original X-axis page fold.
function paintFlipLayer(surface,v,q=ctx,weight=1){
  const [x,y,z,sx,sy,angle,alpha]=v,r=angle*Math.PI/180;
  const line=py=>{const dy=(py-764)*sy/100,depth=z+dy*Math.sin(r),scale=3200/(3200+depth);return [676+(x-676-676*sx/100)*scale,637+(y-637+dy*Math.cos(r))*scale,1352*sx/100*scale];};
  q.save();q.globalAlpha=alpha/100*weight;
  if(Math.abs(angle)<.001){const a=line(0),b=line(764);q.drawImage(surface,a[0],a[1],a[2],b[1]-a[1]);}
  else{const rows=382;for(let row=0;row<rows;row++){const top=row*764/rows,bottom=(row+1)*764/rows,a=line(top),b=line(bottom),mid=line((top+bottom)/2),height=b[1]-a[1];if(height>0)q.drawImage(surface,0,top,1352,bottom-top,mid[0],a[1],mid[2],height+.3);}}
  q.restore();
}
// Keep the two outside blocks fixed and distribute the actual text bounds evenly.
function flipTextLayout(){
  const limits=[385,294,335,230],origins=flipCards.map((card,i)=>['category','title','body'].every(k=>card[k]===flipCopy[i][k])?flipMotion.labelBoxes[i][0]:[8.5,423.5,748,1113][i]);
  ctx.save();
  const widths=flipCards.map((card,i)=>{
    if(['category','title','body'].every(k=>card[k]===flipCopy[i][k]))return flipLabels[i].width;
    ctx.font='26px "Microsoft YaHei",sans-serif';const header=ctx.measureText(card.category+' | '+card.title).width;
    ctx.font='38px "Microsoft YaHei",sans-serif';const body=Math.max(0,...card.body.split(/\r?\n/).slice(0,2).map(line=>ctx.measureText(line).width));
    return Math.min(limits[i],Math.max(header,body));
  });ctx.restore();
  const gap=(origins[3]-origins[0]-widths[0]-widths[1]-widths[2])/3;
  const xs=[origins[0]];for(let i=1;i<4;i++)xs.push(xs[i-1]+widths[i-1]+gap);
  xs[3]=origins[3];return {offsets:xs.map((x,i)=>x-origins[i]),gap};
}
function drawFlip(t){
  if(!flipMotion)return;
  const at=Math.min(9.9999,Math.max(0,t/settings.duration*10)),fit=Math.min(canvas.width/1500,canvas.height/1508);
  ctx.save();ctx.translate((canvas.width-1500*fit)/2,(canvas.height-1508*fit)/2);ctx.scale(fit,fit);
  // Frame 391 reference: original 1352px content centered with a 192px upward offset.
  ctx.translate(74,-192);
  ctx.save();ctx.beginPath();ctx.rect(0,0,1352,1274);ctx.clip();
  const layers=flipMotion.layers.map((l,i)=>({l,i,v:flipSample(l.samples,at)})).filter(o=>at>=o.l.inPoint&&at<o.l.outPoint&&o.v[6]>.01).sort((a,b)=>b.v[2]-a.v[2]||b.i-a.i);
  for(const {l,i,v} of layers){
    const surface=flipSurface(i,l.slot,v[2]);
    if(v[5]>.01&&v[5]<87.99){
      if(!flipBlurCanvas){flipBlurCanvas=document.createElement('canvas');flipBlurCanvas.width=1352;flipBlurCanvas.height=1274;flipShutterCanvas=document.createElement('canvas');flipShutterCanvas.width=1352;flipShutterCanvas.height=1274;}
      const q=flipBlurCanvas.getContext('2d');q.clearRect(0,0,1352,1274);q.globalCompositeOperation='lighter';
      // Match the source's 160-degree, zero-phase shutter at 30 fps.
      const shutter=flipShutterCanvas.getContext('2d');q.globalAlpha=.25;
      for(let n=0;n<4;n++){shutter.clearRect(0,0,1352,1274);paintFlipLayer(surface,flipSample(l.samples,Math.min(9.9999,at+(n+.5)/4*160/360/30)),shutter);q.drawImage(flipShutterCanvas,0,0);}
      ctx.drawImage(flipBlurCanvas,0,0);
    }else paintFlipLayer(surface,v);
  }
  ctx.restore();
  const ui=flipSample(flipMotion.ui,at),layout=flipTextLayout(),stops=[3,420,755,1113];
  let segment=0;while(segment<2&&ui[0]>stops[segment+1])segment++;
  const blend=Math.max(0,Math.min(1,(ui[0]-stops[segment])/(stops[segment+1]-stops[segment])));
  ui[0]+=layout.offsets[segment]*(1-blend)+layout.offsets[segment+1]*blend;
  const accentOpacity=(settings.flipAccentOpacity??100)/100;
  ctx.save();ctx.globalAlpha*=.16;ctx.fillStyle=settings.flipLineColor||'#ffffff';ctx.fillRect(2,1335,1349,3);ctx.restore();ctx.fillStyle=settings.flipAccent||'#ebb300';ctx.fillRect(ui[0],ui[1],180,8);
  const labelImages=flipLabelImages();
  const xs=[8.5,423.5,748,1113],widths=[385,294,335,230];
  flipCards.forEach((card,i)=>{
    ctx.save();ctx.translate(layout.offsets[i],0);ctx.globalAlpha=ui[i+2]/100;
    if(['category','title','body'].every(k=>card[k]===flipCopy[i][k])){
      const im=labelImages[i],[x,y]=flipMotion.labelBoxes[i],header=44;
      // The original two-character category ends before x=60 in every label.
      ctx.save();ctx.globalAlpha*=accentOpacity;ctx.drawImage(im,0,0,60,header,x,y,60,header);ctx.restore();
      ctx.drawImage(im,60,0,im.width-60,header,x+60,y,im.width-60,header);
      ctx.drawImage(im,0,header,im.width,im.height-header,x,y+header,im.width,im.height-header);
    }
    else{
      const x=xs[i],w=widths[i];ctx.textBaseline='top';ctx.font='26px "Microsoft YaHei",sans-serif';ctx.fillStyle=settings.flipAccent||'#ebb300';
      const cat=card.category,tail=' | '+card.title,total=ctx.measureText(cat+tail).width,scale=Math.min(1,w/Math.max(1,total));
      ctx.save();ctx.translate(x,1375);ctx.font=`${26*scale}px "Microsoft YaHei",sans-serif`;const lead=Array.from(cat).slice(0,2).join(''),rest=Array.from(cat).slice(2).join('');ctx.globalAlpha*=.7*accentOpacity;ctx.fillText(lead,0,0);ctx.globalAlpha=ui[i+2]/100*.7;ctx.fillText(rest,ctx.measureText(lead).width,0);ctx.globalAlpha=ui[i+2]/100;ctx.fillText(tail,ctx.measureText(cat).width,0);ctx.restore();
      ctx.fillStyle=settings.flipBodyColor||'#010101';ctx.font='38px "Microsoft YaHei",sans-serif';const lines=card.body.split(/\r?\n/).slice(0,2),widest=Math.max(1,...lines.map(line=>ctx.measureText(line).width));
      // Fit both lines with one font size; maxWidth would distort glyphs horizontally.
      ctx.font=`${38*Math.min(1,w/widest)}px "Microsoft YaHei",sans-serif`;lines.forEach((line,j)=>ctx.fillText(line,x,1430+j*46));
    }ctx.restore();
  });
  ctx.restore();
}
async function saveFlipProject(){
  if(!templateReady.has('flip')||flipCards.some(c=>!c.image))throw Error('请等待翻页素材加载完成。');
  const cards=flipCards.map(c=>({category:c.category,title:c.title,body:c.body,name:c.name,original:!!c.original,kind:mediaKind(c.image),src:embeddedImage(c.image)}));
  downloadBlob(new Blob([JSON.stringify({type:'page-flip-light',version:1,settings,cards,backgroundImage:customBackground})],{type:'application/json'}),'浅色翻页轮播模板.json');notice('翻页模板已保存，包含素材、文案和画面设置。');
}
async function openFlipProject(p){
  const s=p.settings,valid=c=>c&&validMediaSource(c)&&typeof c.name==='string'&&c.name.length<=200;
  if(p.version!==1||!s||!validFrameSettings(s)||!Number.isFinite(s.duration)||s.duration<3||s.duration>18||!/^#[0-9a-f]{6}$/i.test(s.background)||!Array.isArray(p.cards)||p.cards.length!==4||!p.cards.every(c=>valid(c)&&[['category',6],['title',20],['body',48]].every(([k,n])=>typeof c[k]==='string'&&c[k].length<=n))||(p.backgroundImage!=null&&(!valid(p.backgroundImage)||!/^data:image\//.test(p.backgroundImage.src))))throw Error('翻页模板文件或素材无效。');
  if(s.flipLineColor!==undefined&&(typeof s.flipLineColor!=='string'||!/^#[0-9a-f]{6}$/i.test(s.flipLineColor)))throw Error('横线颜色必须是 6 位十六进制色值。');
  if(s.flipBodyColor!==undefined&&(typeof s.flipBodyColor!=='string'||!/^#[0-9a-f]{6}$/i.test(s.flipBodyColor)))throw Error('正文颜色必须是 6 位十六进制色值。');
  if(s.flipAccent!==undefined&&(typeof s.flipAccent!=='string'||!/^#[0-9a-f]{6}$/i.test(s.flipAccent)))throw Error('强调色必须是 6 位十六进制色值。');
  if(s.flipAccentOpacity!==undefined&&(!Number.isFinite(s.flipAccentOpacity)||s.flipAccentOpacity<0||s.flipAccentOpacity>100))throw Error('分类文字透明度必须在 0%–100% 之间。');
  await ensureTemplateAssets('flip');
  const [cards,bg]=await Promise.all([Promise.all(p.cards.map(async c=>({...c,image:await mediaFrom(c.src),original:c.original===true&&c.kind!=='video'}))),p.backgroundImage?imageFrom(p.backgroundImage.src):null]);
  switchTemplate('flip');flipCards=cards;settings={...flipDefaultSettings(),...frameExtras(s),size:s.size,duration:s.duration,background:s.background,flipAccent:(s.flipAccent||'#ebb300').toLowerCase(),flipBodyColor:(s.flipBodyColor||'#010101').toLowerCase(),flipLineColor:(s.flipLineColor||'#ffffff').toLowerCase(),flipAccentOpacity:s.flipAccentOpacity??100};customBackground=p.backgroundImage||null;backgroundImage=bg;time=0;flipSurfaces.forEach(b=>b.key=null);renderFlip();syncBackgroundUI();syncSettings();notice('翻页模板已打开。');
}
