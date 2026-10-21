import {TRIAL_COUNT,type AssessmentRecord,type SymbolTrial} from './model';
export function validTrials(trials:SymbolTrial[]):boolean {
  return trials.length===TRIAL_COUNT && trials.every((t,i)=>t.trialIndex===i && [0,1].includes(t.userResponse) && [0,1].includes(t.correctResponse) && Number.isFinite(t.rtMs) && t.rtMs>=0);
}
export function median(values:number[]):number|null {
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}
export function summarize(record:AssessmentRecord) {
  const complete=record.status==='completed' && validTrials(record.trials);
  const correct=record.trials.filter(t=>t.userResponse===t.correctResponse);
  return {completedTrials:record.trials.length,correctCount:complete?correct.length:null,
    accuracy:complete?correct.length/TRIAL_COUNT:null,medianCorrectRtMs:complete?median(correct.map(t=>t.rtMs)):null};
}
