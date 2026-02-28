import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TaskBoard from '@/components/TaskBoard'
import type { Task } from '@/lib/types'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: tasks, error }, { data: collapsedRows }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('position', { ascending: true }),
    supabase
      .from('task_collapsed_states')
      .select('task_id')
      .eq('user_id', user.id),
  ])

  if (error) {
    console.error('Failed to load tasks:', error)
  }

  const initialCollapsedIds = (collapsedRows ?? []).map((r: { task_id: string }) => r.task_id)

  return (
    <TaskBoard
      initialTasks={(tasks as Task[]) ?? []}
      initialCollapsedIds={initialCollapsedIds}
      userId={user.id}
    />
  )
}
