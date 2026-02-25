import type { Task, DueType, FlatTask, TimeUnit } from './types'

// ─── 期日ラベル変換 ───────────────────────────────────────────────────────

export function dueTypeToLabel(dueType: DueType, dueDate?: string | null): string {
  switch (dueType) {
    case 'none': return 'なし'
    case 'today': return '今日'
    case 'this_week': return '今週'
    case 'this_month': return '今月'
    case 'this_year': return '今年'
    case 'next_year_plus': return '来年以降'
    case 'repeat_daily': return '繰り返し：毎日'
    case 'repeat_weekly': return '繰り返し：毎週'
    case 'repeat_monthly': return '繰り返し：毎月'
    case 'repeat_yearly': return '繰り返し：毎年'
    case 'specific_date':
      if (!dueDate) return ''
      const d = new Date(dueDate + 'T00:00:00')
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
    default:
      return ''
  }
}

export const DUE_TYPE_OPTIONS: { value: DueType; label: string }[] = [
  { value: 'none', label: 'なし' },
  { value: 'specific_date', label: '特定の日付' },
  { value: 'today', label: '今日' },
  { value: 'this_week', label: '今週' },
  { value: 'this_month', label: '今月' },
  { value: 'this_year', label: '今年' },
  { value: 'next_year_plus', label: '来年以降' },
  { value: 'repeat_daily', label: '繰り返し：毎日' },
  { value: 'repeat_weekly', label: '繰り返し：毎週' },
  { value: 'repeat_monthly', label: '繰り返し：毎月' },
  { value: 'repeat_yearly', label: '繰り返し：毎年' },
]

// ─── 時間表示 ────────────────────────────────────────────────────────────

export function formatTime(value: number | null, unit: TimeUnit | null): string {
  if (value === null || unit === null) return ''
  const unitLabel: Record<TimeUnit, string> = {
    mo: 'mo',
    day: 'day',
    h: 'h',
    min: 'min',
  }
  return `${value}${unitLabel[unit]}`
}

// ─── タスクツリー操作 ─────────────────────────────────────────────────────

/**
 * フラットなタスクリストを、表示順にフラットに並べ替えたリストを返す。
 * 親→子の順で、各親の直後にその子をposition順で挿入する深さ優先探索。
 */
export function buildFlatList(tasks: Task[]): FlatTask[] {
  // parent_id でグループ化
  const byParent = new Map<string | null, Task[]>()
  for (const task of tasks) {
    if (task.archived) continue
    const key = task.parent_id ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(task)
  }

  // position でソート
  for (const [, children] of byParent) {
    children.sort((a, b) => a.position - b.position)
  }

  const childIds = new Set(
    tasks.filter(t => t.parent_id !== null).map(t => t.parent_id!)
  )

  const result: FlatTask[] = []

  function visit(parentId: string | null) {
    const children = byParent.get(parentId) ?? []
    for (const task of children) {
      result.push({ ...task, hasChildren: childIds.has(task.id) })
      visit(task.id)
    }
  }

  visit(null)
  return result
}

/**
 * 指定タスク以下の全サブタスクIDを返す
 */
export function getDescendantIds(taskId: string, tasks: Task[]): string[] {
  const result: string[] = []
  const queue = [taskId]
  while (queue.length > 0) {
    const current = queue.shift()!
    const children = tasks.filter(t => t.parent_id === current)
    for (const child of children) {
      result.push(child.id)
      queue.push(child.id)
    }
  }
  return result
}

// ─── 親タスクの期日に基づく子タスクのデフォルト期日 ──────────────────────

export function getChildDefaultDueType(parentDueType: DueType): DueType {
  switch (parentDueType) {
    case 'next_year_plus': return 'this_year'
    case 'repeat_daily': return 'today'
    case 'repeat_weekly': return 'this_week'
    case 'repeat_monthly': return 'this_month'
    case 'repeat_yearly': return 'this_year'
    default: return 'specific_date'
  }
}

// ─── 繰り返しタスクの完了リセット判定 ────────────────────────────────────

export function shouldResetCompletion(task: Task, now: Date): boolean {
  if (!task.completed || !task.completed_at) return false

  const completedAt = new Date(task.completed_at)

  switch (task.due_type) {
    case 'repeat_daily': {
      // 今日より前に完了した場合はリセット
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      return completedAt < todayStart
    }
    case 'repeat_weekly': {
      // 今週月曜より前に完了した場合はリセット
      const weekStart = new Date(now)
      const day = weekStart.getDay()
      const diff = (day === 0 ? -6 : 1 - day)
      weekStart.setDate(weekStart.getDate() + diff)
      weekStart.setHours(0, 0, 0, 0)
      return completedAt < weekStart
    }
    case 'repeat_monthly': {
      // 今月1日より前に完了した場合はリセット
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return completedAt < monthStart
    }
    case 'repeat_yearly': {
      // 今年1月1日より前に完了した場合はリセット
      const yearStart = new Date(now.getFullYear(), 0, 1)
      return completedAt < yearStart
    }
    default:
      return false
  }
}

// ─── 来年以降の年越し処理 ──────────────────────────────────────────────

/**
 * 'next_year_plus' タスクの年越し確認: 設定した年が過去なら 'this_year' に変更
 * （ここでは単純にupdated_atの年を使う）
 */
export function shouldUpgradeNextYear(task: Task, now: Date): boolean {
  if (task.due_type !== 'next_year_plus') return false
  const updatedYear = new Date(task.updated_at).getFullYear()
  return updatedYear < now.getFullYear()
}

// ─── 新規タスクのposition計算 ────────────────────────────────────────────

/**
 * 末尾に追加する場合の position 値を計算
 */
export function getNextPosition(siblings: Task[]): number {
  if (siblings.length === 0) return 1
  const maxPos = Math.max(...siblings.map(t => t.position))
  return maxPos + 1
}

/**
 * 2つのタスクの間に挿入するための position 値 (fractional indexing)
 */
export function getPositionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1
  if (before === null) return (after! - 1)
  if (after === null) return (before + 1)
  return (before + after) / 2
}
