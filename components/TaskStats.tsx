import type { Task } from '@/lib/types'

interface TaskStatsProps {
  tasks: Task[]
}

export default function TaskStats({ tasks }: TaskStatsProps) {
  const visibleTasks = tasks.filter(t => !t.archived)

  const todayTasks = visibleTasks.filter(t => t.due_type === 'today')
  const todayTotal = todayTasks.length
  const todayDone = todayTasks.filter(t => t.completed).length

  const dailyTasks = visibleTasks.filter(t => t.due_type === 'repeat_daily')
  const dailyTotal = dailyTasks.length
  const dailyDone = dailyTasks.filter(t => t.completed).length

  return (
    <div className="text-sm text-text-secondary space-y-0.5">
      <div className="flex gap-4">
        <span className="w-28 text-text-tertiary">今日のタスク</span>
        <span>
          全体 {todayTotal}件、完了 {todayDone}件、未完了 {todayTotal - todayDone}件
        </span>
      </div>
      <div className="flex gap-4">
        <span className="w-28 text-text-tertiary">毎日のタスク</span>
        <span>
          全体 {dailyTotal}件、完了 {dailyDone}件、未完了 {dailyTotal - dailyDone}件
        </span>
      </div>
    </div>
  )
}
