let ready=false;
interface Reply {ready:boolean;message?:string}
function ask(worker:ServiceWorker,type:string):Promise<Reply>{return new Promise((resolve,reject)=>{const c=new MessageChannel(),timer=setTimeout(()=>reject(new Error('离线准备超时，请保持联网重试。')),120000);c.port1.onmessage=e=>{clearTimeout(timer);c.port1.close();resolve(e.data);};worker.postMessage({type},[c.port2]);});}
export async function checkOffline():Promise<boolean>{
  if(!('serviceWorker' in navigator))return false;
  try{const reg=await navigator.serviceWorker.getRegistration(new URL('.',document.baseURI).href);return ready=!!reg?.active&&(await ask(reg.active,'VERIFY')).ready;}catch{return false;}
}
export async function prepareOffline(progress:(s:string)=>void):Promise<boolean>{
  if(!('serviceWorker' in navigator)||!isSecureContext)throw new Error('请使用HTTPS网址或本机预览地址准备离线资源。');
  progress('正在缓存符号、字体和程序，请保持联网…');
  const scope=new URL('.',document.baseURI),reg=await navigator.serviceWorker.register(new URL('sw.js',scope),{scope:scope.pathname,updateViaCache:'none'});
  await Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('离线安装超时，请保持联网重试。')),120000))]);
  if(reg.waiting)throw new Error('新版本已准备，请结束当前测评、导出记录，并关闭所有本网站标签页后重新打开。');
  if(!reg.active)throw new Error('离线程序尚未启用，请重新打开页面。');
  const reply=await ask(reg.active,'PREPARE');if(!reply.ready)throw new Error(reply.message??'资源未全部缓存。');
  try{await navigator.storage.persist();}catch{/* A denied persistence request does not prevent local IndexedDB use. */}
  ready=true;progress('离线准备完成');return true;
}
