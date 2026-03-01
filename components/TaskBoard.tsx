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
  initialCollapsedIds: string[]
  initialTheme: 'dark' | 'light'
  userId: string
}

export default function TaskBoard({ initialTasks, initialCollapsedIds, initialTheme, userId }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [filter, setFilter] = useState<FilterType>('all')
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [focusedColumn, setFocusedColumn] = useState<'name' | 'due' | 'time' | 'checkbox' | null>(null)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set(initialCollapsedIds))
  const [theme, setTheme] = useState<'dark' | 'light'>(initialTheme)
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)
  const supabase = createClient()

  // ─── 列幅リサイズ ────────────────────────────────────────────────────
  const [colWidths, setColWidths] = useState<Record<string, number | undefined>>({})
  const resizeColRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null)

  const handleResizeStart = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const th = (e.target as HTMLElement).closest('th')!
    const startWidth = th.getBoundingClientRect().width
    const startX = e.clientX
    const minWidths: Record<string, number> = { name: 100, due: 80, time: 60, notes: 50 }
    const minW = minWidths[col] ?? 40

    resizeColRef.current = { col, startX, startWidth }

    const onMouseMove = (moveE: MouseEvent) => {
      if (!resizeColRef.current) return
      const diff = moveE.clientX - resizeColRef.current.startX
      const newWidth = Math.max(minW, resizeColRef.current.startWidth + diff)
      setColWidths(prev => ({ ...prev, [resizeColRef.current!.col]: newWidth }))
    }

    const onMouseUp = () => {
      resizeColRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  // ─── ヘッダー高さ監視 ─────────────────────────────────────────────
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setHeaderHeight(el.getBoundingClientRect().height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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

  // ─── テーマ切替 ──────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  const handleToggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      supabase
        .from('user_preferences')
        .upsert({ user_id: userId, theme: next }, { onConflict: 'user_id' })
        .then()
      return next
    })
  }, [supabase, userId])

  // ─── 折りたたみトグル ──────────────────────────────────────────────────
  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        supabase.from('task_collapsed_states').delete().eq('user_id', userId).eq('task_id', id).then()
      } else {
        next.add(id)
        supabase.from('task_collapsed_states').insert({ user_id: userId, task_id: id }).then()
      }
      return next
    })
  }, [supabase, userId])

  // ─── フラットリスト（表示用） ─────────────────────────────────────────
  const flatList = buildFlatList(tasks)

  // 折りたたみ済みタスクの子孫を除外
  const visibleList: FlatTask[] = []
  const skipDescendantsOf = new Set<string>()
  for (const task of flatList) {
    // 祖先が折りたたまれていたらスキップ
    if (task.parent_id && skipDescendantsOf.has(task.parent_id)) {
      skipDescendantsOf.add(task.id)
      continue
    }
    visibleList.push(task)
    if (collapsedIds.has(task.id)) {
      skipDescendantsOf.add(task.id)
    }
  }

  // フィルター後のリスト
  const filteredList: FlatTask[] = visibleList.filter(task => {
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

  // ─── フォーカス設定 ──────────────────────────────────────────────────
  const handleFocus = useCallback((id: string, column: 'name' | 'due' | 'time' | 'checkbox') => {
    setFocusedId(id)
    setFocusedColumn(column)
  }, [])

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
    const { active, over, delta } = event
    if (!over) return

    const activeTask = tasks.find(t => t.id === active.id)
    if (!activeTask) return

    const INDENT_PX = 20
    const levelDelta = Math.round(delta.x / INDENT_PX)

    const descendantIds = getDescendantIds(activeTask.id, tasks)

    // 同じ位置へのドロップ → 水平移動によるレベル変更のみ処理
    if (active.id === over.id) {
      if (levelDelta === 0) return

      const flatAll = buildFlatList(tasks)
      const activeIdx = flatAll.findIndex(t => t.id === active.id)
      if (activeIdx === -1) return

      // activeとその子孫を除いたリスト
      const cleaned = flatAll.filter(t => t.id !== activeTask.id && !descendantIds.includes(t.id))

      // 挿入位置は元の位置の直前（自分を除いたリストでの位置）
      const insertAfterIdx = activeIdx - 1 - flatAll.slice(0, activeIdx).filter(t => descendantIds.includes(t.id)).length

      // 子孫の最大深度差
      const maxDescendantDepth = descendantIds.reduce((max, id) => {
        const desc = tasks.find(t => t.id === id)
        return desc ? Math.max(max, desc.level - activeTask.level) : max
      }, 0)

      // 有効レベル範囲
      const taskAbove = insertAfterIdx >= 0 ? cleaned[insertAfterIdx] : null
      const taskBelow = insertAfterIdx + 1 < cleaned.length ? cleaned[insertAfterIdx + 1] : null
      const maxLevel = Math.min(
        taskAbove ? taskAbove.level + 1 : 1,
        5 - maxDescendantDepth
      )
      // 下のタスクのレベル以上でなければならない（子が孤立しないように）
      const minLevel = taskBelow ? Math.min(taskBelow.level, activeTask.level) : 1
      let newLevel = Math.max(minLevel, Math.min(maxLevel, activeTask.level + levelDelta))

      if (newLevel === activeTask.level) return

      // 新しい親を探す
      let newParentId: string | null = null
      if (newLevel > 1) {
        for (let i = insertAfterIdx; i >= 0; i--) {
          if (cleaned[i].level === newLevel - 1) {
            newParentId = cleaned[i].id
            break
          }
          if (cleaned[i].level < newLevel - 1) break
        }
        if (newParentId === null) {
          newLevel = 1
        }
      }

      if (newLevel === activeTask.level) return

      const levelDiff = newLevel - activeTask.level

      // 新しい兄弟の中でのposition計算
      const newSiblings = cleaned
        .filter(t => t.parent_id === newParentId)
        .sort((a, b) => a.position - b.position)

      let beforeSibling: FlatTask | null = null
      let afterSibling: FlatTask | null = null
      for (const sib of newSiblings) {
        const sibIdx = cleaned.findIndex(t => t.id === sib.id)
        if (sibIdx <= insertAfterIdx) {
          beforeSibling = sib
        } else if (!afterSibling) {
          afterSibling = sib
        }
      }

      const newPosition = getPositionBetween(
        beforeSibling?.position ?? null,
        afterSibling?.position ?? null
      )

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
      return
    }

    // 別のタスクへのドロップ → 並べ替え＋レベル変更
    const overTask = tasks.find(t => t.id === over.id)
    if (!overTask) return

    // 自分の子孫にはドロップできない（循環参照防止）
    if (descendantIds.includes(overTask.id)) return

    // フラットリストでの位置を取得
    const flatAll = buildFlatList(tasks)
    const activeIdx = flatAll.findIndex(t => t.id === active.id)
    const overIdx = flatAll.findIndex(t => t.id === over.id)
    if (activeIdx === -1 || overIdx === -1) return

    // activeとその子孫を除いたリスト
    const cleaned = flatAll.filter(t => t.id !== activeTask.id && !descendantIds.includes(t.id))
    const cleanOverIdx = cleaned.findIndex(t => t.id === over.id)
    if (cleanOverIdx === -1) return

    // 挿入位置を決定（overの前 or 後）
    const insertAfterIdx = activeIdx < overIdx ? cleanOverIdx : cleanOverIdx - 1

    // 子孫の最大深度差（レベル制限チェック用）
    const maxDescendantDepth = descendantIds.reduce((max, id) => {
      const desc = tasks.find(t => t.id === id)
      return desc ? Math.max(max, desc.level - activeTask.level) : max
    }, 0)

    // 挿入位置での有効レベル範囲
    const taskAbove = insertAfterIdx >= 0 ? cleaned[insertAfterIdx] : null
    const maxLevel = Math.min(
      taskAbove ? taskAbove.level + 1 : 1,
      5 - maxDescendantDepth
    )
    let newLevel = Math.max(1, Math.min(maxLevel, activeTask.level + levelDelta))

    // 新しい親を探す（挿入位置から上方向に、newLevel - 1 のタスクを探す）
    let newParentId: string | null = null
    if (newLevel > 1) {
      for (let i = insertAfterIdx; i >= 0; i--) {
        if (cleaned[i].level === newLevel - 1) {
          newParentId = cleaned[i].id
          break
        }
        if (cleaned[i].level < newLevel - 1) break
      }
      if (newParentId === null) {
        newLevel = 1 // 有効な親が見つからない場合はルートに
      }
    }

    const levelDiff = newLevel - activeTask.level

    // 新しい兄弟の中でのposition計算
    const newSiblings = cleaned
      .filter(t => t.parent_id === newParentId)
      .sort((a, b) => a.position - b.position)

    let beforeSibling: FlatTask | null = null
    let afterSibling: FlatTask | null = null
    for (const sib of newSiblings) {
      const sibIdx = cleaned.findIndex(t => t.id === sib.id)
      if (sibIdx <= insertAfterIdx) {
        beforeSibling = sib
      } else if (!afterSibling) {
        afterSibling = sib
      }
    }

    const newPosition = getPositionBetween(
      beforeSibling?.position ?? null,
      afterSibling?.position ?? null
    )

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

      if (buttons.length > 0) {
        addButtonsAfter.set(task.id, buttons)
      }
    }
  }

  // ルートレベル追加ボタンは常に表示
  const showRootAddButton = true

  return (
    <div className="min-h-screen bg-base">
      {/* Stickyヘッダー */}
      <div ref={headerRef} className="sticky top-0 z-20 bg-surface border-b border-border-default">
        {/* タイトルバー（常に表示） */}
        <div className="px-6 py-2 flex items-center justify-between">
          <h1 className="text-base font-medium text-text-primary">タスク管理ボード</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleTheme}
              className="text-text-tertiary hover:text-text-secondary p-1 transition-colors"
              aria-label={theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                ログアウト
              </button>
            </form>
            <button
              onClick={() => setHeaderCollapsed(prev => !prev)}
              className="text-text-tertiary hover:text-text-secondary p-1 transition-colors"
              aria-label={headerCollapsed ? 'ヘッダーを展開' : 'ヘッダーを折りたたむ'}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${headerCollapsed ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* 折りたたみ可能エリア（フィルター + 統計） */}
        <div className={`overflow-hidden transition-all duration-300 ${headerCollapsed ? 'max-h-0' : 'max-h-40'}`}>
          <div className="px-4 pb-3 space-y-3">
            <FilterButtons current={filter} onChange={setFilter} />
            <TaskStats tasks={tasks} />
          </div>
        </div>
      </div>

      {/* タスクテーブル */}
      <div className="px-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredList.map(t => t.id)}
            strategy={verticalListSortingStrategy}
          >
        <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky z-10 bg-surface" style={{ top: `${headerHeight}px` }}>
            <tr className="border-b border-border-strong">
              <th className="w-6"></th>
              <th className="w-6"></th>
              <th
                className="text-left py-1.5 px-1 font-medium text-text-secondary relative"
                style={colWidths.name != null ? { width: colWidths.name } : undefined}
              >
                タスク名
                <div
                  onMouseDown={(e) => handleResizeStart('name', e)}
                  className="absolute top-0 bottom-0 cursor-col-resize hover:bg-accent-solid z-10"
                  style={{ right: -2, width: 5 }}
                />
              </th>
              <th
                className={`text-left py-1.5 px-1 font-medium text-text-secondary relative${colWidths.due == null ? ' w-36' : ''}`}
                style={colWidths.due != null ? { width: colWidths.due } : undefined}
              >
                期日
                <div
                  onMouseDown={(e) => handleResizeStart('due', e)}
                  className="absolute top-0 bottom-0 cursor-col-resize hover:bg-accent-solid z-10"
                  style={{ right: -2, width: 5 }}
                />
              </th>
              <th
                className={`text-left py-1.5 px-1 font-medium text-text-secondary relative${colWidths.time == null ? ' w-24' : ''}`}
                style={colWidths.time != null ? { width: colWidths.time } : undefined}
              >
                見積り時間
                <div
                  onMouseDown={(e) => handleResizeStart('time', e)}
                  className="absolute top-0 bottom-0 cursor-col-resize hover:bg-accent-solid z-10"
                  style={{ right: -2, width: 5 }}
                />
              </th>
              <th
                className={`text-left py-1.5 px-1 font-medium text-text-secondary relative${colWidths.notes == null ? ' w-20' : ''}`}
                style={colWidths.notes != null ? { width: colWidths.notes } : undefined}
              >
                備考
                <div
                  onMouseDown={(e) => handleResizeStart('notes', e)}
                  className="absolute top-0 bottom-0 cursor-col-resize hover:bg-accent-solid z-10"
                  style={{ right: -2, width: 5 }}
                />
              </th>
              <th className="w-8"></th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
                {filteredList.map(task => (
                  <Fragment key={task.id}>
                    <TaskRow
                      task={task}
                      collapsed={collapsedIds.has(task.id)}
                      onToggleCollapse={handleToggleCollapse}
                      isFocused={focusedId === task.id}
                      focusedColumn={focusedId === task.id ? focusedColumn : null}
                      onFocus={handleFocus}
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
                              className="text-accent-solid hover:text-accent-start transition-colors text-sm py-0.5 flex items-center gap-0.5"
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
                        className="text-accent-solid hover:text-accent-start transition-colors text-sm py-0.5 flex items-center gap-0.5 pl-1"
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
