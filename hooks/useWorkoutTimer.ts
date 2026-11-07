import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {normalizeWorkoutClock,sampleWorkoutClock,workoutDuration,workoutRoundStart,type WorkoutClockConfig,type TimerMode} from '@/lib/workout-clock';
export type {TimerMode} from '@/lib/workout-clock';
export function useWorkoutTimer(input:WorkoutClockConfig) {
 const {prepareSeconds,workSeconds,restSeconds,totalRounds}=input;
 const config=useMemo(()=>normalizeWorkoutClock({prepareSeconds,workSeconds,restSeconds,totalRounds}),[prepareSeconds,workSeconds,restSeconds,totalRounds]);
 const clock=useRef({elapsed:0,anchor:null as number|null,started:false});
 const [state,setState]=useState({...sampleWorkoutClock(config,0),mode:'Idle' as TimerMode,timeRemaining:config.prepareSeconds,isActive:false});
 const elapsed=useCallback(()=>clock.current.elapsed+(clock.current.anchor===null?0:Math.max(0,performance.now()-clock.current.anchor)),[]);
 const publish=useCallback(()=>{
  const value=elapsed(),sample=sampleWorkoutClock(config,value);
  if(sample.mode==='Completed'){clock.current.elapsed=workoutDuration(config);clock.current.anchor=null;}
  const next=clock.current.started?{...sample,isActive:clock.current.anchor!==null}:{...sample,mode:'Idle' as TimerMode,timeRemaining:config.prepareSeconds,isActive:false};
  setState(old=>old.mode===next.mode&&old.currentRound===next.currentRound&&old.totalRounds===next.totalRounds&&old.timeRemaining===next.timeRemaining&&old.isActive===next.isActive?old:next);
 },[config,elapsed]);
 const resetTimer=useCallback(()=>{clock.current={elapsed:0,anchor:null,started:false};publish();},[publish]);
 useEffect(resetTimer,[resetTimer]);
 useEffect(()=>{
  if(!state.isActive)return;
  const interval=window.setInterval(publish,200);
  const visible=()=>{if(document.visibilityState==='visible')publish();};
  document.addEventListener('visibilitychange',visible);
  return()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',visible);};
 },[state.isActive,publish]);
 const startTimer=()=>{if(clock.current.anchor!==null)return;if(elapsed()>=workoutDuration(config))clock.current.elapsed=0;clock.current.started=true;clock.current.anchor=performance.now();publish();};
 const pauseTimer=()=>{clock.current.elapsed=elapsed();clock.current.anchor=null;publish();};
 const move=(offset:number)=>{const current=sampleWorkoutClock(config,elapsed()),round=Math.max(1,current.currentRound+offset);clock.current.elapsed=round>config.totalRounds?workoutDuration(config):workoutRoundStart(config,round);clock.current.started=true;if(clock.current.anchor!==null)clock.current.anchor=performance.now();publish();};
 return {...state,startTimer,pauseTimer,resetTimer,nextRound:()=>move(1),prevRound:()=>move(-1)};
}
