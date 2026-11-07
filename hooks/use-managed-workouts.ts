'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { portalRequest } from '@/lib/portal-api';

export interface ManagedWorkout {
  id: string; title: string; description: string; difficulty: string; duration: number; creator: string;
  structure: Record<string, unknown>; revision: number; publishedRevision: number | null;
  publicationState: 'draft' | 'published' | 'changes';
}
export function useManagedWorkouts(enabled = true, search = '') {
  const [templates, setTemplates] = useState<ManagedWorkout[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<string|null>(null);
  const generation = useRef(0);
  const invalidate=useCallback(()=>{generation.current++;},[]);
  const busy=useRef(false);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    setTemplates([]);setNextCursor(null);busy.current=false;
    if (!enabled) { setLoading(false); setError(''); return; }
    setLoading(true);
    try {
      const data = await portalRequest<{ templates: ManagedWorkout[];nextCursor:string|null }>('/api/admin/workout-templates?'+new URLSearchParams({q:search,limit:'25'}));
      if(!Array.isArray(data.templates))throw new Error('The routine catalog returned an invalid response.');
      if (generation.current === current) { setTemplates(data.templates);setNextCursor(data.nextCursor); setError(''); }
    } catch (issue) {
      if (generation.current === current) setError(issue instanceof Error ? issue.message : 'Routines could not be loaded.');
    } finally { if (generation.current === current) setLoading(false); }
  }, [enabled,search]);
  const loadMore=useCallback(async()=>{
    if(!enabled||!nextCursor||busy.current)return;
    busy.current=true;setLoading(true);const current=generation.current;
    try{
      const data=await portalRequest<{templates:ManagedWorkout[];nextCursor:string|null}>('/api/admin/workout-templates?'+new URLSearchParams({q:search,limit:'25',cursor:nextCursor}));
      if(!Array.isArray(data.templates))throw new Error('The routine catalog returned an invalid response.');
      if(current===generation.current){setTemplates(previous=>[...previous,...data.templates.filter(row=>!previous.some(item=>item.id===row.id))]);setNextCursor(data.nextCursor);setError('');}
    }catch(issue){if(current===generation.current)setError(issue instanceof Error?issue.message:'More routines could not be loaded.');}
    finally{if(current===generation.current){busy.current=false;setLoading(false);}}
  },[enabled,nextCursor,search]);
  useEffect(() => {const timer=setTimeout(()=>{void reload();},search?250:0);return()=>{clearTimeout(timer);invalidate();};},[reload,search,invalidate]);
  return { templates, loading, error, reload,loadMore,hasMore:nextCursor!==null };
}
