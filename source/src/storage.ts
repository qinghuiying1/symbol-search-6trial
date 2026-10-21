import {DATABASE_NAME,addEvent,type AssessmentRecord} from './model';
import {validTrials} from './scoring';
let opening:Promise<IDBDatabase>|null=null;
function db():Promise<IDBDatabase> {
  return opening??=new Promise((resolve,reject)=>{
    const r=indexedDB.open(DATABASE_NAME,1);
    r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('records',{keyPath:'sessionId'});d.createObjectStore('settings');};
    r.onsuccess=()=>{const d=r.result;d.onversionchange=()=>{d.close();opening=null;};resolve(d);};
    r.onerror=()=>{opening=null;reject(r.error??new Error('无法打开本地记录库。'));};
    r.onblocked=()=>reject(new Error('记录库正在使用，请关闭其他符号搜索页面。'));
  });
}
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const committed=(t:IDBTransaction)=>new Promise<void>((resolve,reject)=>{t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error??new Error('保存未完成。'));t.onerror=()=>reject(t.error??new Error('本地保存失败。'));});
function writing(d:IDBDatabase,store:string):IDBTransaction {try{return d.transaction(store,'readwrite',{durability:'strict'});}catch{return d.transaction(store,'readwrite');}}
export async function initStorage():Promise<void>{const d=await db(),t=writing(d,'settings'),done=committed(t);t.objectStore('settings').put(new Date().toISOString(),'probe');await done;}
export function assertAppendOnly(old:AssessmentRecord,next:AssessmentRecord):void {
  for(const key of ['sessionId','studyId','seed','startedAt','appVersion','taskVersion','plannedTrials','parameters'] as const)
    if(JSON.stringify(old[key])!==JSON.stringify(next[key]))throw new Error('已保存记录的编号或任务配置不能改写。');
  if(old.status!=='in-progress' && JSON.stringify(old)!==JSON.stringify(next))throw new Error('已结束记录不能覆盖。');
  if(next.trials.length<old.trials.length || old.trials.some((t,i)=>JSON.stringify(t)!==JSON.stringify(next.trials[i])))throw new Error('已保存的逐题数据不能替换。');
}
export async function saveRecord(record:AssessmentRecord):Promise<void> {
  const snapshot=structuredClone(record);
  if(snapshot.status==='completed'&&!validTrials(snapshot.trials))throw new Error('必须保存六个完整试次才能标记完成。');
  if(snapshot.trials.some((t,i)=>t.trialIndex!==i))throw new Error('逐题数据存在重复或缺号。');
  const d=await db(),t=writing(d,'records'),done=committed(t),store=t.objectStore('records');let validationError:unknown;
  const r=store.get(snapshot.sessionId);
  r.onsuccess=()=>{try{if(r.result)assertAppendOnly(r.result,snapshot);store.put(snapshot);}catch(error){validationError=error;t.abort();}};
  try{await done;}catch(error){throw validationError??error;}
}
export async function getRecord(id:string):Promise<AssessmentRecord|null>{const d=await db();return await request(d.transaction('records').objectStore('records').get(id))??null;}
export async function allRecords():Promise<AssessmentRecord[]>{const d=await db();const rows=await request(d.transaction('records').objectStore('records').getAll()) as AssessmentRecord[];return rows.sort((a,b)=>b.startedAt.localeCompare(a.startedAt));}
export async function recoverInterruptedRecords():Promise<number>{
  const rows=await allRecords();let n=0;
  for(const row of rows){if(row.status!=='in-progress')continue;row.status='interrupted';row.endedAt=new Date().toISOString();row.interruptionReason='原测评页面刷新或关闭，任务未完成。';addEvent(row,'recovered-as-interrupted');await saveRecord(row);n++;}
  return n;
}
