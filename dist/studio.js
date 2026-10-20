'use strict';
const EXISTING_TEMPLATES=[
 {id:'cards',name:'课程卡片轮播1',description:'课程卡片 · AE 原工程',asset:'assets/card-0.png'},
 {id:'plain',name:'长图横向滚动',description:'横向平移 · 长图展示',asset:'assets/plain-long.webp'},
 {id:'pain',name:'痛点轮播',description:'进度联动 · 毛玻璃 UI',asset:'assets/pain-0.webp'},
 {id:'buyer',name:'买家秀轮播',description:'用户实景 · 多画面',asset:'assets/buyer-0.webp'},
 {id:'body',name:'左右移轴对比',description:'双图对比 · 移轴切换',asset:'assets/body-0.webp'},
 {id:'smart',name:'课程卡片轮播2',description:'动态卡片 · 图片与视频',asset:'assets/smart-poster-0.jpg'},
 {id:'flip',name:'浅色翻页轮播',description:'翻页叠层 · 文案联动',asset:'assets/flip-card-0.webp'}
];
let lastExistingTemplate='cards',studioGalleryKey='',studioThumbObserver=null,studioThumbFrame=0;
const studioThumbnailCache=new Map();
function syncSourcePicker(){
 const other=activeTemplate==='other';
 if(!other)lastExistingTemplate=activeTemplate;
 $('templateSource').value=other?'other':'existing';
 const optionMode=$('templateMode');
 if(![...optionMode.options].some(o=>o.value==='other'))optionMode.add(new Option('其他来源动效','other'));
 optionMode.value=activeTemplate;
 const title=other?otherPresetInfo().name:EXISTING_TEMPLATES.find(t=>t.id===activeTemplate)?.name||'视频模板';
 $('activeTemplateName').textContent=title;$('projectTitle').textContent=title;
 $('sourceDescription').textContent=other?'参考 Animos · 9 组动效模板':'基于你的 AE 工程 · 7 个常用模板';
 document.querySelectorAll('.template-tile').forEach(el=>{
  const selected=other?el.dataset.preset===otherPreset:el.dataset.mode===activeTemplate;
  el.classList.toggle('is-selected',selected);el.setAttribute('aria-pressed',String(selected));
 });
}
function renderSourceGallery(){
 const source=$('templateSource').value,query=$('templateSearch').value.trim().toLowerCase(),key=source+'|'+query;
 syncSourcePicker();
 if(studioGalleryKey===key)return;studioGalleryKey=key;
 studioThumbObserver?.disconnect();
 const gallery=$('templateGallery');gallery.replaceChildren();
 const candidates=source==='other'?OTHER_PRESETS:EXISTING_TEMPLATES;
 const list=candidates.filter(p=>[p.name,p.englishName,p.description,p.group].filter(Boolean).join(' ').toLowerCase().includes(query));
 $('libraryCount').textContent=list.length+' 个';
 if(!list.length){const empty=document.createElement('p');empty.className='library-empty';empty.textContent='没有匹配的模板，试试其他关键词。';gallery.append(empty);return;}
 const groups=[...new Set(list.map(p=>source==='other'?p.group:'现有页面'))];

 for(const group of groups){
  const section=document.createElement('details');section.className='library-group';section.open=true;
  const items=list.filter(p=>(source==='other'?p.group:'现有页面')===group),summary=document.createElement('summary');summary.textContent=group+' · '+items.length;
  const grid=document.createElement('div');grid.className='template-grid';
  for(const p of items){
   const button=document.createElement('button');button.type='button';button.className='template-tile';button.title=p.description||p.name;
   const thumb=document.createElement('canvas');thumb.width=180;thumb.height=136;thumb.className='template-thumb';thumb.setAttribute('aria-hidden','true');
   if(source==='other'){button.dataset.preset=p.id;thumb.dataset.preset=p.id;}else{button.dataset.mode=p.id;thumb.dataset.mode=p.id;}
   const name=document.createElement('span');name.className='tile-name';name.textContent=p.name;
   const sub=document.createElement('span');sub.className='tile-subtitle';sub.textContent=source==='other'?p.englishName||'动态展示':p.description;
   button.setAttribute('aria-label',p.name+(source==='other'?' · '+(p.englishName||''):''));button.append(thumb,name,sub);
   button.onclick=()=>{if(exporting)return;if(source==='other')selectOtherPreset(p.id);else switchTemplate(p.id);syncSourcePicker();};
   grid.append(button);
  }
  section.append(summary,grid);gallery.append(section);
 }
 syncSourcePicker();scheduleStudioThumbnails();
}
function scheduleStudioThumbnails(){
 if(studioThumbFrame)return;studioThumbFrame=requestAnimationFrame(()=>{studioThumbFrame=0;if($('templateSource').value==='other'&&!otherDemoImages.length){ensureOtherDemoImages().then(scheduleStudioThumbnails).catch(()=>notice('预览图片加载失败，请切换分类后重试。'));return;}const bounds=$('templateLibrary').getBoundingClientRect();for(const target of document.querySelectorAll('.template-thumb')){if(target.dataset.ready)continue;const r=target.getBoundingClientRect();if(!r.height||r.bottom<bounds.top-100||r.top>bounds.bottom+150)continue;const key=target.dataset.preset||target.dataset.mode;if(studioThumbnailCache.has(key)){target.getContext('2d').drawImage(studioThumbnailCache.get(key),0,0);target.dataset.ready='1';continue;}if(target.dataset.preset){drawOtherThumbnail(target,key);const cached=document.createElement('canvas');cached.width=target.width;cached.height=target.height;cached.getContext('2d').drawImage(target,0,0);studioThumbnailCache.set(key,cached);}else drawExistingThumbnail(target,key);target.dataset.ready='1';}});
}
function drawExistingThumbnail(target,mode){
 const c=target.getContext('2d');c.fillStyle='#15171e';c.fillRect(0,0,target.width,target.height);
 const im=new Image();im.onload=()=>{const ratio=Math.max(target.width/im.width,target.height/im.height);c.save();c.beginPath();c.roundRect(7,7,target.width-14,target.height-14,8);c.clip();c.drawImage(im,(target.width-im.width*ratio)/2,(target.height-im.height*ratio)/2,im.width*ratio,im.height*ratio);c.restore();};im.src=EXISTING_TEMPLATES.find(t=>t.id===mode).asset;
}
function setStudioTheme(theme){
 document.documentElement.dataset.theme=theme;document.body.dataset.theme=theme;
 $('themeToggle').textContent=theme==='dark'?'☀':'☾';$('themeToggle').setAttribute('aria-label',theme==='dark'?'切换为浅色主题':'切换为深色主题');
 $('themeToggle').title=theme==='dark'?'切换为浅色主题':'切换为深色主题';
 try{localStorage.setItem('studio-theme',theme);}catch(e){}
}
function setupStudio(){
 setStudioTheme(document.documentElement.dataset.theme||'dark');
 $('themeToggle').onclick=()=>setStudioTheme(document.body.dataset.theme==='dark'?'light':'dark');
 $('templateSource').onchange=()=>{if(exporting)return;$('templateSearch').value='';studioGalleryKey='';if($('templateSource').value==='other'){switchTemplate('other');renderOther();}else switchTemplate(lastExistingTemplate);syncSourcePicker();renderSourceGallery();};
 $('templateSearch').oninput=renderSourceGallery;
 $('templateGallery').addEventListener('scroll',scheduleStudioThumbnails,{passive:true});$('templateLibrary').addEventListener('scroll',scheduleStudioThumbnails,{passive:true});$('templateGallery').addEventListener('toggle',scheduleStudioThumbnails,true);window.addEventListener('resize',scheduleStudioThumbnails);
 setupQuickFrame();syncSourcePicker();renderSourceGallery();
}
function drawOtherOverlays(t){
 const o=otherOptions,w=canvas.width,h=canvas.height,fit=Math.min(w,h)/1080;
 if(o.title){ctx.save();ctx.globalAlpha=(o.textOpacity??100)/100;ctx.fillStyle=o.textColor||'#ffffff';ctx.textAlign=o.textAlign||'center';ctx.textBaseline='middle';ctx.font=`600 ${(o.textSize||48)*fit}px "Microsoft YaHei",sans-serif`;const lines=String(o.title).split('\n').slice(0,6);lines.forEach((line,i)=>ctx.fillText(line,w*(o.textX??50)/100,h*(o.textY??88)/100+i*(o.textSize||48)*fit*1.3));ctx.restore();}
 if(typeof otherLogo!=='undefined'&&otherLogo?.image){const im=otherLogo.image,z=w*(o.logoSize??15)/100/im.width;ctx.save();ctx.globalAlpha=(o.logoOpacity??100)/100;ctx.drawImage(im,w*(o.logoX??50)/100-im.width*z/2,h*(o.logoY??12)/100-im.height*z/2,im.width*z,im.height*z);ctx.restore();}
}

