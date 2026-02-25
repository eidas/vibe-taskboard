'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Task, FlatTask, FilterType, DueType, TimeUnit } from '@/lib/types'
import {
  buildFlatList,
  getDescendantIds,
  getChildDefaultDueType,
  shouldResetCompletion,
  shouldUpgradeNextYear,
  getNextPosition,
  getPositionBetween,
} from '@/lib/task-utils'
import { createClient } from '@/lib/supabase/client'
import FilterButtons from './FilterButtons'
import TaskStats from './TaskStats'
import TaskRow from './TaskRow'

interface TaskBoardProps {
  initialTasks: Task[]
  userId: string
}

export default function TaskBoard({ initialTasks, userId }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [filter, setFilter] = useState<FilterType>('all')
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [focusedColumn, setFocusedColumn] = useState<'name' | 'due' | 'time' | 'checkbox' | null>(null)
  const supabase = createClient()

  // ─── 繰り返しタスクのリセット処理 ─────────────────────────────────────
  useEffect(() => {
    const now = new Date()
    const toReset: string[] = []
    const toUpgrade: string[] = []

    for (const task of tasks) {
      if (shouldResetCompletion(task, now)) toReset.push(task.id)
      if (shouldUpgradeNextYear(task, now)) toUpgrade.push(task.id)
    }

    if (toReset.length > 0) {
      const resetTasks = tasks.map(t =>
        toReset.includes(t.id) ? { ...t, completed: false, completed_at: null } : t
      )
      setTasks(resetTasks)
      supabase
        .from('tasks')
        .update({ completed: false, completed_at: null })
        .in('id', toReset)
        .then(() => {})
    }

    if (toUpgrade.length > 0) {
      const upgradedTasks = tasks.map(t =>
        toUpgrade.includes(t.id) ? { ...t, due_type: 'this_year' as DueType } : t
      )
      setTasks(upgradedTasks)
      supabase
        .from('tasks')
        .update({ due_type: 'this_year' })
        .in('id', toUpgrade)
        .then(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── フラットリスト（表示用） ─────────────────────────────────────────
  const flatList = buildFlatList(tasks)

  // フィルター後のリスト
  const filteredList: FlatTask[] = flatList.filter(task => {
    if (filter === 'completed') return task.completed
    if (filter === 'incomplete') return !task.completed
    return true
  })

  // ─── センサー設定 ────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // ─── タスク更新 ──────────────────────────────────────────────────────
  const handleUpdate = useCallback(async (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    await supabase.from('tasks').update(updates).eq('id', id)
  }, [supabase])

  // ─── 完了切り替え（子タスクにカスケード） ────────────────────────────
  const handleToggleComplete = useCallback(async (id: string, completed: boolean) => {
    const now = new Date().toISOString()
    const descendantIds = getDescendantIds(id, tasks)
    const allIds = [id, ...descendantIds]

    setTasks(prev =>
      prev.map(t =>
        allIds.includes(t.id)
          ? { ...t, completed, completed_at: completed ? now : null }
          : t
      )
    )

    await supabase
      .from('tasks')
      .update({ completed, completed_at: completed ? now : null })
      .in('id', allIds)
  }, [tasks, supabase])

  // ─── タスク追加 ──────────────────────────────────────────────────────
  const handleAdd = useCallback(async (parentId: string | null, level: number) => {
    // 同じ親の兄弟タスクを取得して position を決める
    const siblings = tasks.filter(t => t.parent_id === parentId && !t.archived)
    const position = getNextPosition(siblings)

    // 親タスクの期日からデフォルト期日を計算
    let defaultDueType: DueType = 'specific_date'
    if (parentId) {
      const parent = tasks.find(t => t.id === parentId)
      if (parent) defaultDueType = getChildDefaultDueType(parent.due_type)
    }

    // デフォルトの日付（今日）
    const today = new Date()
    const defaultDueDate = defaultDueType === 'specific_date'
      ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      : null

    const newTask: Omit<Task, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      parent_id: parentId,
      level,
      name: '',
      due_type: defaultDueType,
      due_date: defaultDueDate,
      estimated_time_value: null,
      estimated_time_unit: null,
      actual_time_value: null,
      actual_time_unit: null,
      notes: '',
      completed: false,
      completed_at: null,
      archived: false,
      position,
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert(newTask)
      .select()
      .single()

    if (!error && data) {
      setTasks(prev => [...prev, data as Task])
      // 新規追加したタスクにフォーカス
      setTimeout(() => setFocusedId(data.id), 50)
    }
  }, [tasks, userId, supabase])

  // ─── タスク削除（アーカイブ） ─────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    const descendantIds = getDescendantIds(id, tasks)
    const hasChildren = descendantIds.length > 0

    if (hasChildren) {
      const confirmed = window.confirm(
        '子タスクも削除されます。\n続けますか？'
      )
      if (!confirmed) return
    }

    const allIds = [id, ...descendantIds]
    setTasks(prev => prev.map(t =>
      allIds.includes(t.id) ? { ...t, archived: true } : t
    ))
    await supabase.from('tasks').update({ archived: true }).in('id', allIds)
  }, [tasks, supabase])

  // ─── レベル上げ ──────────────────────────────────────────────────────
  const handleLevelUp = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task || task.level <= 1 || !task.parent_id) return

    const parent = tasks.find(t => t.id === task.parent_id)
    if (!parent) return

    const newLevel = task.level - 1
    const newParentId = parent.parent_id

    // 親の後ろに挿入するposition
    const siblings = tasks.filter(t => t.parent_id === newParentId && !t.archived)
    const parentIndex = siblings.findIndex(t => t.id === parent.id)
    const afterParent = siblings[parentIndex]
    const nextSibling = siblings[parentIndex + 1]
    const newPosition = getPositionBetween(
      afterParent.position,
      nextSibling?.position ?? null
    )

    const descendantIds = getDescendantIds(id, tasks)
    const updates: Partial<Task> = { parent_id: newParentId, level: newLevel, position: newPosition }

    setTasks(prev => prev.map(t => {
      if (t.id === id) return { ...t, ...updates }
      if (descendantIds.includes(t.id)) return { ...t, level: t.level - 1 }
      return t
    }))

    await supabase.from('tasks').update(updates).eq('id', id)
    // 子孫のレベルも更新
    for (const descId of descendantIds) {
      const desc = tasks.find(t => t.id === descId)
      if (desc) {
        await supabase.from('tasks').update({ level: desc.level - 1 }).eq('id', descId)
      }
    }
  }, [tasks, supabase])

  // ─── レベル下げ ──────────────────────────────────────────────────────
  const handleLevelDown = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task || task.level >= 5) return

    // 同じ親の中で直前にいる兄弟を探す（その子にする）
    const siblings = tasks
      .filter(t => t.parent_id === task.parent_id && !t.archived && t.id !== id)
      .sort((a, b) => a.position - b.position)

    const taskFlatIndex = buildFlatList(tasks).findIndex(t => t.id === id)
    // フラットリストで直前のタスク（同じ親の兄弟）
    const prevSibling = siblings.filter(s => {
      const idx = buildFlatList(tasks).findIndex(t => t.id === s.id)
      return idx < taskFlatIndex
    }).pop()

    if (!prevSibling) return // 直前の兄弟がいない場合はレベル下げ不可

    const newLevel = task.level + 1
    const newParentId = prevSibling.id

    // 新しい親の子の末尾に追加
    const newSiblings = tasks.filter(t => t.parent_id === newParentId && !t.archived)
    const newPosition = getNextPosition(newSiblings)

    const descendantIds = getDescendantIds(id, tasks)
    const updates: Partial<Task> = { parent_id: newParentId, level: newLevel, position: newPosition }

    setTasks(prev => prev.map(t => {
      if (t.id === id) return { ...t, ...updates }
      if (descendantIds.includes(t.id)) return { ...t, level: t.level + 1 }
      return t
    }))

    await supabase.from('tasks').update(updates).eq('id', id)
    for (const descId of descendantIds) {
      const desc = tasks.find(t => t.id === descId)
      if (desc) {
        await supabase.from('tasks').update({ level: desc.level + 1 }).eq('id', descId)
      }
    }
  }, [tasks, supabase])

  // ─── フォーカス移動 ──────────────────────────────────────────────────
  const handleFocusNext = useCallback((id: string) => {
    const idx = filteredList.findIndex(t => t.id === id)
    if (idx < filteredList.length - 1) {
      setFocusedId(filteredList[idx + 1].id)
    }
  }, [filteredList])

  const handleFocusPrev = useCallback((id: string) => {
    const idx = filteredList.findIndex(t => t.id === id)
    if (idx > 0) {
      setFocusedId(filteredList[idx - 1].id)
    }
  }, [filteredList])

  // ─── ドラッグ&ドロップ ───────────────────────────────────────────────
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeTask = tasks.find(t => t.id === active.id)
    const overTask = tasks.find(t => t.id === over.id)
    if (!activeTask || !overTask) return

    // 自分の子孫にはドロップできない（循環参照防止）
    const descendantIds = getDescendantIds(activeTask.id, tasks)
    if (descendantIds.includes(overTask.id)) return

    // フラットリストでの位置を取得
    const flatAll = buildFlatList(tasks)
    const activeIdx = flatAll.findIndex(t => t.id === active.id)
    const overIdx = flatAll.findIndex(t => t.id === over.id)

    if (activeIdx === -1 || overIdx === -1) return

    const sameParent = activeTask.parent_id === overTask.parent_id

    if (sameParent) {
      // 同じ親の中での並べ替え
      const sorted = [...flatAll]
      const [removed] = sorted.splice(activeIdx, 1)
      sorted.splice(overIdx, 0, removed)

      const newIdx = sorted.findIndex(t => t.id === active.id)
      const before = newIdx > 0 ? sorted[newIdx - 1].position : null
      const after = newIdx < sorted.length - 1 ? sorted[newIdx + 1].position : null
      const newPosition = getPositionBetween(before, after)

      setTasks(prev => prev.map(t =>
        t.id === activeTask.id ? { ...t, position: newPosition } : t
      ))

      await supabase.from('tasks').update({ position: newPosition }).eq('id', activeTask.id)
    } else {
      // 別の親への移動
      const newParentId = overTask.parent_id
      const newLevel = overTask.level
      const levelDiff = newLevel - activeTask.level

      // レベル制限チェック（子孫含めて1-5に収まるか）
      const maxDescendantLevel = descendantIds.reduce((max, id) => {
        const desc = tasks.find(t => t.id === id)
        return desc ? Math.max(max, desc.level) : max
      }, activeTask.level)
      if (maxDescendantLevel + levelDiff > 5 || newLevel < 1) return

      // ターゲットの兄弟の中での位置を計算
      const newSiblings = tasks
        .filter(t => t.parent_id === newParentId && !t.archived && t.id !== activeTask.id)
        .sort((a, b) => a.position - b.position)

      const overSiblingIdx = newSiblings.findIndex(t => t.id === overTask.id)

      let newPosition: number
      if (activeIdx < overIdx) {
        // 下に移動：ターゲットの後ろに配置
        const beforePos = overTask.position
        const afterPos = newSiblings[overSiblingIdx + 1]?.position ?? null
        newPosition = getPositionBetween(beforePos, afterPos)
      } else {
        // 上に移動：ターゲットの前に配置
        const beforePos = overSiblingIdx > 0 ? newSiblings[overSiblingIdx - 1].position : null
        const afterPos = overTask.position
        newPosition = getPositionBetween(beforePos, afterPos)
      }

      // ローカルステート更新
      setTasks(prev => prev.map(t => {
        if (t.id === activeTask.id) {
          return { ...t, parent_id: newParentId, level: newLevel, position: newPosition }
        }
        if (descendantIds.includes(t.id)) {
          return { ...t, level: t.level + levelDiff }
        }
        return t
      }))

      // DB更新
      await supabase.from('tasks').update({
        parent_id: newParentId,
        level: newLevel,
        position: newPosition,
      }).eq('id', activeTask.id)

      for (const descId of descendantIds) {
        const desc = tasks.find(t => t.id === descId)
        if (desc) {
          await supabase.from('tasks').update({ level: desc.level + levelDiff }).eq('id', descId)
        }
      }
    }
  }, [tasks, supabase])

  // ─── 追加ボタンの表示ロジック ─────────────────────────────────────────
  // レベル1の親タスクごとに、ツリー末尾に1個の子追加ボタンを表示
  const fullFlatList = buildFlatList(tasks)

  const addButtonsAfter = new Map<string, { parentId: string | null; level: number }[]>()

  for (let i = 0; i < fullFlatList.length; i++) {
    const task = fullFlatList[i]
    const nextTask = fullFlatList[i + 1]

    // ツリーの末尾判定：次のタスクがL1（新しいツリー）または末尾
    if (!nextTask || nextTask.level === 1) {
      const buttons: { parentId: string | null; level: number }[] = []

      // このタスクが属するL1親を探す
      let rootParentId: string | null = null
      for (let j = i; j >= 0; j--) {
        if (fullFlatList[j].level === 1) {
          rootParentId = fullFlatList[j].id
          break
        }
      }

      // L1親の子追加ボタン
      if (rootParentId) {
        buttons.push({ parentId: rootParentId, level: 2 })
      }

      // 最後のタスクの場合、ルートレベル追加ボタンも表示
      if (!nextTask) {
        buttons.push({ parentId: null, level: 1 })
      }

      if (buttons.length > 0) {
        addButtonsAfter.set(task.id, buttons)
      }
    }
  }

  const showRootAddButton = fullFlatList.length === 0

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-medium text-gray-800">タスク管理ボード</h1>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            ログアウト
          </button>
        </form>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* フィルターボタン */}
        <FilterButtons current={filter} onChange={setFilter} />

        {/* 統計 */}
        <TaskStats tasks={tasks} />
      </div>

      {/* タスクテーブル */}
      <div className="px-4 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredList.map(t => t.id)}
            strategy={verticalListSortingStrategy}
          >
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="w-6"></th>
              <th className="w-6"></th>
              <th className="text-left py-1.5 px-1 font-medium text-gray-700">タスク名</th>
              <th className="text-left py-1.5 px-1 font-medium text-gray-700 w-36">期日</th>
              <th className="text-left py-1.5 px-1 font-medium text-gray-700 w-24">見積り時間</th>
              <th className="text-left py-1.5 px-1 font-medium text-gray-700 w-20">備考</th>
              <th className="w-8"></th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
                {filteredList.map(task => (
                  <Fragment key={task.id}>
                    <TaskRow
                      task={task}
                      focusedId={focusedId}
                      focusedColumn={focusedColumn}
                      onFocus={(id, col) => { setFocusedId(id); setFocusedColumn(col) }}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onToggleComplete={handleToggleComplete}
                      onLevelUp={handleLevelUp}
                      onLevelDown={handleLevelDown}
                      onFocusNext={handleFocusNext}
                      onFocusPrev={handleFocusPrev}
                    />
                    {filter === 'all' && addButtonsAfter.get(task.id)?.map((btn, i) => (
                      <tr key={`add-${task.id}-${btn.level}-${i}`}>
                        <td colSpan={2}></td>
                        <td colSpan={6}>
                          <div style={{ paddingLeft: `${(btn.level - 1) * 20 + 4}px` }}>
                            <button
                              onClick={() => handleAdd(btn.parentId, btn.level)}
                              className="text-blue-500 hover:text-blue-700 text-sm py-0.5 flex items-center gap-0.5"
                            >
                              <span>+</span>
                              <span>追加</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}

                {filter === 'all' && showRootAddButton && (
                  <tr>
                    <td colSpan={2}></td>
                    <td colSpan={6}>
                      <button
                        onClick={() => handleAdd(null, 1)}
                        className="text-blue-500 hover:text-blue-700 text-sm py-0.5 flex items-center gap-0.5 ml-1"
                      >
                        <span>+</span>
                        <span>追加</span>
                      </button>
                    </td>
                  </tr>
                )}
          </tbody>
        </table>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
