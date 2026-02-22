'use client'

import { useState, useRef, useEffect } from 'react'
import type { DueType } from '@/lib/types'
import { DUE_TYPE_OPTIONS, dueTypeToLabel } from '@/lib/task-utils'

interface DueDateSelectProps {
  dueType: DueType
  dueDate: string | null
  onSave: (dueType: DueType, dueDate: string | null) => void
  isFocused?: boolean
  onFocus?: () => void
  onBlur?: () => void
  onArrowUp?: () => void
  onArrowDown?: () => void
}

export default function DueDateSelect({
  dueType,
  dueDate,
  onSave,
  isFocused = false,
  onFocus,
  onBlur,
  onArrowUp,
  onArrowDown,
}: DueDateSelectProps) {
  const [open, setOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<DueType>(dueType)
  const [dateInput, setDateInput] = useState(dueDate ?? '')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedType(dueType)
    setDateInput(dueDate ?? '')
  }, [dueType, dueDate])

  const handleOpen = () => {
    setSelectedType(dueType)
    setDateInput(dueDate ?? '')
    setOpen(true)
  }

  const handleSelect = (type: DueType) => {
    if (type !== 'specific_date') {
      onSave(type, null)
      setOpen(false)
    } else {
      setSelectedType(type)
    }
  }

  const handleDateConfirm = () => {
    onSave('specific_date', dateInput || null)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault()
      handleOpen()
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      onArrowUp?.()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onArrowDown?.()
    }
  }

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const label = dueTypeToLabel(dueType, dueDate)

  return (
    <div ref={containerRef} className="relative">
      <div
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={e => {
          if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            onBlur?.()
          }
        }}
        className={`cursor-pointer text-sm px-1 min-w-[80px] outline-none focus:bg-blue-50 rounded whitespace-nowrap ${
          isFocused ? 'bg-blue-50' : ''
        } ${!label ? 'text-gray-400' : ''}`}
      >
        {label || 'なし'}
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg min-w-[180px]">
          {DUE_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 ${
                selectedType === opt.value ? 'bg-blue-100 font-medium' : ''
              }`}
            >
              {opt.label}
            </button>
          ))}
          {selectedType === 'specific_date' && (
            <div className="px-3 py-2 border-t border-gray-100 flex gap-2 items-center">
              <input
                type="date"
                value={dateInput}
                onChange={e => setDateInput(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleDateConfirm()}
              />
              <button
                onClick={handleDateConfirm}
                className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
