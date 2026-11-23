'use strict';
const $=id=>document.getElementById(id), ctx=new AudioContext(), rate=44100;
let tracks=[], clips=[], selected=null, pos=0, scale=48, history=[], sources=[], running=false, origin=0, sequence=0;
const buffers=new Map(), processed=new WeakMap();
const bands={'全频':[0,0],'低频':[0,250],'语音频段':[300,3400],'高频':[3500,0]};
const length=c=>(c.end-c.begin)/c.speed;
const duration=()=>Math.max(0,...clips.map(c=>c.at+length(c)));
const current=()=>clips.find(c=>c.id===selected);
const stamp=t=>new Date(Math.floor(t*1000)).toISOString().slice(14,22);
function note(s){$('status').textContent=s}
function stop(){if(running)pos=Math.min(duration(),ctx.currentTime-origin);running=false;for(const s of sources){try{s.stop()}catch{}}sources=[];$('play').textContent='▶ 播放'}
function remember(){stop();history.push(structuredClone({tracks,clips,selected,pos}));if(history.length>40)history.shift()}
function track(name){const t={id:++sequence,name,mute:false,solo:false};tracks.push(t);return t.id}
function trackLabel(t){
 if(t.customName)return t.customName;
 if(!document.body.classList.contains('tech'))return t.name;
 const demos={'01  ·  低音脉冲':'Bass Pulse','02  ·  和弦铺底':'Chord Pad','03  ·  节奏打击':'Percussion'};
 if(demos[t.name])return demos[t.name];
 if(/^[ -~]+$/.test(t.name))return t.name;
 const group=tracks.filter(track=>Boolean(track.fx)===Boolean(t.fx));
 return (t.fx?'FX ':'Track ')+String(group.indexOf(t)+1).padStart(2,'0')
}
function editTrackLabel(label,t){
 const title=label.querySelector('b');
 const button=document.createElement('button');
 button.className='trackName';
 button.textContent=trackLabel(t);
 button.title=isTech()?'Rename track':'重命名音轨';
 button.setAttribute('aria-label',button.title+' · '+button.textContent);
 title.replaceWith(button);
 button.onclick=()=>{
  const value=window.prompt(button.title,trackLabel(t));
  if(!value?.trim()||value.trim()===trackLabel(t))return;
  remember();t.customName=value.trim();refresh()
 }
}
function fillTracks(){
 while(tracks.length<6)track('音轨 '+String(tracks.length+1).padStart(2,'0'));
 track('FX 01');tracks.at(-1).fx=true
}
function importTrack(name){const empty=tracks.find(t=>!t.fx&&!clips.some(c=>c.track===t.id));if(!empty)return track(name);empty.name=name;empty.mute=false;empty.solo=false;return empty.id}
function add(name,b){const asset=++sequence;buffers.set(asset,b);const c={asset,id:++sequence,name,track:importTrack(name),at:0,begin:0,end:b.duration,speed:1,pitch:0,gain:0,band:'全频'};clips.push(c);selected=c.id}
function demo(){
 for(const [j,name] of ['01  ·  低音脉冲','02  ·  和弦铺底','03  ·  节奏打击'].entries()){
 const b=ctx.createBuffer(1,rate*16,rate),a=b.getChannelData(0);
 for(let n=0;n<a.length;n++){const t=n/rate,phase=t%(j===1?2:.5),f=[110,130.81,98,146.83][Math.floor(t/2)%4],w=2*Math.PI*f*t;
 a[n]=Math.min(1,phase*120,(16-t)*12)*Math.exp(-phase*[8,1.8,23][j])*(j===0?.32*Math.sin(w):j===1?.085*(Math.sin(w*2)+Math.sin(w*2.5)+Math.sin(w*3)):.26*Math.sin(2*Math.PI*(54*phase+2*(1-Math.exp(-phase*80)))));}
 add(name,b)}selected=clips[0].id;note('示例工程已就绪　·　可新建空白工程或导入音频')}
