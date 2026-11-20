'use strict';
const english=new Map(Object.entries({
 '演播室风格':'Classic View','恢复工程':'Restore','保存工程':'Save','新建':'New','＋ 导入音频':'Import Audio','↓ 导出 WAV':'Export WAV','多轨编排':'Arrangement','⏮':'Rewind','▶ 播放':'Play','Ⅱ 暂停':'Pause','＋ DJ FX':'Add FX','● 横屏录像':'Record Video','✂ 分割':'Split','删除片段':'Delete','↶ 撤销':'Undo','−':'Zoom Out','＋':'Zoom In','静音':'Mute','独听':'Solo','提取到新轨':'Extract to Track','关闭':'Close','开始录像':'Start Recording','结束并保存':'Finish & Save','添加 FX':'Apply FX','横屏录像':'Video Capture','混音频谱':'Spectrum','轨道 / TRACKS':'TRACKS','起点（秒）':'Start (s)','终点（秒）':'End (s)','时间窗口':'Time Window','波形高度':'Wave Height','8 秒':'8 s','16 秒':'16 s','32 秒':'32 s','转场效果':'Effect','长度（秒）':'Length (s)','速度（BPM）':'Tempo (BPM)','源入点 / 秒':'Source In (s)','源出点 / 秒':'Source Out (s)','时间线位置 / 秒':'Position (s)','音调 / 半音':'Pitch (st)','增益 / dB':'Gain (dB)','播放速度 / 倍':'Speed (×)','频段滤波':'Frequency Band','全频':'Full Range','低频':'Low End','语音频段':'Speech','高频':'High End','空格 播放　·　S 分割　·　拖动波形移动片段':'Space to play　·　S to split　·　Drag clips to move'
}));
const originals=new WeakMap();
function translateNode(text){
 const value=text.nodeValue.trim();
 if(isTech()&&english.has(value)){
  if(text.parentElement?.tagName==='OPTION'&&!text.parentElement.hasAttribute('value'))text.parentElement.value=value;
  originals.set(text,value);text.nodeValue=english.get(value)
 }else if(!isTech()&&originals.has(text)&&english.get(originals.get(text))===value){text.nodeValue=originals.get(text);originals.delete(text)}
}
function translateTree(root){
 if(root.nodeType===3){translateNode(root);return}
 if(!root.querySelectorAll||['SCRIPT','STYLE'].includes(root.tagName))return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(walker.nextNode())if(!['SCRIPT','STYLE'].includes(walker.currentNode.parentElement?.tagName))translateNode(walker.currentNode)
}
function setStyle(enabled){
 document.body.classList.toggle('tech',enabled);$('theme').setAttribute('aria-pressed',String(enabled));
 translateTree(document.body);presetMenu();refresh();
 try{localStorage.setItem('studio-tech',enabled?'1':'0')}catch{}
}
new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)translateTree(n)}).observe(document.body,{childList:true,subtree:true});
$('theme').onclick=()=>setStyle(!isTech());
demo();fillTracks();let savedStyle=false;try{savedStyle=localStorage.getItem('studio-tech')==='1'}catch{}
setStyle(savedStyle);
if(window.Tone && typeof drawStage==='function')$('startup').hidden=true;
