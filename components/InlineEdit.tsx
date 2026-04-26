'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface InlineEditProps {
  value: string
  onSave: (value: string) => void
  className?: string
  placeholder?: string
  isFocused?: boolean
  onFocus?: () => void
  onBlur?: () => void
  onBlurEmpty?: () => void
  onCancelEmpty?: () => void
  onArrowUp?: () => void
  onArrowDown?: () => void
}

export default function InlineEdit({
  value,
  onSave,
  className = '',
  placeholder = '',
  isFocused = false,
  onFocus,
  onBlur,
  onBlurEmpty,
  onCancelEmpty,
  onArrowUp,
  onArrowDown,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const cellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const startEdit = useCallback(() => {
    setDraft(value)
    setEditing(true)
  }, [value])

  const commitEdit = useCallback(() => {
    setEditing(false)
    if (draft !== value) {
      onSave(draft)
    }
    if (!draft.trim()) {
      onBlurEmpty?.()
    }
  }, [draft, value, onSave, onBlurEmpty])

  const cancelEdit = useCallback(() => {
    setDraft(value)
    setEditing(false)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // 値が空でフォーカスされたら自動的に編集モードに入る
  useEffect(() => {
    if (isFocused && !value && !editing) {
      startEdit()
    }
  }, [isFocused, value, editing, startEdit])

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (!value.trim()) {
        if (draft.trim()) {
          // 1回目のEscape: 入力をクリアして編集継続
          setDraft('')
        } else {
          // 2回目のEscape: 新規タスク作成をキャンセル
          onCancelEmpty?.()
        }
      } else {
        cancelEdit()
      }
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleInputKeyDown}
        onBlur={commitEdit}
        className={`w-full border-0 outline-none bg-accent-muted text-text-primary px-1 text-sm ${className}`}
      />
    )
  }

  return (
    <div
      ref={cellRef}
      tabIndex={0}
      onClick={startEdit}
      onDoubleClick={startEdit}
      onKeyDown={handleCellKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`cursor-text min-h-6 w-full text-sm px-1 outline-none focus:bg-accent-muted rounded ${
        !value ? 'text-text-tertiary' : ''
      } ${isFocused ? 'bg-accent-muted' : ''} ${className}`}
    >
      {value || placeholder}
    </div>
  )
}
