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
          className={`px-6 py-1.5 border rounded text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
            current === btn.value
              ? 'bg-accent-muted border-accent-solid text-text-primary'
              : 'bg-surface border-border-default text-text-secondary hover:bg-surface-raised'
          }`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}