function el(tag,cls,parent,txt){const e=document.createElement(tag);e.className=cls;if(txt!==undefined)e.textContent=txt;parent.append(e);return e}
function dragClip(e,box,c,lane){
 if(e.button!==0)return;
 e.preventDefault();stop();selected=c.id;box.setPointerCapture(e.pointerId);
 const scroll=lane.closest('.scroll'),bounds=scroll.getBoundingClientRect();
 const grab=e.clientX-lane.getBoundingClientRect().left-c.at*scale;
 let x=e.clientX,y=e.clientY,moved=false,target=lane,frame=0;
 const time=()=>Math.max(0,(x-lane.getBoundingClientRect().left-grab)/scale);
 function preview(){
  if(y<bounds.top+24)scroll.scrollTop-=9;
  else if(y>bounds.bottom-24)scroll.scrollTop+=9;
  const hit=document.elementFromPoint(Math.max(bounds.left+1,Math.min(x,bounds.right-20)),Math.max(bounds.top+1,Math.min(y,bounds.bottom-18)));
  const next=hit?.closest('.row')?.querySelector('.lane[data-track]');
  if(next&&next!==target){target.classList.remove('dropTarget');target=next}
  target.classList.add('dropTarget');
  box.style.transform='translateY('+(target.getBoundingClientRect().top-lane.getBoundingClientRect().top)+'px)';
  box.style.left=time()*scale+'px';
 }
 function scrollFrame(){preview();frame=requestAnimationFrame(scrollFrame)}
 box.onpointermove=v=>{
  x=v.clientX;y=v.clientY;
  if(!moved&&Math.hypot(x-e.clientX,y-e.clientY)>3){moved=true;box.classList.add('dragging');scrollFrame()}
 };
 function finish(){cancelAnimationFrame(frame);target.classList.remove('dropTarget');refresh()}
 box.onpointerup=v=>{
  x=v.clientX;y=v.clientY;
  if(moved){preview();remember();c.track=Number(target.dataset.track);c.at=time()}
  else pos=c.at+Math.min(length(c),Math.max(0,(x-box.getBoundingClientRect().left)/scale));
  finish()
 };
 box.onpointercancel=finish
}
function refresh(){
 const tl=$('timeline');tl.replaceChildren();const width=Math.max($('timeline').parentNode.clientWidth-162,(duration()+4)*scale,400);tl.style.width=width+160+'px';
 function row(title,ruler=false){const r=el('div','row'+(ruler?' ruler':''),tl),label=el('div','label',r);el('b','',label,title);const lane=el('div','lane',r);lane.style.backgroundSize=scale*2+'px 100%';lane.onclick=e=>{stop();pos=Math.max(0,(e.clientX-lane.getBoundingClientRect().left)/scale);cursor()};return {label,lane}}
 const ruler=row('轨道 / TRACKS',true).lane,step=Math.max(1,Math.ceil(85/scale));for(let t=0;t*scale<width;t+=step)el('span','tick',ruler,stamp(t).slice(0,5)).style.left=t*scale+4+'px';
 for(const t of tracks){const {label,lane}=row(trackLabel(t));editTrackLabel(label,t);lane.dataset.track=t.id;for(const [k,title] of [['mute','静音'],['solo','独听']]){const b=el('button',t[k]?'on':'',label,title);b.onclick=()=>{remember();t[k]=!t[k];refresh()}}
 for(const c of clips.filter(c=>c.track===t.id)){const box=el('div','clip'+(selected===c.id?' active':''),lane);box.style.left=c.at*scale+'px';box.style.width=Math.max(2,length(c)*scale)+'px';el('span','',box,c.name);
 const wave=el('canvas','',box),w=wave.width=Math.min(3000,Math.max(2,Math.ceil(length(c)*scale))),h=wave.height=35,g=wave.getContext('2d'),buf=buffers.get(c.asset),data=buf.getChannelData(0),stride=(c.end-c.begin)*buf.sampleRate/w;
 g.fillStyle=document.body.classList.contains('tech')?studioColor.wave():'#56b9e9';const gainScale=10**(c.gain/20),[fi,fo]=fadeTimes(c);for(let x=0;x<w;x++){let peak=0;const start=c.begin*buf.sampleRate+x*stride;for(let j=0;j<32;j++)peak=Math.max(peak,Math.abs(data[Math.floor(start+j*stride/32)]||0));const time=x*length(c)/w;const envelope=Math.min(1,fi?time/fi:1,fo?(length(c)-time)/fo:1);const a=Math.min(16,peak*16*gainScale*envelope);g.fillRect(x,17-a,1,Math.max(1,2*a))}
 if(c.fx)box.classList.add("fxClip");fadeHandles(box,c);box.onclick=e=>e.stopPropagation();box.onpointerdown=e=>dragClip(e,box,c,lane)
 }}
 el('div','head',tl).id='head';cursor();inspector();$('summary').textContent=tracks.length+' 条音轨　 /　 '+stamp(duration());$('undo').disabled=!history.length}
