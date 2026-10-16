'use strict';
let frameExportActive=false;

// Convert sRGB bytes to BT.709 limited-range I420. Set matching metadata on
// both the encoder input and MP4, instead of merely relabelling full-range data.
function limitedI420(rgba,width,height){
  const size=width*height,out=new Uint8Array(size*3/2);let uv=0;
  for(let y=0;y<height;y+=2)for(let x=0;x<width;x+=2){
    let red=0,green=0,blue=0;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      const p=(y+dy)*width+x+dx,i=p*4,r=rgba[i],g=rgba[i+1],b=rgba[i+2];
      out[p]=Math.round(16+(219/255)*(.2126*r+.7152*g+.0722*b));
      red+=r;green+=g;blue+=b;
    }
    out[size+uv]=Math.round(128+(224/255)*(-.114572*red-.385428*green+.5*blue)/4);
    out[size+size/4+uv]=Math.round(128+(224/255)*(.5*red-.454153*green-.045847*blue)/4);uv++;
  }
  return out;
}
async function seekExportMedia(t){
  const videos=activeTemplate==='smart'?smartCards.filter(c=>c.kind==='video').map(c=>c.media):activeMediaVideos();
  const mediaTime=activeTemplate==='smart'?Math.min(10.4399,t/settings.duration*10.44):t;
  await Promise.all(videos.map(v=>new Promise((resolve,reject)=>{
    v.pause();const target=mediaTime%v.duration;
    if(!v.seeking&&Math.abs(v.currentTime-target)<.00001){resolve();return;}
    const cleanup=()=>{clearTimeout(timer);v.removeEventListener('seeked',done);v.removeEventListener('error',failed);};
    const done=()=>{if(v.seeking)return;cleanup();resolve();};
    const failed=()=>{cleanup();reject(Error('视频素材定位失败，请重试。'));};
    const timer=setTimeout(failed,10000);v.addEventListener('seeked',done);v.addEventListener('error',failed);v.currentTime=target;
  })));
}
async function exportStandardMp4(isCancelled,options){
  if(typeof VideoEncoder==='undefined'||typeof VideoFrame==='undefined')throw Error('请使用最新版 Chrome 或 Edge 导出兼容 MP4。');
  const {Output,Mp4OutputFormat,MovOutputFormat,WebMOutputFormat,BufferTarget,VideoSampleSource,VideoSample,Quality}=await import('./vendor/mediabunny-1.61.4.mjs');
  const format=options.format==='webm'?new WebMOutputFormat():options.format==='mov'?new MovOutputFormat({fastStart:'in-memory'}):new Mp4OutputFormat({fastStart:'in-memory'});
  const target=new BufferTarget(),output=new Output({format,target});
  const source=new VideoSampleSource({codec:options.format==='webm'?'vp9':'avc',quality:new Quality({bitrate:options.bitrate}),keyFrameInterval:2});
  const fps=options.fps,count=Math.ceil(settings.duration*fps),w=canvas.width,h=canvas.height;
  output.addVideoTrack(source,{frameRate:fps});frameExportActive=true;
  try{
    await output.start();
    for(let n=0;n<count;n++){
      if(isCancelled()){await output.cancel();return null;}
      time=n/fps;await seekExportMedia(time);draw(time);syncTime();
      const pixels=limitedI420(ctx.getImageData(0,0,w,h).data,w,h);
      const frame=new VideoFrame(pixels,{format:'I420',codedWidth:w,codedHeight:h,timestamp:Math.round(n*1e6/fps),duration:Math.round((n+1)*1e6/fps)-Math.round(n*1e6/fps),colorSpace:{primaries:'bt709',transfer:'iec61966-2-1',matrix:'bt709',fullRange:false}});
      const sample=new VideoSample(frame);
      try{await source.add(sample);}finally{sample.close();frame.close();}
      const pc=Math.round((n+1)/count*100);$('exportProgress').value=pc;$('exportMessage').textContent=`正在导出 · ${pc}%`;
      // Let cancellation, progress, and video seek events run between frames.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    await output.finalize();
    if(isCancelled())return null;
    return new Blob([target.buffer],{type:options.format==='webm'?'video/webm':options.format==='mov'?'video/quicktime':'video/mp4'});
  }catch(e){if(output.state!=='finalized'&&output.state!=='canceled')await output.cancel();throw e;}
  finally{frameExportActive=false;pauseTemplateMedia();if(activeTemplate==='smart')pauseSmart();}
}
