export type TimerMode = 'Idle' | 'Prepare' | 'Work' | 'Rest' | 'Completed';
export interface WorkoutClockConfig { prepareSeconds:number;workSeconds:number;restSeconds:number;totalRounds:number }
export function normalizeWorkoutClock(config:WorkoutClockConfig):WorkoutClockConfig {
 const bounded=(value:number,fallback:number,min:number,max:number)=>Number.isFinite(value)?Math.min(max,Math.max(min,Math.floor(value))):fallback;
 return {prepareSeconds:bounded(config.prepareSeconds,0,0,3600),workSeconds:bounded(config.workSeconds,30,1,3600),restSeconds:bounded(config.restSeconds,0,0,3600),totalRounds:bounded(config.totalRounds,1,1,1000)};
}
export function workoutRoundStart(config:WorkoutClockConfig,round:number) {return (config.prepareSeconds+(round-1)*(config.workSeconds+config.restSeconds))*1000;}
export function workoutDuration(config:WorkoutClockConfig) {return (config.prepareSeconds+config.workSeconds*config.totalRounds+config.restSeconds*(config.totalRounds-1))*1000;}
/** Derive the interval from elapsed monotonic time, including missed/background ticks. */
export function sampleWorkoutClock(config:WorkoutClockConfig,elapsedMs:number) {
 const elapsed=Math.max(0,Number.isFinite(elapsedMs)?elapsedMs:0),duration=workoutDuration(config);
 if(elapsed>=duration)return {mode:'Completed' as TimerMode,currentRound:config.totalRounds,totalRounds:config.totalRounds,timeRemaining:0};
 if(elapsed<config.prepareSeconds*1000)return {mode:'Prepare' as TimerMode,currentRound:1,totalRounds:config.totalRounds,timeRemaining:Math.ceil(config.prepareSeconds-elapsed/1000)};
 const offset=elapsed-config.prepareSeconds*1000,block=(config.workSeconds+config.restSeconds)*1000;
 const round=Math.floor(offset/block)+1,within=offset%block,work=within<config.workSeconds*1000;
 return {mode:(work?'Work':'Rest') as TimerMode,currentRound:round,totalRounds:config.totalRounds,timeRemaining:Math.ceil(((work?config.workSeconds*1000:block)-within)/1000)};
}