function cursor(){$('head').style.left=160+pos*scale+'px';$('clock').textContent=stamp(pos)}
function inspector(){const c=current(),p=$('controls');p.replaceChildren();$('name').textContent=c?.name||'导入音频以开始编辑';if(!c)return;
 for(const [key,title,min,max,step] of [['begin','源入点 / 秒',0,c.end-.001,.001],['end','源出点 / 秒',c.begin+.001,buffers.get(c.asset).duration,.001],['at','时间线位置 / 秒',0,86400,.001],['pitch','音调 / 半音',-12,12,1],['gain','增益 / dB',-60,18,.1],['speed','播放速度 / 倍',.25,4,.01]]){
 const input=el('input','',el('label','',p,title));Object.assign(input,{type:'number',min,max,step,value:+c[key].toFixed(4)});input.onchange=()=>{const v=input.valueAsNumber;if(!Number.isFinite(v)||v<min||v>max){note('请输入范围内的数值：'+min.toFixed(3)+' 至 '+max.toFixed(3));inspector();return}remember();c[key]=v;refresh()}}
 const select=el('select','',el('label','',p,'频段滤波'));for(const k of Object.keys(bands))el('option','',select,k);select.value=c.band;select.onchange=()=>{remember();c.band=select.value;refresh()};
 const extract=el('button','',p,'提取到新轨');extract.disabled=c.band==='全频';extract.onclick=()=>{remember();const name=c.name+' · '+c.band,copy={...c,id:++sequence,name,track:track(name)};c.band='全频';clips.push(copy);selected=copy.id;tracks.at(-1).solo=true;refresh();note('频段已提取，新轨已开启独听')}}
function material(c){const raw=buffers.get(c.asset);if(!c.pitch&&c.speed===1)return {buf:raw,offset:c.begin};
 const key=[c.begin,c.end,c.pitch,c.speed].join('/'),cache=processed.get(c);if(cache?.key===key)return cache;
 const sr=raw.sampleRate,N=Math.max(1,Math.round(length(c)*sr)),buf=ctx.createBuffer(raw.numberOfChannels,N,sr),ratio=2**(c.pitch/12),hop=Math.round(sr*.025),base=Math.round(c.begin*sr),limit=Math.ceil(c.end*sr);
 for(let ch=0;ch<raw.numberOfChannels;ch++){const a=raw.getChannelData(ch),out=buf.getChannelData(ch);
 for(let n=-hop;n<N;n+=hop){const source=base+n*c.speed;for(let j=Math.max(0,-n);j<2*hop&&n+j<N;j++){const idx=source+j*ratio,k=Math.floor(idx);if(k<base||k>=limit)continue;const frac=idx-k;out[n+j]+=(a[k]*(1-frac)+(a[k+1]||0)*frac)*(.5-.5*Math.cos(Math.PI*j/hop))}}}
 const result={key,buf,offset:0};processed.set(c,result);return result}
function schedule(engine,start,live,isolated=null){const solo=tracks.some(t=>t.solo),plan=[];for(const c of isolated?[isolated]:clips){const t=tracks.find(t=>t.id===c.track),skip=Math.max(0,start-c.at);if((!isolated&&(t.mute||(solo&&!t.solo)))||skip>=length(c))continue;
 const {buf,offset}=material(c),s=engine.createBufferSource();s.buffer=buf;let last=s;const [lo,hi]=bands[c.band];for(const [hz,type] of [[lo,'highpass'],[hi,'lowpass']])if(hz){const f=engine.createBiquadFilter();f.type=type;f.frequency.value=hz;last.connect(f);last=f}
 const g=engine.createGain();g.gain.value=10**(c.gain/20);last.connect(g);g.connect(live?mixBus:engine.destination);plan.push([s,Math.max(0,c.at-start),offset+skip,length(c)-skip,c,g,skip])}
 const now=engine.currentTime;for(const [s,delay,offset,len,c,g,skip] of plan){applyEnvelope(c,g.gain,now+delay,skip);s.start(now+delay,offset,len);if(live)sources.push(s)}return now}
