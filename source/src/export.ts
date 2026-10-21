import JSZip from 'jszip';
import {APP_VERSION,type AssessmentRecord} from './model';
import {summarize} from './scoring';
type Cell=string|number|null;
const xml=(s:string)=>s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function column(n:number):string {let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function sheet(rows:Cell[][]):string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="40" width="24" customWidth="1"/></cols><sheetData>'+rows.map((row,i)=>`<row r="${i+1}">`+row.map((v,j)=>{
    const ref=column(j)+(i+1);if(v===null)return `<c r="${ref}"/>`;
    return typeof v==='number'?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }).join('')+'</row>').join('')+`</sheetData><autoFilter ref="A1:${column(rows[0].length-1)}${rows.length}"/></worksheet>`;
}
export const SUMMARY_HEADERS=['研究编号','记录ID','完成状态','开始时间ISO','结束时间ISO','设备时区','UTC偏移分钟','计划题数','已答题数','正确数','正确率','正确题中位反应时_ms','程序版本','任务版本','随机种子','中断原因'];
export const TRIAL_HEADERS=['研究编号','记录ID','完成状态','题号_1到6','SDK题号_0到5','正确位置_0左1右','实际选择_0左1右','是否正确_1是0否','原始反应时_ms','刺激时间ISO','作答时间ISO','上方三组刺激JSON','下方两组刺激JSON'];
export function exportRows(records:AssessmentRecord[]):{summary:Cell[][];trials:Cell[][]} {
  return {summary:[SUMMARY_HEADERS,...records.map(r=>{const s=summarize(r);return [r.studyId,r.sessionId,r.status,r.startedAt,r.endedAt,r.timezone,r.utcOffsetMinutes,r.plannedTrials,s.completedTrials,s.correctCount,s.accuracy,s.medianCorrectRtMs,r.appVersion,r.taskVersion,r.seed,r.interruptionReason];})],
    trials:[TRIAL_HEADERS,...records.flatMap(r=>r.trials.map(t=>{const c=t.stimulus as {top_cards_symbols?:unknown;bottom_cards_symbols?:unknown};return [r.studyId,r.sessionId,r.status,t.trialIndex+1,t.trialIndex,t.correctResponse,t.userResponse,t.correctResponse===t.userResponse?1:0,t.rtMs,t.stimulusAt,t.respondedAt,JSON.stringify(c.top_cards_symbols??null),JSON.stringify(c.bottom_cards_symbols??null)];}))]};
}
export async function makeWorkbook(records:AssessmentRecord[]):Promise<Uint8Array> {
  const zip=new JSZip(),rows=exportRows(records);
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="测评汇总" sheetId="1" r:id="rId1"/><sheet name="逐题记录" sheetId="2" r:id="rId2"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml',sheet(rows.summary));zip.file('xl/worksheets/sheet2.xml',sheet(rows.trials));
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
export async function exportRecords(input:AssessmentRecord[]):Promise<{blob:Blob;fileName:string}> {
  if(!input.length)throw new Error('尚无可导出的记录。');
  const ids=new Set<string>();const records=input.map(r=>{if(ids.has(r.sessionId))throw new Error('导出包含重复记录ID。');ids.add(r.sessionId);return structuredClone(r);});
  const zip=new JSZip();zip.file('测评结果.xlsx',await makeWorkbook(records));
  zip.file('原始记录.json',JSON.stringify({format:'symbol-search-6trial-v1',exporterVersion:APP_VERSION,exportedAt:new Date().toISOString(),records:records.map(record=>({record,summary:summarize(record)}))},null,2));
  zip.file('字段说明.txt','六试次符号搜索\r\nExcel包含测评汇总及逐题记录。研究编号为文本，可保留前导0；正确率为0～1，反应时为毫秒。页面显示经四舍五入，文件保留原始精度。\r\nstatus：completed已完成六题；interrupted未完成；in-progress进行中。未完成记录的正确数、正确率和中位反应时均留空。全部答错时正确数0、正确率0、中位反应时为空。空白不是0分。\r\n逐题题号1～6，SDK原始题号0～5；选择0左、1右。正确数为首次选择正确题数；正确率=正确数/6；中位反应时仅计算正确试次，不额外过滤固定反应时范围或正确率。\r\n相同研究编号可重复测评，每轮有不同记录ID和种子。重复导出的相同记录ID不应重复导入。中断任务不得拼接为完整六题成绩。\r\nISO时间带Z为UTC，设备时区和UTC偏移分钟同时保存（偏移定义为当地时间减UTC）。原始JSON保留SDK原始数据、参数及事件。Excel直接用数值字段导入统计软件。\r\n');
  const safe=records.length===1?records[0].studyId.replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,40):`批量_${records.length}条`;
  return {blob:await zip.generateAsync({type:'blob',compression:'DEFLATE'}),fileName:`符号搜索_${safe||'ID'}_${new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14)}_${records[0].sessionId.slice(0,8)}.zip`};
}
