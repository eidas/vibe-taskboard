'use client'

import { useState, useEffect, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { Task, DueType, TimeUnit } from '@/lib/types'
import { DUE_TYPE_OPTIONS, dueTypeToLabel } from '@/lib/task-utils'

interface TaskEditDialogProps {
  task: Task
  open: boolean
  onClose: () => void
  onSave: (updates: Partial<Task>) => void
  onDelete?: () => void
}

const TIME_UNITS: { value: TimeUnit; label: string }[] = [
  { value: 'min', label: 'min' },
  { value: 'h', label: 'h' },
  { value: 'day', label: 'day' },
  { value: 'mo', label: 'mo' },
]

export default function TaskEditDialog({ task, open, onClose, onSave, onDelete }: TaskEditDialogProps) {
  const [name, setName] = useState(task.name)
  const [dueType, setDueType] = useState<DueType>(task.due_type)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [estValue, setEstValue] = useState(task.estimated_time_value?.toString() ?? '')
  const [estUnit, setEstUnit] = useState<TimeUnit>(task.estimated_time_unit ?? 'h')
  const [actValue, setActValue] = useState(task.actual_time_value?.toString() ?? '')
  const [actUnit, setActUnit] = useState<TimeUnit>(task.actual_time_unit ?? 'h')
  const [notes, setNotes] = useState(task.notes)

  useEffect(() => {
    if (open) {
      setName(task.name)
      setDueType(task.due_type)
      setDueDate(task.due_date ?? '')
      setEstValue(task.estimated_time_value?.toString() ?? '')
      setEstUnit(task.estimated_time_unit ?? 'h')
      setActValue(task.actual_time_value?.toString() ?? '')
      setActUnit(task.actual_time_unit ?? 'h')
      setNotes(task.notes)
    }
  }, [open, task])

  const handleSave = useCallback(() => {
    const parseTime = (val: string, unit: TimeUnit): { value: number | null; unit: TimeUnit | null } => {
      const num = parseFloat(val)
      if (isNaN(num) || val === '') return { value: null, unit: null }
      return { value: num, unit }
    }

    const est = parseTime(estValue, estUnit)
    const act = parseTime(actValue, actUnit)

    onSave({
      name,
      due_type: dueType,
      due_date: dueType === 'specific_date' ? (dueDate || null) : null,
      estimated_time_value: est.value,
      estimated_time_unit: est.unit,
      actual_time_value: act.value,
      actual_time_unit: act.unit,
      notes,
    })
    onClose()
  }, [name, dueType, dueDate, estValue, estUnit, actValue, actUnit, notes, onSave, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault()
      handleSave()
    }
  }, [handleSave])

  return (
    <Dialog.Root open={open} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-overlay-bg z-50 animate-fade-in" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 glass-panel rounded-xl shadow-2xl w-full max-w-md p-6 animate-scale-in border border-border-glass"
          onKeyDown={handleKeyDown}
        >
          <Dialog.Title className="text-lg font-semibold text-text-primary mb-4">
            タスクの編集
          </Dialog.Title>

          <div className="space-y-4">
            {/* タスク名 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">タスク名</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-surface-raised border border-border-default rounded px-3 py-2 text-sm text-text-primary focus-glow"
                autoFocus
              />
            </div>

            {/* 期日 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">期日</label>
              <select
                value={dueType}
                onChange={e => setDueType(e.target.value as DueType)}
                className="w-full bg-surface-raised border border-border-default rounded px-3 py-2 text-sm text-text-primary focus-glow"
              >
                {DUE_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {dueType === 'specific_date' && (
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="mt-2 w-full bg-surface-raised border border-border-default rounded px-3 py-2 text-sm text-text-primary focus-glow"
                />
              )}
            </div>

            {/* 見積り時間 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">見積り時間</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={estValue}
                  onChange={e => setEstValue(e.target.value)}
                  placeholder="例: 1.5"
                  className="flex-1 bg-surface-raised border border-border-default rounded px-3 py-2 text-sm text-text-primary focus-glow"
                />
                <select
                  value={estUnit}
                  onChange={e => setEstUnit(e.target.value as TimeUnit)}
                  className="bg-surface-raised border border-border-default rounded px-3 py-2 text-sm text-text-primary focus-glow"
                >
                  {TIME_UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 実績時間 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">実績時間</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={actValue}
                  onChange={e => setActValue(e.target.value)}
                  placeholder="例: 2"
                  className="flex-1 bg-surface-raised border border-border-default rounded px-3 py-2 text-sm text-text-primary focus-glow"
                />
                <select
                  value={actUnit}
                  onChange={e => setActUnit(e.target.value as TimeUnit)}
                  className="bg-surface-raised border border-border-default rounded px-3 py-2 text-sm text-text-primary focus-glow"
                >
                  {TIME_UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 備考 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">備考</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                className="w-full bg-surface-raised border border-border-default rounded px-3 py-2 text-sm text-text-primary focus-glow resize-y"
              />
            </div>
          </div>

          <div className="flex justify-between mt-6">
            {onDelete ? (
              <button
                onClick={onDelete}
                className="px-4 py-2 text-sm border border-danger-muted rounded text-danger hover:bg-danger-muted transition-all active:scale-[0.97]"
              >
                削除
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border border-border-default rounded text-text-secondary hover:bg-surface-raised transition-all active:scale-[0.97]"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm btn-gradient rounded"
              >
                保存
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