$('play').onclick=async()=>{if(running){stop();return}if(!clips.length)return;await ctx.resume();if(pos>=duration())pos=0;origin=schedule(ctx,pos,true)-pos;running=true;$('play').textContent='Ⅱ 暂停';function frame(){if(!running)return;pos=ctx.currentTime-origin;if(pos>=duration())stop();cursor();if(running)requestAnimationFrame(frame)}frame()};
$('home').onclick=()=>{stop();pos=0;cursor()};
$('imp').onclick=()=>$('files').click();$('files').onchange=async e=>{const files=[...e.target.files];e.target.value='';for(const f of files){try{const b=await ctx.decodeAudioData(await f.arrayBuffer());remember();add(f.name,b);refresh();note('已导入 '+f.name)}catch{note('无法读取 '+f.name)}}};
$('fresh').onclick=()=>{remember();tracks=[];clips=[];fillTracks();selected=null;pos=0;refresh();note('空白工程')};
$('split').onclick=()=>{const c=current();if(!c||pos<=c.at+.001||pos>=c.at+length(c)-.001)return note('请在片段内部点击分割位置');remember();const cut=c.begin+(pos-c.at)*c.speed;clips.push({...c,begin:cut,at:pos,id:++sequence});c.end=cut;refresh()};
$('del').onclick=()=>{if(!current())return;remember();clips=clips.filter(c=>c.id!==selected);selected=clips[0]?.id;refresh()};
$('undo').onclick=()=>{const state=history.pop();if(state){stop();({tracks,clips,selected,pos}=state);refresh()}};
for(const [id,f] of [['zoomIn',1.5],['zoomOut',1/1.5]])$(id).onclick=()=>{scale=Math.min(320,Math.max(2,scale*f));refresh()};
$('exp').onclick=async()=>{if(!clips.length)return;const button=$('exp');button.disabled=true;try{const offline=new OfflineAudioContext(2,Math.ceil(duration()*rate),rate);schedule(offline,0,false);const mix=await offline.startRendering(),N=mix.length,data=new ArrayBuffer(44+N*4),v=new DataView(data);
 function tag(at,s){[...s].forEach((ch,i)=>v.setUint8(at+i,ch.charCodeAt(0)))}
 tag(0,'RIFF');v.setUint32(4,36+N*4,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,rate,true);v.setUint32(28,rate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,N*4,true);
 for(let ch=0;ch<2;ch++){const a=mix.getChannelData(ch);for(let n=0;n<N;n++)v.setInt16(44+4*n+2*ch,Math.max(-1,Math.min(1,a[n]))*32767,true)}
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'audio/wav'}));a.download='Phase Array Mix.wav';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),60000);note('混音已导出 · 44.1 kHz / 16-bit WAV')}catch(e){note('导出失败：'+e.message)}finally{button.disabled=false}};
document.onkeydown=e=>{if(document.querySelector('dialog[open]'))return;if(['INPUT','SELECT','BUTTON'].includes(e.target.tagName))return;const id=e.code==='Space'?'play':e.code==='KeyS'?'split':e.code==='Delete'?'del':e.ctrlKey&&e.code==='KeyZ'?'undo':null;if(id){e.preventDefault();$(id).click()}};
window.onresize=refresh;
async function projectSlot(mode,action){
 const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('audio-studio-project',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction('projects',mode),request=action(tx.objectStore('projects'));tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error)})}finally{db.close()}
}
$('save').onclick=async()=>{try{const assets=[...new Set(clips.map(c=>c.asset))].map(id=>{const b=buffers.get(id);return {id,rate:b.sampleRate,channels:Array.from({length:b.numberOfChannels},(_,i)=>b.getChannelData(i).slice())}});
 await projectSlot('readwrite',s=>s.put(structuredClone({tracks,clips,selected,pos,assets}),'current'));note('工程已保存到此浏览器，下次可点击恢复工程')}catch(e){note('保存失败：'+e.message)}};
$('restore').onclick=async()=>{try{const project=await projectSlot('readonly',s=>s.get('current'));if(!project)return note('此浏览器尚无已保存的工程');
 const ids=new Map();for(const asset of project.assets){const b=ctx.createBuffer(asset.channels.length,asset.channels[0].length,asset.rate);asset.channels.forEach((a,i)=>b.copyToChannel(a,i));const id=++sequence;ids.set(asset.id,id);buffers.set(id,b)}
 remember();({tracks,clips,selected,pos}=project);for(const c of clips){c.asset=ids.get(c.asset);sequence=Math.max(sequence,c.id)}for(const t of tracks)sequence=Math.max(sequence,t.id);refresh();note('已恢复本地工程')}catch(e){note('恢复失败：'+e.message)}};





