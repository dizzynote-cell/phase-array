'use strict';
const mixBus=ctx.createAnalyser();
mixBus.fftSize=16384;
mixBus.connect(ctx.destination);
const bins=new Uint8Array(mixBus.frequencyBinCount);
const amplitude=new Float32Array(mixBus.fftSize);
const stage=$('stage'), pen=stage.getContext('2d'), meter=$('meter').getContext('2d');
const panel=$('videoPanel');
let recorder=null, waves=[], videoStart=0, videoEnd=0, mixStream=null, timer=0;
function spectrum(g,x,y,w,h){
 const bars=192;
 const floating=document.body.classList.contains('tech');
 const blockHeight=Math.max(2,Math.round(h*.055));
 g.fillStyle=floating?studioColor.colors.accent:'#5ecbf4';
 for(let i=0;i<bars;i++){
  const bin=k=>Math.min(bins.length-1,Math.floor(30*600**(k/bars)*mixBus.fftSize/ctx.sampleRate));
  let peak=0;for(let j=bin(i);j<=bin(i+1);j++)peak=Math.max(peak,bins[j]);
  const height=Math.max(2,h*peak/255);
  const markHeight=floating?blockHeight:height;
  const top=y+h-Math.max(height,markHeight);
  g.fillRect(x+w*i/bars,top,w/bars*.72,markHeight);
 }
}
// Store signed extrema for short sample blocks. Scan individual samples at zoomed-in scales.
const peakCache=new WeakMap();
function recordingPeaks(buffer){
 if(peakCache.has(buffer))return peakCache.get(buffer);
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
 const block=32,count=Math.ceil(buffer.length/block),low=new Float32Array(count),high=new Float32Array(count);
 for(const data of channels){
  for(let i=0;i<count;i++){
   let min=low[i],max=high[i];const end=Math.min(data.length,(i+1)*block);
   for(let n=i*block;n<end;n++){const sample=data[n];if(sample<min)min=sample;if(sample>max)max=sample}
   low[i]=min;high[i]=max
  }
 }
 const peaks={channels,low,high,block,rate:buffer.sampleRate,size:buffer.length};peakCache.set(buffer,peaks);return peaks
}
function waveTile(c,peaks,h,px,start,width,heightScale,color){
 const tile=document.createElement("canvas");tile.width=width;tile.height=Math.ceil(h);const brush=tile.getContext("2d");
 const {low,high,block,rate,size,channels}=peaks;
 const gain=10**(c.gain/20)*heightScale,[fi,fo]=fadeTimes(c);
 const half=h*.31,center=h*.64,len=length(c),samplesPerPixel=rate*c.speed/px;
 brush.fillStyle=color;
 for(let col=0;col<width;col++){
  const t=(col+start)/px,first=Math.min(size-1,Math.floor((c.begin+t*c.speed)*rate));
  const end=Math.min(size,Math.ceil(c.end*rate),first+Math.ceil(samplesPerPixel));
  let min=0,max=0;
  if(samplesPerPixel<block){
   for(const data of channels)for(let i=first;i<end;i++){min=Math.min(min,data[i]);max=Math.max(max,data[i])}
  }else{
   for(let i=Math.floor(first/block);i<Math.ceil(end/block);i++){min=Math.min(min,low[i]);max=Math.max(max,high[i])}
  }
  const scale=gain*Math.min(1,fi?t/fi:1,fo?(len-t)/fo:1);
  const top=Math.round(center-half*Math.min(1,max*scale)),bottom=Math.round(center-half*Math.max(-1,min*scale));
  brush.fillRect(col,top,1,Math.max(1,bottom-top))
 }
 return tile
}
const waveTiles=new Map();
function drawRecordingWave(c,peaks,x,y,w,h,px,left,right){
 const heightScale=parseFloat($('waveHeight').value);
 const color=document.body.classList.contains('tech')?studioColor.wave():'#56b9e9';
 const tileWidth=512;
 const first=Math.max(0,Math.floor((left-x)/tileWidth)*tileWidth);
 for(let start=first;start<Math.min(w,right-x);start+=tileWidth){
  const key=[c.id,px,heightScale,h,color,start].join('/');
  let tile=waveTiles.get(key);
  if(!tile){
   tile=waveTile(c,peaks,h,px,start,Math.min(tileWidth,Math.ceil(w-start)),heightScale,color);
   if(waveTiles.size>=128)waveTiles.delete(waveTiles.keys().next().value);
   waveTiles.set(key,tile)
  }
  pen.drawImage(tile,Math.round(x)+start,Math.round(y))
 }
}
function drawStage(time){
 const left=196,right=1872,top=139,bottom=872,anchor=left+(right-left)*.34;
 const px=(right-left)/Number($('windowTime').value),map=t=>anchor+(t-time)*px;
 const row=(bottom-top)/Math.max(7,tracks.length);
 function rect(x,y,w,h,color){pen.fillStyle=color;pen.fillRect(x,y,w,h)}
 function label(text,x,y,size,color,max=1800){pen.font=size+'px "Segoe UI", sans-serif';pen.fillStyle=tech?(size>=30?studioColor.colors.ink:size>=20?studioColor.colors.accent:studioColor.colors.secondary):color;pen.fillText(text,x,y,max)}
 const tech=document.body.classList.contains('tech');rect(0,0,1920,1080,tech?'#050607':'#10171c');if(tech){for(let i=0;i<tracks.length;i++)rect(48,top+i*row,right-48,row-2,i%2?'transparent':studioColor.colors.lane);}
 // Compact signal mark and title are drawn directly into the recorded frame.
 const titleColor=tech?studioColor.colors.accent:'#85daff';
 [10,22,34,18,9].forEach((height,i)=>rect(48+i*6,53-height/2,3,height,titleColor));
 label('PHASE ARRAY',94,64,30,'#c1dce8');label(stamp(time),1630,65,34,'#85daff');
 pen.save();pen.beginPath();pen.rect(left,89,right-left,bottom-89);pen.clip();
 const step=Number($('windowTime').value)/8;
 for(let t=Math.max(0,Math.floor((time-(anchor-left)/px)/step)*step);map(t)<right;t+=step){
  const x=map(t);rect(x,125,1,bottom-125,tech?studioColor.colors.grid:'#36444d');label((step<1?stamp(t):stamp(t).slice(0,5)),x+7,117,19,'#859da9')
 }
 const solo=tracks.some(t=>t.solo);
 for(const {c,peaks,index} of waves){
  const x=map(c.at),w=length(c)*px,y=top+index*row+4,h=row-8;
  if(x+w<left||x>right)continue;
  const t=tracks[index];pen.globalAlpha=t.mute||(solo&&!t.solo)?.4:1;
  rect(x,y,w,h,tech?(c.fx?studioColor.colors.fx:studioColor.colors.fill):(c.fx?'#4c395e':'#203d4c'));rect(x,y,2,h,tech?studioColor.colors.edge:'#6ac9f2');
  drawRecordingWave(c,peaks,x,y,w,h,px,left,right);
  if(w>20)label(c.name,Math.max(x,left)+8,y+Math.min(22,h*.26),Math.min(18,h*.25),'#98d9f7',Math.max(1,x+w-Math.max(x,left)-10));
 }
 pen.globalAlpha=1;pen.restore();
 tracks.forEach((t,i)=>{const y=top+i*row;rect(48,y,right-48,1,tech?studioColor.colors.grid:'#324049');label(String(i+1).padStart(2,'0'),52,y+row*.48,Math.min(23,row*.32),'#68caff');label(trackLabel(t),89,y+row*.48,Math.min(17,row*.26),'#abc3cf',99)});
 rect(anchor,125,2,bottom-125,tech?studioColor.colors.accent:'#ffb16b');rect(anchor-5,124,12,7,tech?studioColor.colors.accent:'#ffb16b');
 label(tech?'SPECTRUM':'混音频谱',50,938,23,'#b7ced8');label('30 Hz',50,1017,18,'#77929f');label('18 kHz',1790,1017,18,'#77929f');spectrum(pen,196,913,1560,105);
}
function animate(){
 if(running)mixBus.getByteFrequencyData(bins);else bins.fill(0);
 if(running&&document.body.classList.contains('tech'))mixBus.getFloatTimeDomainData(amplitude);
 studioColor.follow(amplitude,running);
 if(!panel.open){meter.clearRect(0,0,1280,48);spectrum(meter,0,0,1280,48)}
 if(panel.open)drawStage(recorder?Math.min(videoEnd,ctx.currentTime-origin):Number($('from').value)||0);
 requestAnimationFrame(animate)
}
animate();
$('video').onclick=()=>{
 if(!duration())return note('请先导入音频');
 stop();waveTiles.clear();waves=clips.map(c=>({c,peaks:recordingPeaks(buffers.get(c.asset)),index:tracks.findIndex(t=>t.id===c.track)}));
 $('from').value=0;$('until').value=duration();$('videoStatus').textContent='';panel.showModal()
};
function lockRecording(locked){for(const id of ['closeVideo','from','until','videoFps'])$(id).disabled=locked}
function release(){
 clearTimeout(timer);stop();if(mixStream){mixBus.disconnect(mixStream);mixStream.stream.getTracks().forEach(t=>t.stop());mixStream=null}
 recorder=null;lockRecording(false);$('record').disabled=false;$('record').textContent='开始录像';cursor()
}
function finish(){if(recorder?.state==='recording'){recorder.stop();stop();$('record').disabled=true}}
$('closeVideo').onclick=()=>panel.close();panel.oncancel=e=>{if(recorder)e.preventDefault()};
$('record').onclick=async()=>{
 if(recorder)return finish();
 videoStart=$('from').valueAsNumber;videoEnd=$('until').valueAsNumber;
 const msg=$('videoStatus');
 if(!(videoStart>=0&&videoEnd>videoStart&&videoEnd<=duration())){msg.textContent='请选择工程内有效的起止时间';return}
 let stream;
 try{
  $('record').disabled=true;lockRecording(true);await ctx.resume();
  const fps=Number($('videoFps').value);
  const mime=[fps===60?'video/mp4;codecs=avc1.42E02A,mp4a.40.2':'video/mp4;codecs=avc1.42E028,mp4a.40.2','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime)throw Error('当前浏览器缺少可用的视频编码器');
  drawStage(videoStart);stream=stage.captureStream(fps);mixStream=ctx.createMediaStreamDestination();mixBus.connect(mixStream);stream.addTrack(mixStream.stream.getAudioTracks()[0]);
  const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:fps===60?14000000:8000000});recorder=rec;
  const chunks=[];let failed=false;rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  rec.onerror=()=>{failed=true;msg.textContent='录像中断，请重试'};
  rec.onstop=()=>{if(!failed&&chunks.length){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(chunks,{type:mime}));a.download='Phase Array.'+(mime.startsWith('video/mp4')?'mp4':'webm');a.click();setTimeout(()=>URL.revokeObjectURL(a.href),60000);msg.textContent='录像已导出'}
   stream.getTracks().forEach(t=>t.stop());release()
  };
  origin=schedule(ctx,videoStart,true)-videoStart;running=true;rec.start(1000);$('record').disabled=false;$('record').textContent='结束并保存';msg.textContent='正在录像';timer=setTimeout(finish,Math.max(0,1000*(videoEnd+origin-ctx.currentTime)));
 }catch(e){stream?.getTracks().forEach(t=>t.stop());release();msg.textContent='录像失败：'+e.message}
};






