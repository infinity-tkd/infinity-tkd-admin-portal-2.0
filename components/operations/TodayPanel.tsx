'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useOperations } from '@/hooks/use-operations';
import { useAppStore } from '@/lib/store';
import { academyDate } from '@/lib/dates';
import { safeNotificationPath } from '@/lib/notifications';
import { Field, OperationForm, OperationSection, text, adminRoles } from './shared';
interface Task { id: string; title: string; description: string; student_id?: string; category: string; due_date: string; assigned_to: string; status: string; revision: number; completion_note?: string }
interface Queue { tasks: Task[]; notices: { id: string; title: string; body: string; href: string }[]; today: string }
export function TodayPanel() {
  const { state, can } = useAppStore(); const [completed, setCompleted] = useState(false); const api = useOperations<Queue>('today', { includeClosed: String(completed) });
  const users = [state.currentUser!, ...state.users.filter(user => user.id !== state.currentUser?.id)].filter(Boolean);
  const categories = [['general', 'General', 'page:dashboard'], ['attendance', 'Attendance', 'page:attendance'], ['billing', 'Membership', 'page:financials'], ['orders', 'Orders', 'page:pos']].filter(([, , permission]) => can(permission as any));
  return <OperationSection title="Today and follow-ups" {...api} onRefresh={() => void api.refresh()}>
    <p className="text-sm text-neutral-500">Assigned actions and outstanding academy updates. Complete a follow-up with its actual outcome.</p>
    <p className="text-xs text-neutral-500">Shows up to 200 permitted follow-ups, ordered by due date. Closed tasks are excluded unless selected below.</p>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={completed} onChange={event => setCompleted(event.target.checked)}/>Show completed and cancelled tasks</label>
    <div className="grid gap-3 lg:grid-cols-2">{api.data?.tasks.filter(task => completed || !['completed', 'cancelled'].includes(task.status)).map(task => <article key={task.id} className="space-y-2 rounded-xl border p-3 dark:border-neutral-800"><p className="text-xs text-neutral-500">{task.category} · due {task.due_date} · {task.status.replaceAll('_', ' ')}</p><h3 className="text-sm font-semibold">{task.title}</h3><p className="whitespace-pre-wrap break-words text-xs text-neutral-500">{task.description}</p><p className="text-xs">Assigned: {users.find(user => user.id === task.assigned_to)?.displayName ?? 'Staff member'}{task.student_id ? ' · ' + task.student_id : ''}</p>{task.completion_note && <p className="text-xs">Outcome: {task.completion_note}</p>}{(task.assigned_to === state.currentUser?.id || adminRoles.includes(state.currentUser?.role ?? '')) && <OperationForm title={`Update ${task.title}`} busy={api.busy} submitLabel="Update follow-up" onSubmit={form => api.run({ action: 'task_update', id: task.id, revision: task.revision, status: text(form, 'status'), note: text(form, 'note') })}><Field label="Task status"><select name="status" defaultValue={task.status}><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></Field><Field label="Outcome / correction reason"><input name="note" minLength={5} maxLength={1000} placeholder="Required when completing or cancelling"/></Field></OperationForm>}</article>)}</div>
    {api.data && !api.data.tasks.length && <p className="text-sm text-neutral-500">No assigned follow-ups yet.</p>}
    <details><summary>Create a follow-up</summary><OperationForm title="New follow-up" busy={api.busy} submitLabel="Assign follow-up" onSubmit={form => api.run({ action: 'task', title: text(form, 'title'), description: text(form, 'description'), category: text(form, 'category'), assignedTo: text(form, 'assignedTo'), dueDate: text(form, 'dueDate'), ...(text(form, 'studentId') ? { studentId: text(form, 'studentId') } : {}) })}>
      <Field label="Title"><input name="title" required minLength={3} maxLength={160}/></Field><Field label="Category"><select name="category">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Assigned staff"><select name="assignedTo" defaultValue={state.currentUser?.id}>{users.filter(user => user.isActive).map(user => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select></Field><Field label="Due date"><input name="dueDate" type="date" required defaultValue={academyDate()}/></Field>
      <Field label="Student (optional)"><select name="studentId"><option value="">General academy task</option>{state.students.map(student => <option key={student.id} value={student.id}>{student.englishName} · {student.id}</option>)}</select></Field><Field label="Context / next action" wide><textarea name="description" maxLength={1000}/></Field>
    </OperationForm></details>
    <h3 className="text-sm font-semibold">Outstanding updates</h3><div className="grid gap-3 lg:grid-cols-2">{api.data?.notices.map(notice => <Link key={notice.id} href={safeNotificationPath(notice.href)} className="min-h-11 rounded-xl border p-3 dark:border-neutral-800"><p className="text-sm font-semibold">{notice.title}</p><p className="mt-1 text-xs text-neutral-500">{notice.body}</p></Link>)}</div>
  </OperationSection>;
}
