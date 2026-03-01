'use client'

import { useState, useEffect, memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FlatTask, Task, DueType, TimeUnit } from '@/lib/types'
import InlineEdit from './InlineEdit'
import DueDateSelect from './DueDateSelect'
import TimeEdit from './TimeEdit'
import TaskEditDialog from './TaskEditDialog'

interface TaskRowProps {
  task: FlatTask
  collapsed: boolean
  onToggleCollapse: (id: string) => void
  isFocused: boolean
  focusedColumn: 'name' | 'due' | 'time' | 'checkbox' | null
  onFocus: (id: string, column: 'name' | 'due' | 'time' | 'checkbox') => void
  onUpdate: (id: string, updates: Partial<Task>) => void
  onDelete: (id: string) => void
  onToggleComplete: (id: string, completed: boolean) => void
  onLevelUp: (id: string) => void
  onLevelDown: (id: string) => void
  onFocusNext: (id: string) => void
  onFocusPrev: (id: string) => void
}

export default memo(function TaskRow({
  task,
  collapsed,
  onToggleCollapse,
  isFocused,
  focusedColumn,
  onFocus,
  onUpdate,
  onDelete,
  onToggleComplete,
  onLevelUp,
  onLevelDown,
  onFocusNext,
  onFocusPrev,
}: TaskRowProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = mounted ? {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } : {}
  const dragProps = mounted ? { ...attributes, ...listeners } : {}

  const indent = (task.level - 1) * 20 // px per level

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'ArrowRight') {
      e.preventDefault()
      onLevelDown(task.id)
    } else if (e.ctrlKey && e.key === 'ArrowLeft') {
      e.preventDefault()
      onLevelUp(task.id)
    }
  }

  const handleCheckboxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggleComplete(task.id, !task.completed)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      onFocusPrev(task.id)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onFocusNext(task.id)
    }
  }

  return (
    <>
      <tr
        ref={setNodeRef}
        style={style}
        className={`border-b border-border-subtle group transition-[background-color,box-shadow] duration-150 ease-out hover:bg-surface-raised hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)] ${isDragging ? 'bg-accent-muted shadow-lg' : ''}`}
        onKeyDown={handleRowKeyDown}
      >
        {/* ドラッグハンドル */}
        <td className="w-6 py-1 pl-1 text-text-tertiary hover:text-text-secondary cursor-grab active:cursor-grabbing transition-colors" {...dragProps}>
          <span className="text-xs select-none">=</span>
        </td>

        {/* チェックボックス */}
        <td className="w-6 py-1">
          <div style={{ paddingLeft: `${indent}px` }}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={e => onToggleComplete(task.id, e.target.checked)}
              onFocus={() => onFocus(task.id, 'checkbox')}
              onKeyDown={handleCheckboxKeyDown}
              className="w-4 h-4 cursor-pointer"
            />
          </div>
        </td>

        {/* タスク名 */}
        <td className="py-1 min-w-0 sm:min-w-[200px] max-w-0">
          <div style={{ paddingLeft: `${indent}px` }} className="flex items-center min-w-0">
            {task.hasChildren ? (
              <button
                onClick={() => onToggleCollapse(task.id)}
                className="w-4 h-4 flex items-center justify-center text-text-tertiary hover:text-text-secondary flex-shrink-0 mr-0.5 transition-colors"
                tabIndex={-1}
                aria-label={collapsed ? '子タスクを展開' : '子タスクを折りたたむ'}
              >
                <svg
                  className={`w-3 h-3 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            ) : (
              <span className="w-4 flex-shrink-0 mr-0.5" />
            )}
            <InlineEdit
              value={task.name}
              onSave={val => onUpdate(task.id, { name: val })}
              placeholder="タスク名を入力"
              isFocused={isFocused && focusedColumn === 'name'}
              onFocus={() => onFocus(task.id, 'name')}
              onArrowUp={() => onFocusPrev(task.id)}
              onArrowDown={() => onFocusNext(task.id)}
              className={`truncate ${task.completed ? 'line-through text-text-tertiary' : ''}`}
            />
          </div>
        </td>

        {/* 期日 */}
        <td className="py-1 w-24 sm:w-36">
          <DueDateSelect
            dueType={task.due_type}
            dueDate={task.due_date}
            onSave={(dueType, dueDate) => onUpdate(task.id, { due_type: dueType, due_date: dueDate })}
            isFocused={isFocused && focusedColumn === 'due'}
            onFocus={() => onFocus(task.id, 'due')}
            onArrowUp={() => onFocusPrev(task.id)}
            onArrowDown={() => onFocusNext(task.id)}
          />
        </td>

        {/* 見積り時間 */}
        <td className="hidden sm:table-cell py-1 w-24">
          <TimeEdit
            value={task.estimated_time_value}
            unit={task.estimated_time_unit}
            onSave={(val, unit) => onUpdate(task.id, { estimated_time_value: val, estimated_time_unit: unit })}
            isFocused={isFocused && focusedColumn === 'time'}
            onFocus={() => onFocus(task.id, 'time')}
            onArrowUp={() => onFocusPrev(task.id)}
            onArrowDown={() => onFocusNext(task.id)}
          />
        </td>

        {/* 備考（表示のみ） */}
        <td className="hidden sm:table-cell py-1 w-20">
          <span
            className="text-xs text-text-tertiary truncate block px-1 max-w-[80px] cursor-pointer hover:text-text-secondary transition-colors"
            title={task.notes}
            onClick={() => setEditDialogOpen(true)}
          >
            {task.notes ? '...' : ''}
          </span>
        </td>

        {/* 編集ボタン */}
        <td className="py-1 w-8">
          <button
            onClick={() => setEditDialogOpen(true)}
            className="text-text-tertiary hover:text-accent-solid transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5"
            title="編集"
            tabIndex={-1}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </td>

        {/* 削除ボタン */}
        <td className="py-1 w-8">
          <button
            onClick={() => onDelete(task.id)}
            className="text-text-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5"
            title="削除"
            tabIndex={-1}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </td>
      </tr>

      {editDialogOpen && (
        <TaskEditDialog
          task={task}
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          onSave={updates => onUpdate(task.id, updates)}
        />
      )}
    </>
  )
})
