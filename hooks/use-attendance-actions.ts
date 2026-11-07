'use client';
import {useRef,useState} from 'react';
import {useAppStore} from '@/lib/store';
import type {AttendanceDraft} from '@/lib/attendance-write';

/** Quick actions share pending/error handling; calendar editors keep their own draft feedback. */
export function useAttendanceActions() {
  const {markAttendance,markAttendanceMany,deleteAttendanceRecords,showNotification}=useAppStore();
  const running=useRef(false),[busy,setBusy]=useState(false);
  const run=async(work:()=>Promise<void>)=>{
    if(running.current)return false;
    running.current=true;setBusy(true);
    try{await work();return true;}
    catch(error){showNotification(error instanceof Error?error.message:'Attendance could not be confirmed. Reload before retrying.','error');return false;}
    finally{running.current=false;setBusy(false);}
  };
  return {
    busy,
    mark:(studentId:string,date:string,status:AttendanceDraft['status'],classId?:number)=>run(()=>markAttendance(studentId,date,status,classId)),
    markMany:(rows:AttendanceDraft[])=>run(()=>markAttendanceMany(rows)),
    clear:(date:string,studentIds:string[],classId?:number)=>run(()=>deleteAttendanceRecords(date,studentIds,classId)),
  };
}
