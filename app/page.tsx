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

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('position', { ascending: true })

  if (error) {
    console.error('Failed to load tasks:', error)
  }

  return (
    <TaskBoard
      initialTasks={(tasks as Task[]) ?? []}
      userId={user.id}
    />
  )
}
