'use strict';
function fadeTimes(c){
 const len=length(c),a=c.fadeIn||0,b=c.fadeOut||0,f=Math.min(1,len/(a+b||1));
 return [a*f,b*f]
}
function applyEnvelope(c,param,time,offset){
 const [a,b]=fadeTimes(c),len=length(c),gain=10**(c.gain/20);
 if(!a&&!b)return;
 const value=t=>gain*Math.max(0,Math.min(1,a?t/a:1,b?(len-t)/b:1));
 param.setValueAtTime(value(offset),time);
 for(const t of [a,len-b,len])if(t>offset)param.linearRampToValueAtTime(value(t),time+t-offset)
}
function fadeHandles(box,c){
 for(const [key,side] of [['fadeIn','left'],['fadeOut','right']]){
  const knob=el('div','fadeKnob '+side,box);knob.title=key==='fadeIn'?'Fade in · Drag':'Fade out · Drag';
  const seconds=fadeTimes(c)[side==='left'?0:1];knob.style[side]=Math.max(0,seconds*scale-5)+'px';
  knob.onpointerdown=e=>{
   e.stopPropagation();e.preventDefault();knob.setPointerCapture(e.pointerId);remember();selected=c.id;
   const initial=e.clientX,other=fadeTimes(c)[side==='left'?1:0];
   knob.onpointermove=v=>{c[key]=Math.min(length(c)-other,Math.max(0,seconds+(v.clientX-initial)/scale*(side==='left'?1:-1)));knob.style[side]=Math.max(0,c[key]*scale-5)+'px';note((side==='left'?'Fade in ':'Fade out ')+c[key].toFixed(2)+' s')};
   knob.onpointerup=knob.onpointercancel=()=>{knob.onpointermove=null;refresh()}
  };knob.onclick=e=>e.stopPropagation()
 }
}
const presets=[
 ['combo','上升 → 留白 → 切入','Rise / Break / Drop'],['noise','白噪声上升','Noise Riser'],['pitch','音高爬升','Pitch Riser'],['snare','军鼓滚奏','Snare Roll'],
 ['sweep','滤波扫频','Filter Sweep'],['loop','循环缩短','Loop Roll'],['gate','节奏门控','Rhythmic Gate'],['echo','回声退出','Echo Out'],['wash','混响转场','Reverb Wash'],['brake','停盘','Tape Stop'],['silence','落拍前留白','Pre-drop Silence'],['fadeIn','渐强','Fade In'],['fadeOut','渐弱','Fade Out']
];
const isTech=()=>document.body.classList.contains('tech');
function presetMenu(){const pick=$('preset'),value=pick.value;pick.replaceChildren();for(const [id,zh,en] of presets){const opt=el('option','',pick,isTech()?en:zh);opt.value=id}pick.value=value||'combo'}
const sourceTypes=['sweep','loop','gate','echo','wash','brake'];
function placement(){
 const id=$('preset').value,d=Number($('fxLength').value),bpm=Number($('bpm').value),c=current(),beat=60/bpm;
 if(!Number.isFinite(d)||d<.1||d>60||!Number.isFinite(bpm)||bpm<40||bpm>300)throw Error('Length 0.1–60 s · BPM 40–300');
 if(sourceTypes.includes(id)||id.startsWith('fade')){
  if(!c)throw Error(isTech()?'Select a source clip':'请先选中声音片段');
  const start=pos>=c.at&&pos<c.at+length(c)-.001?pos:c.at;
  return {id,c,beat,start,d:Math.min(d,c.at+length(c)-start)}
 }
 if(['combo','silence'].includes(id)){
  if(pos<=.001)throw Error(isTech()?'Click the drop point on the timeline first':'先在时间线上点击下一段进入的落点');
  return {id,beat,start:Math.max(0,pos-d),d:Math.min(d,pos)}
 }
 return {id,beat,start:pos,d}
}
function hint(){try{const {id,start,d}=placement(),en=isTech();$('fxHint').textContent=id.startsWith('fade')?(en?'Drag either top corner to adjust the fade.':'渐变作用于选中片段的边缘，也可拖动波形上方两端的手柄。'):(stamp(start)+' — '+stamp(start+d)+'　'+(id==='combo'||id==='silence'?(en?'Silence affects all tracks before the drop.':'落点前的留白作用于全部音轨。'):sourceTypes.includes(id)?(en?'Move the processed region to an FX track.':'将选中素材的这段声音处理后移入 FX 轨。'):(en?'Insert on a separate FX track.':'在独立 FX 轨上添加片段。')))}catch(e){$('fxHint').textContent=e.message}}
function cutRange(start,end,target=null){
 clips=clips.flatMap(c=>{
  const tail=c.at+length(c);
  if((target&&c!==target)||c.at>=end||tail<=start)return [c];
  const parts=[];
  if(c.at<start)parts.push({...c,end:c.begin+(start-c.at)*c.speed,fadeOut:0});
  if(tail>end)parts.push({...c,id:++sequence,begin:c.begin+(end-c.at)*c.speed,at:end,fadeIn:0});
  return parts
 })
}
async function renderFx({id,d,beat,c,start}){
 let source;
 if(c){const engine=new OfflineAudioContext(2,Math.max(1,Math.ceil(rate*d)),rate);schedule(engine,start,false,c);source=await engine.startRendering()}
 const result=await Tone.Offline(async()=>{
  const out=new Tone.Gain(1).toDestination();
  if(id==='noise'||id==='pitch'){
   const filter=new Tone.Filter(260,'lowpass').connect(out);
   filter.frequency.exponentialRampToValueAtTime(12800,d);
   out.gain.setValueAtTime(.001,0);out.gain.exponentialRampToValueAtTime(id==='noise'?.45:.22,d*.98);out.gain.linearRampToValueAtTime(0,d);
   const generator=id==='noise'?new Tone.Noise('white'):new Tone.Oscillator(100,'sawtooth');
   if(id==='pitch')generator.frequency.exponentialRampToValueAtTime(1600,d);
   generator.connect(filter).start(0).stop(d);return
  }
  if(id==='snare'){
   const filter=new Tone.Filter(1200,'highpass').connect(out);new Tone.Noise('white').connect(filter).start(0).stop(d);
   for(let t=0;t<d;){const u=t/d,step=beat/(u<.5?2:u<.8?4:8);out.gain.setValueAtTime(.18+.4*u,t);out.gain.exponentialRampToValueAtTime(.001,t+step*.85);t+=step}return
  }
  if(id==='loop'){
   for(let t=0;t<d;){const step=Math.min(d-t,beat/(t<d*.5?1:t<d*.75?2:4));new Tone.Player({url:source,fadeOut:.004}).connect(out).start(t,0,step);t+=step}return
  }
  const p=new Tone.Player(source);
  if(id==='sweep'){const f=new Tone.Filter(180,'lowpass').connect(out);f.frequency.exponentialRampToValueAtTime(16000,d);p.connect(f)}
  else if(id==='echo'){p.connect(new Tone.FeedbackDelay({delayTime:Math.min(beat*.5,d/4),feedback:.54,wet:.55}).connect(out))}
  else if(id==='wash'){const reverb=new Tone.Reverb({decay:Math.min(3,d),preDelay:.01,wet:.7}).connect(out);await reverb.ready;p.connect(reverb)}
  else p.connect(out);
  if(id==='gate'){for(let t=0;t<d;t+=beat/2){out.gain.setValueAtTime(1,t);out.gain.linearRampToValueAtTime(.025,t+beat*.3);out.gain.setValueAtTime(.025,t+beat*.49)}}
  if(id==='brake'){
   const raw=Tone.getContext().rawContext,src=raw.createBufferSource();src.buffer=source;src.playbackRate.setValueAtTime(1,0);src.playbackRate.linearRampToValueAtTime(.015,d);src.connect(raw.destination);src.start();return
  }
  p.start(0,0,['wash','echo'].includes(id)?d*.48:d);
 },d,2,rate);
 return result.get()
}
function insertFx(name,b,at){
 const asset=++sequence;buffers.set(asset,b);
 const lane=tracks.find(t=>t.fx&&!clips.some(c=>c.track===t.id&&c.at<at+b.duration&&c.at+length(c)>at));
 const trackId=lane?.id??track('FX '+String(tracks.filter(t=>t.fx).length+1).padStart(2,'0'));tracks.find(t=>t.id===trackId).fx=true;
 const c={id:++sequence,fx:true,name,asset,track:trackId,at,begin:0,end:b.duration,speed:1,gain:0,pitch:0,band:'全频'};clips.push(c);selected=c.id
}
$('fx').onclick=()=>{stop();presetMenu();hint();$('fxPanel').showModal()};
$('fxClose').onclick=()=>$('fxPanel').close();
for(const id of ['preset','fxLength','bpm'])$(id).oninput=hint;
$('applyFx').onclick=async()=>{
 const btn=$('applyFx');btn.disabled=true;$('fxClose').disabled=true;$('fxPanel').oncancel=e=>e.preventDefault();
 try{const spec=placement(),{id,c,start,d,beat}=spec;
  if(id.startsWith('fade')){remember();const other=id==='fadeIn'?'fadeOut':'fadeIn';c[id]=Math.min(Number($('fxLength').value),length(c));c[other]=Math.min(c[other]||0,length(c)-c[id])}
  else{
   const gap=id==='combo'?Math.min(d*.5,beat/2):0;
   const b=id==='silence'?null:await renderFx(id==='combo'?{...spec,id:'noise',d:d-gap}:spec);
   remember();
   if(id==='combo'||id==='silence')cutRange(id==='combo'?start+d-gap:start,start+d);
   else if(c)cutRange(start,start+d,c);
   if(b)insertFx(presets.find(p=>p[0]===id)[2],b,start);
   else selected=clips[0]?.id
  }
  refresh();$('fxPanel').close();note(isTech()?'Effect applied':'已应用转场效果')
 }catch(e){$('fxHint').textContent=e.message}finally{btn.disabled=false;$('fxClose').disabled=false;$('fxPanel').oncancel=null}
};
