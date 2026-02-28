'use client'

import { useState, useRef, useEffect } from 'react'
import type { TimeUnit } from '@/lib/types'
import { formatTime } from '@/lib/task-utils'

interface TimeEditProps {
  value: number | null
  unit: TimeUnit | null
  onSave: (value: number | null, unit: TimeUnit | null) => void
  isFocused?: boolean
  onFocus?: () => void
  onBlur?: () => void
  onArrowUp?: () => void
  onArrowDown?: () => void
}

const TIME_UNITS: { value: TimeUnit; label: string }[] = [
  { value: 'min', label: 'min' },
  { value: 'h', label: 'h' },
  { value: 'day', label: 'day' },
  { value: 'mo', label: 'mo' },
]

export default function TimeEdit({
  value,
  unit,
  onSave,
  isFocused = false,
  onFocus,
  onBlur,
  onArrowUp,
  onArrowDown,
}: TimeEditProps) {
  const [editing, setEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(value?.toString() ?? '')
  const [draftUnit, setDraftUnit] = useState<TimeUnit>(unit ?? 'h')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraftValue(value?.toString() ?? '')
    setDraftUnit(unit ?? 'h')
  }, [value, unit])

  const startEdit = () => {
    setDraftValue(value?.toString() ?? '')
    setDraftUnit(unit ?? 'h')
    setEditing(true)
  }

  const commitEdit = () => {
    setEditing(false)
    const numVal = draftValue === '' ? null : parseFloat(draftValue)
    if (isNaN(numVal as number)) {
      onSave(null, null)
    } else {
      onSave(numVal, numVal === null ? null : draftUnit)
    }
  }

  const cancelEdit = () => {
    setDraftValue(value?.toString() ?? '')
    setDraftUnit(unit ?? 'h')
    setEditing(false)
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault()
      startEdit()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      onArrowUp?.()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onArrowDown?.()
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  const displayText = formatTime(value, unit)

  if (editing) {
    return (
      <div ref={containerRef} className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.5"
          value={draftValue}
          onChange={e => setDraftValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={e => {
            if (!containerRef.current?.contains(e.relatedTarget as Node)) {
              commitEdit()
            }
          }}
          className="w-16 bg-surface-raised border border-border-default rounded px-1 py-0 text-sm text-text-primary focus-glow"
          placeholder="0"
        />
        <select
          value={draftUnit}
          onChange={e => setDraftUnit(e.target.value as TimeUnit)}
          onKeyDown={handleInputKeyDown}
          className="bg-surface-raised border border-border-default rounded px-1 text-xs text-text-primary focus-glow"
        >
          {TIME_UNITS.map(u => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div
      tabIndex={0}
      onClick={startEdit}
      onKeyDown={handleCellKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`cursor-text text-sm px-1 min-w-[60px] outline-none focus:bg-accent-muted rounded whitespace-nowrap ${
        isFocused ? 'bg-accent-muted' : ''
      } ${!displayText ? 'text-text-tertiary' : ''}`}
    >
      {displayText || '\u00a0'}
    </div>
  )
}
