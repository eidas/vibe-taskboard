'use client'

import type { FilterType } from '@/lib/types'

interface FilterButtonsProps {
  current: FilterType
  onChange: (filter: FilterType) => void
}

export default function FilterButtons({ current, onChange }: FilterButtonsProps) {
  const buttons: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'すべて' },
    { value: 'completed', label: '完了' },
    { value: 'incomplete', label: '未完了' },
  ]

  return (
    <div className="flex gap-2">
      {buttons.map(btn => (
        <button
          key={btn.value}
          onClick={() => onChange(btn.value)}
          className={`px-6 py-1.5 border rounded text-sm font-medium transition-colors ${
            current === btn.value
              ? 'bg-gray-200 border-gray-400 text-gray-900'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}
