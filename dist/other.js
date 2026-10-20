'use strict';
// UI and portable project state for the independently implemented source library.
let otherPreset='',otherOptions={},otherCards=[],otherLogo=null;
let otherLoad=null,otherIsReady=false,otherSetup=false,otherBusy=false;
const otherPresetStates=new Map();
const OTHER_LIMIT=30;
const OTHER_OPTION_RULES={size:[80,700,320],gap:[0,180,32],radius:[0,160,24],tilt:[-60,60,12],depth:[0,800,180],speed:[.25,3,1],textSize:[12,160,48],textX:[0,100,50],textY:[0,100,88],textOpacity:[0,100,100],logoSize:[5,60,15],logoX:[0,100,50],logoY:[0,100,12],logoOpacity:[0,100,100]};
function otherPresetInfo(id=otherPreset){return OTHER_PRESETS.find(p=>p.id===id)||OTHER_PRESETS[0];}
function otherCleanOptions(value={}){
  const result={};for(const [key,[min,max,fallback]] of Object.entries(OTHER_OPTION_RULES))result[key]=Number.isFinite(value[key])?Math.max(min,Math.min(max,value[key])):fallback;
  result.title=typeof value.title==='string'?value.title.slice(0,100):'';
  result.color=typeof value.color==='string'&&/^#[0-9a-f]{6}$/i.test(value.color)?value.color:'#3867e8';
  result.textColor=typeof value.textColor==='string'&&/^#[0-9a-f]{6}$/i.test(value.textColor)?value.textColor:'#ffffff';result.textAlign=['left','center','right'].includes(value.textAlign)?value.textAlign:'center';
  return result;
}
function otherDefaultSettings(){return {size:'1080,1080',duration:Math.max(3,Math.min(30,otherPresetInfo()?.duration||16)),scale:100,contentScale:100,background:'#101014',stack:false};}
function otherPlaceholderCards(count){return otherDemoCards(Math.max(1,Math.min(OTHER_LIMIT,count||6)));}
function otherChanged(message='',render=true){
  invalidateVideo();if(render)renderOther();time=0;draw(time);syncTime();if(message)notice(message);
}
async function ensureOther(){
  if(otherIsReady)return;if(otherLoad)return otherLoad;
  otherLoad=(async()=>{
    const first=otherPresetInfo();if(!first)throw Error('效果目录尚未加载。');
    await ensureOtherDemoImages();
    otherPreset=first.id;otherOptions=otherCleanOptions(first.defaults);
    otherCards=otherPlaceholderCards(first.slots);otherIsReady=true;renderOther();
  })().catch(e=>{otherLoad=null;throw e;});return otherLoad;
}
async function selectOtherPreset(id){
  if(exporting||!OTHER_PRESETS.some(p=>p.id===id))return;
  await ensureOther();if(exporting)return;
  const same=id===otherPreset;
  if(!same){
    const current=activeTemplate==='other'?{settings:{...settings},time,customBackground,backgroundImage}:templateStates.other;
    otherPresetStates.set(otherPreset,{options:{...otherOptions},...(current?{settings:{...current.settings},time:current.time,customBackground:current.customBackground,backgroundImage:current.backgroundImage}:{settings:otherDefaultSettings(),time:0,customBackground:null,backgroundImage:null})});
    otherPreset=id;
  }
  if(activeTemplate!=='other')switchTemplate('other');
  if(!same){
    const saved=otherPresetStates.get(id);
    otherOptions=saved?{...saved.options}:otherCleanOptions(otherPresetInfo(id).defaults);
    settings=saved?{...saved.settings}:otherDefaultSettings();time=saved?saved.time:0;
    customBackground=saved?saved.customBackground:null;backgroundImage=saved?saved.backgroundImage:null;
    if(otherCards.every(c=>c.placeholder))otherCards=otherPlaceholderCards(otherPresetInfo(id).slots);
  }
  invalidateVideo();renderOther();syncBackgroundUI();syncSettings();notice(same?'已选择当前效果，保留编辑参数。':'已切换效果，保留当前素材。');
  if(typeof syncSourcePicker==='function')syncSourcePicker();
  if(typeof renderSourceGallery==='function')renderSourceGallery();
}
function otherNode(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function otherButton(text,handler,className='text-button'){const button=otherNode('button',className,text);button.type='button';button.onclick=handler;return button;}
async function otherImportFiles(files,target=null,replace=false){
  if(exporting||otherBusy||!files.length)return;
  if(files.length>OTHER_LIMIT||(!target&&!replace&&files.length+otherCards.length>OTHER_LIMIT)){notice('最多支持 30 个素材，请减少所选文件。');return;}
  const loaded=[];otherBusy=true;renderOther();
  try{
    for(const f of files)loaded.push({...await importMedia(f,3000),name:f.name.slice(0,200),title:f.name.replace(/\.[^.]+$/,'').slice(0,100),placeholder:false});
    if(exporting){loaded.forEach(c=>c.image.pause?.());return;}
    if(target){if(!otherCards.includes(target)){loaded.forEach(c=>c.image.pause?.());return;}target.image.pause?.();Object.assign(target,loaded[0]);}
    else if(replace){otherCards.forEach(c=>c.image.pause?.());otherCards=loaded;}
    else otherCards.push(...loaded);
    otherChanged('素材已更新，支持图片与无声视频。');
  }catch(e){loaded.forEach(c=>c.image.pause?.());notice(e.message);}
  finally{otherBusy=false;renderOther();}
}
function renderOther(){
  const root=$('otherMaterials');if(!root)return;root.replaceChildren();
  if(!otherIsReady){root.append(otherNode('p','hint','正在加载示例图片…'));return;}
  const heading=otherNode('div','panel-heading'),headingLeft=otherNode('div');headingLeft.append(otherNode('span','step','01'),otherNode('h2','','素材与效果'));heading.append(headingLeft);root.append(heading);
  const info=otherPresetInfo();root.append(otherNode('p','hint',`${info?.name||'选择效果'} · 参考 Animos 动效重建，可替换图片/视频。支持 1–30 个素材。`));
  const actions=otherNode('div','pain-actions');actions.append(otherNode('span','footnote',`${otherCards.length} 个素材${otherBusy?' · 正在读取…':''}`));
  const add=otherButton('添加图片 / 视频',()=>$('otherAddInput').click(),'');add.disabled=otherBusy||otherCards.length>=OTHER_LIMIT;
  const batch=otherButton('批量替换',()=>$('otherBatchInput').click());batch.disabled=otherBusy;actions.append(add,batch);root.append(actions);
  const grid=otherNode('div','pain-cards');
  otherCards.forEach((card,i)=>{
    const wrap=otherNode('div','pain-item'),button=otherButton('',()=>{const input=$('otherReplaceInput');input.otherTarget=card;input.click();},'pain-card');button.disabled=otherBusy;
    const image=otherNode('img');image.src=mediaPoster(card.image,card.src);image.alt=card.name;button.append(image,otherNode('span','',`${i+1} · 替换图片 / 视频`));wrap.append(button);
    const title=otherNode('input');title.type='text';title.maxLength=100;title.value=card.title||'';title.setAttribute('aria-label',`第 ${i+1} 个素材名称`);title.placeholder='素材名称（用于管理）';title.disabled=otherBusy;title.oninput=()=>{card.title=title.value;otherChanged('',false);};wrap.append(title);
    const order=otherNode('div','card-order');
    const move=delta=>{if(exporting||otherBusy)return;const j=i+delta;if(j<0||j>=otherCards.length)return;[otherCards[i],otherCards[j]]=[otherCards[j],otherCards[i]];otherChanged('素材顺序已调整。');};
    const before=otherButton('前移',()=>move(-1)),after=otherButton('后移',()=>move(1)),remove=otherButton('删除',()=>{if(exporting||otherBusy||otherCards.length<=1)return;card.image.pause?.();otherCards.splice(i,1);otherChanged('已删除素材，动画自动适配数量。');});
    before.disabled=otherBusy||i===0;after.disabled=otherBusy||i===otherCards.length-1;remove.disabled=otherBusy||otherCards.length<=1;order.append(before,after,remove);wrap.append(order);grid.append(wrap);
  });root.append(grid);
  root.append(otherNode('p','footnote','素材以本地处理为主，视频不超过 40 MB / 2 分钟；保存模板后可继续编辑。'));
  const controls=otherNode('div','other-controls');
  const labels={size:'卡片尺寸',gap:'卡片间距',radius:'圆角',tilt:'倾斜角度',depth:'空间纵深',speed:'运动速度',textSize:'文字字号',textX:'文字水平位置 %',textY:'文字垂直位置 %',textOpacity:'文字不透明度 %',logoSize:'Logo 宽度 %',logoX:'Logo 水平位置 %',logoY:'Logo 垂直位置 %',logoOpacity:'Logo 不透明度 %'};
  for(const [key,[min,max]] of Object.entries(OTHER_OPTION_RULES)){
    if(key.startsWith('logo')&&!otherLogo)continue;
    const row=otherNode('div','range-label'),label=otherNode('label','',labels[key]),value=otherNode('output','',String(otherOptions[key]));
    const input=otherNode('input');input.type='range';input.min=min;input.max=max;input.step=key==='speed'?'.05':'1';input.value=otherOptions[key];input.id=`otherOption-${key}`;label.htmlFor=input.id;
    input.oninput=()=>{otherOptions[key]=Number(input.value);value.textContent=key==='speed'?otherOptions[key].toFixed(2)+'×':input.value;otherChanged('',false);};row.append(label,value);controls.append(row,input);
  }
  const titleLabel=otherNode('label','field','画面主标题'),title=otherNode('input');title.type='text';title.maxLength=100;title.value=otherOptions.title;title.oninput=()=>{otherOptions.title=title.value;otherChanged('',false);};titleLabel.append(title);controls.append(titleLabel);
  const colorLabel=otherNode('label','field','强调颜色'),colorRow=otherNode('div','flip-color-controls'),picker=otherNode('input'),hex=otherNode('input');picker.type='color';picker.value=otherOptions.color;hex.type='text';hex.maxLength=7;hex.value=otherOptions.color.toUpperCase();hex.setAttribute('aria-label','效果强调色色值');
  const setColor=value=>{if(!/^#[0-9a-f]{6}$/i.test(value))return;otherOptions.color=value.toLowerCase();picker.value=value;hex.value=value.toUpperCase();otherChanged('',false);};picker.oninput=()=>setColor(picker.value);hex.onchange=()=>{const value=hex.value.startsWith('#')?hex.value:'#'+hex.value;if(/^#[0-9a-f]{6}$/i.test(value))setColor(value);else{hex.value=otherOptions.color.toUpperCase();notice('请输入六位十六进制色值，例如 #3867E8。');}};colorRow.append(picker,hex);colorLabel.append(colorRow);controls.append(colorLabel);
  controls.append(otherButton('恢复效果参数',()=>{if(exporting)return;otherOptions=otherCleanOptions(otherPresetInfo().defaults);otherChanged('已恢复当前效果参数。');}));root.append(controls);
  const textColorLabel=otherNode('label','field','文字颜色'),textColorRow=otherNode('div','flip-color-controls'),textPicker=otherNode('input'),textHex=otherNode('input');textPicker.type='color';textPicker.value=otherOptions.textColor;textHex.type='text';textHex.maxLength=7;textHex.value=otherOptions.textColor.toUpperCase();textHex.setAttribute('aria-label','文字颜色色值');
  const setTextColor=value=>{if(!/^#[0-9a-f]{6}$/i.test(value))return;otherOptions.textColor=value.toLowerCase();textPicker.value=value;textHex.value=value.toUpperCase();otherChanged('',false);};textPicker.oninput=()=>setTextColor(textPicker.value);textHex.onchange=()=>{const next=textHex.value.startsWith('#')?textHex.value:'#'+textHex.value;if(/^#[0-9a-f]{6}$/i.test(next))setTextColor(next);else textHex.value=otherOptions.textColor.toUpperCase();};textColorRow.append(textPicker,textHex);textColorLabel.append(textColorRow);controls.append(textColorLabel);
  const alignLabel=otherNode('label','field','文字对齐'),align=otherNode('select');for(const [value,name] of [['left','左对齐'],['center','居中'],['right','右对齐']])align.append(new Option(name,value));align.value=otherOptions.textAlign;align.onchange=()=>{otherOptions.textAlign=align.value;otherChanged('',false);};alignLabel.append(align);controls.append(alignLabel);
  const logoRow=otherNode('div','trail-upload');if(otherLogo){const image=otherNode('img');image.src=otherLogo.src;image.alt=otherLogo.name;logoRow.append(image);}const logoActions=otherNode('div');logoActions.append(otherButton(otherLogo?'替换透明 PNG Logo':'上传透明 PNG Logo',()=>$('otherLogoInput').click(),''));if(otherLogo)logoActions.append(otherButton('清除 Logo',()=>{if(exporting)return;otherLogo=null;otherChanged('已清除 Logo。');}));logoRow.append(logoActions);controls.append(logoRow);
}
function setupOther(){
  if(otherSetup)return;otherSetup=true;
  for(const [id,multiple] of [['otherAddInput',true],['otherBatchInput',true],['otherReplaceInput',false]]){
    const input=otherNode('input');input.type='file';input.id=id;input.hidden=true;input.multiple=multiple;input.accept='image/png,image/jpeg,image/webp,video/mp4,video/webm';document.body.append(input);
    input.onchange=()=>{const files=[...input.files],target=input.otherTarget;input.value='';input.otherTarget=null;otherImportFiles(files,target,id==='otherBatchInput');};
  }
  const logoInput=otherNode('input');logoInput.type='file';logoInput.id='otherLogoInput';logoInput.hidden=true;logoInput.accept='image/png,.png';document.body.append(logoInput);logoInput.onchange=async()=>{const file=logoInput.files[0];logoInput.value='';if(!file||exporting)return;try{if(file.type!=='image/png')throw Error('请选择透明 PNG 图片。');const value=await importImage(file,1600);if(exporting)return;otherLogo={image:value.image,src:value.src,name:file.name.slice(0,200)};otherChanged('Logo 已替换。');}catch(e){notice(e.message);}};
}
async function saveOtherProject(){
  await ensureOther();if(otherBusy)throw Error('素材正在读取，请完成后再保存。');
  const content=otherCards.map(c=>({name:c.name,title:c.title||'',kind:mediaKind(c.image),src:embeddedImage(c.image)}));
  const project={type:'other-motion',version:1,preset:otherPreset,options:otherCleanOptions(otherOptions),settings:{...settings},cards:content,backgroundImage:customBackground,logo:otherLogo?{src:otherLogo.src,name:otherLogo.name}:null};
  downloadBlob(new Blob([JSON.stringify(project)],{type:'application/json'}),`其他来源-${otherPresetInfo().name}.json`);notice('其他来源模板已保存，包含效果参数、素材与画面设置。');
}
async function openOtherProject(p){
  const s=p.settings;
  const validAsset=c=>c&&typeof c.name==='string'&&c.name.length<=200&&validMediaSource(c);
  const validCard=c=>validAsset(c)&&typeof c.title==='string'&&c.title.length<=100&&['image','video'].includes(c.kind);
  const validOptions=p.options&&typeof p.options==='object'&&!Array.isArray(p.options)&&Object.entries(OTHER_OPTION_RULES).every(([key,[min,max]])=>Number.isFinite(p.options[key])&&p.options[key]>=min&&p.options[key]<=max)&&typeof p.options.title==='string'&&p.options.title.length<=100&&['color','textColor'].every(k=>typeof p.options[k]==='string'&&/^#[0-9a-f]{6}$/i.test(p.options[k]))&&['left','center','right'].includes(p.options.textAlign);
  if(p.type!=='other-motion'||p.version!==1||!OTHER_PRESETS.some(x=>x.id===p.preset)||!s||!validFrameSettings(s)||!Number.isFinite(s.duration)||s.duration<3||s.duration>30||typeof s.background!=='string'||!/^#[0-9a-f]{6}$/i.test(s.background)||!validOptions||!Array.isArray(p.cards)||p.cards.length<1||p.cards.length>OTHER_LIMIT||!p.cards.every(validCard)||(p.logo!=null&&(!validAsset(p.logo)||!/^data:image\/png;base64,/.test(p.logo.src)))||(p.backgroundImage!=null&&(!validAsset(p.backgroundImage)||!/^data:image\/(png|jpeg|webp);base64,/.test(p.backgroundImage.src))))throw Error('其他来源模板参数或素材无效。');
  await ensureTemplateAssets('other');const loaded=[];
  try{
    for(const card of p.cards)loaded.push({name:card.name,title:card.title,src:card.src,kind:card.kind,image:await mediaFrom(card.src)});
    const background=p.backgroundImage?await imageFrom(p.backgroundImage.src):null;
    const logo=p.logo?{src:p.logo.src,name:p.logo.name,image:await imageFrom(p.logo.src)}:null;
    if(exporting)throw Error('正在导出，请完成后再打开模板。');
    switchTemplate('other');otherCards.forEach(c=>c.image.pause?.());otherCards=loaded;otherPreset=p.preset;otherOptions=otherCleanOptions(p.options);otherLogo=logo;
    settings={...otherDefaultSettings(),...frameExtras(s),size:s.size,duration:s.duration,background:s.background};customBackground=p.backgroundImage?{name:p.backgroundImage.name,src:p.backgroundImage.src}:null;backgroundImage=background;time=0;
    renderOther();syncBackgroundUI();syncSettings();if(typeof syncSourcePicker==='function')syncSourcePicker();if(typeof renderSourceGallery==='function')renderSourceGallery();notice('其他来源模板已打开。');
  }catch(e){loaded.forEach(c=>c.image.pause?.());throw e;}
}