function setupQuickFrame(){
 const list=[['1920,1080','16:9'],['1440,1080','4:3'],['1080,1080','1:1'],['1080,1350','4:5'],['1080,1440','3:4'],['1080,1920','9:16']];
 const root=$('quickFrameRatios');root.replaceChildren();
 for(const [size,label] of list){const b=document.createElement('button');b.type='button';b.dataset.size=size;b.setAttribute('aria-label','画面比例 '+label);const icon=document.createElement('span');icon.className='frame-icon';const [w,h]=size.split(',').map(Number);icon.style.width=(w>=h?22:22*w/h)+'px';icon.style.height=(h>=w?22:22*h/w)+'px';b.append(icon,document.createTextNode(label));b.onclick=()=>{if(exporting)return;settings.size=size;settings.customSize=false;syncSettings();invalidateVideo();};root.append(b);}
 $('defaultFrame').onclick=()=>{if(exporting)return;settings.size=$('size').options[0].value;settings.customSize=false;syncSettings();};
 $('customFrameChoice').onclick=()=>{if(exporting)return;$('size').value='custom';$('customFrame').hidden=false;syncQuickFrame();$('frameWidth').focus();};
 syncQuickFrame();
}
function syncQuickFrame(){
 if(!$('quickFrameDimensions'))return;
 $('quickFrameDimensions').textContent=settings.size.replace(',',' × ');
 const custom=!$('customFrame').hidden,defaultSize=$('size').options[0]?.value;
 document.querySelectorAll('#quickFrameRatios button').forEach(b=>{const selected=!custom&&b.dataset.size===settings.size&&settings.size!==defaultSize;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));});
 $('defaultFrame').setAttribute('aria-pressed',String(!custom&&settings.size===defaultSize));$('defaultFrame').title='模板默认 · '+(defaultSize||'').replace(',',' × ');
 $('customFrameChoice').setAttribute('aria-pressed',String(custom));$('customFrameChoice').setAttribute('aria-expanded',String(custom));
}
