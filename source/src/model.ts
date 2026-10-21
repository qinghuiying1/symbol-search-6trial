export const APP_VERSION='1.0.0-rc.1';
export const TASK_VERSION='symbol-search-6trial-portrait-1';
export const SCHEMA_VERSION=1;
export const TRIAL_COUNT=6;
export const DATABASE_NAME='symbol-search-6trial';
export interface SymbolTrial {
  trialIndex:number; stimulus:unknown; correctResponse:number; userResponse:number;
  rtMs:number; stimulusAt:string; respondedAt:string; raw:Record<string,unknown>;
}
export interface TaskEvent {kind:string;at:string;details?:Record<string,unknown>}
export interface AssessmentRecord {
  sessionId:string;studyId:string;schemaVersion:number;appVersion:string;taskVersion:string;
  status:'in-progress'|'completed'|'interrupted';seed:string;plannedTrials:6;
  startedAt:string;endedAt:string|null;timezone:string;utcOffsetMinutes:number;
  parameters:Record<string,unknown>;trials:SymbolTrial[];events:TaskEvent[];interruptionReason:string;
  device:{userAgent:string;width:number;height:number;pixelRatio:number};
}
export function addEvent(r:AssessmentRecord,kind:string,details?:Record<string,unknown>):void {
  r.events.push({kind,at:new Date().toISOString(),...(details?{details}:{} )});
}
