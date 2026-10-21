import './styles.css';
import {APP_VERSION,TASK_VERSION,SCHEMA_VERSION,TRIAL_COUNT,addEvent,type AssessmentRecord} from './model';
import {initStorage,saveRecord,allRecords,getRecord,recoverInterruptedRecords} from './storage';
import {summarize} from './scoring';
import {runSymbolSearch,symbolParameters} from './symbol';
import {exportRecords} from './export';
import {checkOffline,prepareOffline} from './offline';

const root=document.querySelector<HTMLDivElement>('#app')!;
let view:'home'|'instructions'|'records'|'result'|'running'='home';
let studyId='',filter='',rows:AssessmentRecord[]=[],current:AssessmentRecord|null=null;
let busy=false,notice='',error='',storageFailure=false,offline=false,offlineMessage='可联网打开后准备离线资源';
let running=false,generation=0,controller:{stop:()=>void}|null=null;
let saveTail:Promise<void>=Promise.resolve(),wake:{release:()=>Promise<void>}|null=null;
let releaseTab:(()=>void)|null=null,lastWidth=innerWidth,lastHeight=innerHeight;
const escape=(v:unknown)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
const button=(id:string,label:string,kind='primary',disabled=false)=>`<button id="${id}" class="button ${kind}" ${busy||disabled?'disabled':''}>${label}</button>`;
const date=(iso:string|null)=>iso?new Date(iso).toLocaleString('zh-CN',{hour12:false}):'—';
const number=(n:number|null,d=0)=>n===null?'—':n.toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d});
const status=(r:AssessmentRecord)=>r.status==='completed'?'已完成':r.status==='interrupted'?'未完成':'进行中';
function shell(content:string):void {
  root.innerHTML=`<header class="header"><a class="brand" href="#" id="brand-home"><span class="brand-icon" aria-hidden="true">◇</span><span>符号搜索<small>六试次 · 本地保存</small></span></a><span class="header-label">竖屏测评</span></header><main>${error?`<div class="message error" role="alert">${escape(error)}${storageFailure?`<div class="actions">${button('retry-save','重试保存','secondary')}${current?button('emergency-export','导出已有记录','secondary'):''}</div>`:''}</div>`:''}${notice?`<div class="message success" role="status">${escape(notice)}</div>`:''}${content}</main><footer><span>记录仅保存在本机浏览器，请导出备份</span><span>版本 ${APP_VERSION}</span></footer>`;
  bind('brand-home',async()=>{view='home';notice='';});
  bind('retry-save',async()=>{if(current)await persist(current);else await initStorage();storageFailure=false;error='';notice='本地保存成功。';});
  bind('emergency-export',async()=>{if(current)await download([current]);});
}
function bind(id:string,fn:()=>void|Promise<void>):void {document.getElementById(id)?.addEventListener('click',e=>{e.preventDefault();void act(fn);});}
async function act(fn:()=>void|Promise<void>):Promise<void>{
  if(busy)return;busy=true;root.querySelectorAll<HTMLButtonElement|HTMLInputElement>('button,input').forEach(el=>el.disabled=true);
  try{await fn();}catch(e){error=message(e);}finally{busy=false;render();}
}
function persist(record:AssessmentRecord):Promise<void>{
  const snapshot=structuredClone(record),op=saveTail.catch(()=>{}).then(()=>saveRecord(snapshot));saveTail=op;
  return op.catch(e=>{storageFailure=true;throw new Error('保存失败：'+message(e)+' 请保留本页面，重试保存或导出已有记录。');});
}
function render():void {
  if(running||view==='running'){if(!running)view='result';else return;}
  document.body.classList.remove('task-active');
  if(view==='home')renderHome();else if(view==='instructions')renderInstructions();else if(view==='records')renderRecords();else renderResult();
}
function renderHome():void {
  shell(`<section class="intro"><span class="eyebrow">SYMBOL SEARCH</span><h1>找出相同的<br>符号配对</h1><p>共6题，请尽量又快又准确。<br>将平板竖放，准备好后开始。</p></section><section class="panel"><label for="study-id">研究编号</label><input id="study-id" type="text" maxlength="64" placeholder="请输入编号，如 P001" value="${escape(studyId)}" autocomplete="off" autocapitalize="off" spellcheck="false"><p class="help">同一编号可以重复测评，每次记录单独保存。</p>${button('instructions','查看说明，准备开始')}<div class="divider"></div><div class="utility-row"><div><strong id="offline-state">${offline?'离线准备完成':'离线资源'}</strong><p class="help" id="offline-message">${escape(offlineMessage)}</p></div>${button('prepare-offline',offline?'核查资源':'准备离线','secondary')}</div></section><div class="home-links">${button('open-records','查看记录与批量导出','text')}</div>`);
  const input=document.querySelector<HTMLInputElement>('#study-id')!;input.addEventListener('input',()=>{studyId=input.value;});input.addEventListener('keydown',e=>{if(e.key==='Enter')document.querySelector<HTMLButtonElement>('#instructions')?.click();});
  bind('instructions',()=>{studyId=input.value.trim();if(!studyId)throw new Error('请输入研究编号。');if(storageFailure)throw new Error('请先完成本地保存核查。');error='';notice='';view='instructions';});
  bind('open-records',async()=>{rows=await allRecords();filter='';view='records';notice='';error='';});
  bind('prepare-offline',async()=>{offline=await prepareOffline(text=>{offlineMessage=text;const el=document.getElementById('offline-message');if(el)el.textContent=text;});notice='离线资源已核查完成，可断网测评和导出。';error='';});
}
function renderInstructions():void {
  shell(`<div class="page-top">${button('back-home','返回','text')}<span class="id-pill">编号 ${escape(studyId)}</span></div><section class="intro compact"><span class="eyebrow">测评说明</span><h1>请在下方两组中，<br>选择相同的一组</h1></section><section class="panel instructions"><div class="example" aria-hidden="true"><div class="example-top"><span>◇<br>○</span><span>□<br>＋</span><span>△<br>☆</span></div><div class="example-bottom"><span>△<br>☆</span><span>◇<br>＋</span></div></div><ol><li>先看上方的三组符号。</li><li>在下方两组中，点选与上方任意一组<strong>完全相同</strong>的一组。</li><li>每题选择一次，共6题。请尽量又快又准确。</li></ol><p class="help">开始后将尝试全屏显示。测评期间请让此页面保持在前台。</p>${button('start-task','准备好了，开始六题')}</section>`);
  bind('back-home',()=>{view='home';error='';});bind('start-task',startTask);
}
async function startTask():Promise<void>{
  if(running)return;
  let fullscreen='unavailable';
  try{if(document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen();fullscreen='entered';}}catch{fullscreen='declined';}
  const seed=crypto.randomUUID();current={sessionId:crypto.randomUUID(),studyId,schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,taskVersion:TASK_VERSION,status:'in-progress',seed,plannedTrials:TRIAL_COUNT,startedAt:new Date().toISOString(),endedAt:null,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,utcOffsetMinutes:-new Date().getTimezoneOffset(),parameters:symbolParameters(seed),trials:[],events:[],interruptionReason:'',device:{userAgent:navigator.userAgent,width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio}};
  addEvent(current,'start',{fullscreen});
  try{await persist(current);}catch(e){current.status='interrupted';current.endedAt=new Date().toISOString();current.interruptionReason='任务启动前本地保存失败。';view='result';await releaseScreen();throw e;}
  running=true;view='running';notice='';error='';storageFailure=false;const ownGeneration=++generation;
  document.body.classList.add('task-active');root.innerHTML='<main class="loading-screen"><span class="loader"></span><h1>正在准备符号…</h1><div id="symbol-container"></div></main>';
  try{wake=await navigator.wakeLock?.request('screen')??null;}catch{/* Optional screen wake lock. */}
  lastWidth=innerWidth;lastHeight=innerHeight;
  try {
    const c=await runSymbolSearch(document.querySelector<HTMLElement>('#symbol-container')!,{
      seed,
      onTrial:async trial=>{if(ownGeneration!==generation||!current||current.status!=='in-progress')return;current.trials.push(trial);addEvent(current,'trial-saved',{trialIndex:trial.trialIndex});await persist(current);},
      onEnd:async()=>{if(ownGeneration!==generation||!current)return;const completed=structuredClone(current);completed.status='completed';completed.endedAt=new Date().toISOString();addEvent(completed,'completed');await persist(completed);current=completed;running=false;generation++;controller=null;view='result';await releaseScreen();render();},
      onError:e=>{if(ownGeneration===generation)void interrupt(message(e));}
    });
    if(ownGeneration!==generation)c.stop();else controller=c;
  }catch(e){if(ownGeneration===generation)await interrupt('任务未完成：'+message(e));}
}
async function releaseScreen():Promise<void>{try{await wake?.release();}catch{}wake=null;try{if(document.fullscreenElement)await document.exitFullscreen();}catch{}}
async function interrupt(reason:string):Promise<void>{
  if(!current||current.status!=='in-progress')return;running=false;generation++;controller?.stop();controller=null;
  current.status='interrupted';current.endedAt=new Date().toISOString();current.interruptionReason=reason;addEvent(current,'interrupted',{reason});view='result';
  try{await persist(current);notice='已保留本次未完成记录。重新开始会另存为新一轮。';}catch(e){error=message(e);}
  await releaseScreen();render();
}
function renderResult():void {
  if(!current){view='home';renderHome();return;}
  const r=current,s=summarize(r),complete=r.status==='completed';
  shell(`<div class="page-top">${button('result-home','返回主页','text')}<span class="id-pill">编号 ${escape(r.studyId)}</span></div><section class="intro compact"><span class="eyebrow">${complete?'测评结果':'已保留记录'}</span><h1>${complete?'六题已完成':'本轮尚未完成'}</h1><p>${escape(date(r.startedAt))} · 已答 ${s.completedTrials} / 6 题</p></section>${complete?`<div class="score-grid"><section><span>正确数</span><strong id="score-correct">${s.correctCount}<small> / 6</small></strong></section><section><span>正确率</span><strong id="score-accuracy">${number(s.accuracy===null?null:s.accuracy*100,1)}<small>%</small></strong></section><section class="wide"><span>正确题中位反应时</span><strong id="score-rt">${s.medianCorrectRtMs===null?'缺失':number(s.medianCorrectRtMs,1)}<small>${s.medianCorrectRtMs===null?'':' 毫秒'}</small></strong>${s.medianCorrectRtMs===null?'<p class="help">本轮没有正确试次，反应时记为缺失。</p>':''}</section></div>`:`<div class="message">${escape(r.interruptionReason)}<p class="help">已答试次保留在导出文件中，本轮不计算完整六题成绩。</p></div>`}<section class="panel"><h2>保存与导出</h2><p>${storageFailure?'请先重试保存，或导出已有记录。':'记录已保存在本机。请下载并转存备份。'}</p>${button('export-current','导出本次结果')}<div class="actions">${button('same-id-again','同一编号再次测评','secondary')}${button('result-records','查看全部记录','text')}</div><p class="help">记录ID：${escape(r.sessionId)}</p></section>`);
  bind('result-home',()=>{view='home';notice='';error='';});bind('export-current',async()=>download([r]));
  bind('same-id-again',()=>{if(storageFailure)throw new Error('请先保存或导出当前记录。');studyId=r.studyId;view='instructions';notice='';error='';});
  bind('result-records',async()=>{rows=await allRecords();view='records';filter='';notice='';error='';});
}
function renderRecords():void {
  const filtered=rows.filter(r=>!filter||r.studyId.toLowerCase().includes(filter.toLowerCase()));
  shell(`<div class="page-top">${button('records-home','返回主页','text')}<span class="id-pill">本机 ${rows.length} 条</span></div><section class="intro compact"><span class="eyebrow">本机记录</span><h1>查看与导出</h1></section><section class="panel"><label for="filter-id">按研究编号查找</label><input id="filter-id" type="search" placeholder="输入编号" value="${escape(filter)}"><div class="actions">${button('export-all',`导出本机全部 ${rows.length} 条`,'primary',!rows.length)}</div><p class="help">包含已完成和未完成记录，文件内分别标明状态。</p></section><div class="record-list" id="record-list">${filtered.map(r=>`<article class="record-row"><div><strong>${escape(r.studyId)}</strong><p>${escape(date(r.startedAt))}</p><span class="badge ${r.status==='completed'?'complete':''}">${status(r)} · ${r.trials.length} / 6题</span></div><button class="button secondary open-record" data-session="${escape(r.sessionId)}" ${busy?'disabled':''}>查看</button></article>`).join('')||'<p class="empty">暂无匹配记录</p>'}</div>`);
  const input=document.querySelector<HTMLInputElement>('#filter-id')!;input.addEventListener('input',()=>{filter=input.value;const pos=input.selectionStart;renderRecords();const next=document.querySelector<HTMLInputElement>('#filter-id')!;next.focus();if(pos!==null)next.setSelectionRange(pos,pos);});
  bind('records-home',()=>{view='home';notice='';error='';});bind('export-all',async()=>{await download(await allRecords());});
  root.querySelectorAll<HTMLButtonElement>('.open-record').forEach(el=>el.addEventListener('click',()=>{void act(async()=>{current=await getRecord(el.dataset.session!);view='result';notice='';error='';});}));
}
async function download(records:AssessmentRecord[]):Promise<void>{const data=await exportRecords(records),url=URL.createObjectURL(data.blob),a=document.createElement('a');a.href=url;a.download=data.fileName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);notice='已生成ZIP并请求下载，请在下载文件夹确认文件后转存。';}
function noteViewport():void {
  if(!running||!current)return;if(innerWidth===lastWidth&&innerHeight===lastHeight)return;
  addEvent(current,'viewport-change',{fromWidth:lastWidth,fromHeight:lastHeight,width:innerWidth,height:innerHeight,timingContinues:true});lastWidth=innerWidth;lastHeight=innerHeight;
  void persist(current).catch(e=>{void interrupt(message(e));});
}
window.addEventListener('resize',noteViewport);screen.orientation?.addEventListener('change',noteViewport);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&running)void interrupt('页面切至后台或设备锁屏，任务未完成。');});
window.addEventListener('pagehide',()=>{if(running)void interrupt('页面刷新或关闭，任务未完成。');releaseTab?.();});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
async function acquireTab():Promise<boolean>{
  if(!navigator.locks)return true;
  return new Promise(resolve=>{void navigator.locks.request('symbol-search-6trial-tab',{ifAvailable:true},async lock=>{if(!lock){resolve(false);return;}await new Promise<void>(release=>{releaseTab=release;resolve(true);});}).catch(()=>resolve(false));});
}
async function boot():Promise<void>{
  root.innerHTML='<main class="loading-screen"><span class="loader"></span><p>正在核查本地记录…</p></main>';
  try{if(!await acquireTab()){root.innerHTML='<main class="panel blocking"><h1>此网站已在另一个标签页打开</h1><p>请先关闭另一个符号搜索页面，再重新打开本页面。</p></main>';return;}await initStorage();const recovered=await recoverInterruptedRecords();if(recovered)notice=`已找回 ${recovered} 条未完成记录，可在记录列表查看和导出。`;render();void checkOffline().then(ok=>{offline=ok;if(ok)offlineMessage='已缓存，可断网测评与导出';if(view==='home'&&!busy&&!running)render();});}
  catch(e){storageFailure=true;error=message(e);render();}
}
void boot();
