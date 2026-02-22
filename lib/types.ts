export type DueType =
  | 'specific_date'
  | 'none'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_year'
  | 'next_year_plus'
  | 'repeat_daily'
  | 'repeat_weekly'
  | 'repeat_monthly'
  | 'repeat_yearly'

export type TimeUnit = 'mo' | 'day' | 'h' | 'min'

export interface Task {
  id: string
  user_id: string
  parent_id: string | null
  level: number
  name: string
  due_type: DueType
  due_date: string | null // ISO date string (YYYY-MM-DD)
  estimated_time_value: number | null
  estimated_time_unit: TimeUnit | null
  actual_time_value: number | null
  actual_time_unit: TimeUnit | null
  notes: string
  completed: boolean
  completed_at: string | null
  archived: boolean
  position: number
  created_at: string
  updated_at: string
}

// UI表示用のフラットなタスクアイテム（レンダリング順に並んだリスト）
export interface FlatTask extends Task {
  // children の id リスト（子タスクが存在するかどうかの判定用）
  hasChildren: boolean
}

export type FilterType = 'all' | 'completed' | 'incomplete'

export type TaskUpdate = Partial<
  Pick<
    Task,
    | 'name'
    | 'due_type'
    | 'due_date'
    | 'estimated_time_value'
    | 'estimated_time_unit'
    | 'actual_time_value'
    | 'actual_time_unit'
    | 'notes'
    | 'completed'
    | 'completed_at'
    | 'parent_id'
    | 'level'
    | 'position'
  >
>
