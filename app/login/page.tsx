'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'メールを送信しました。リンクをクリックしてログインしてください。' })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="glass-panel rounded-lg shadow-xl border border-border-default p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold text-text-primary mb-6">タスク管理システム</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full bg-surface-raised border border-border-default rounded px-3 py-2 text-sm text-text-primary focus-glow placeholder:text-text-tertiary"
            />
          </div>

          {message && (
            <p className={`text-sm ${message.type === 'error' ? 'text-danger' : 'text-success'}`}>
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full btn-gradient rounded px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '送信中...' : 'ログインリンクを送信'}
          </button>
        </form>
      </div>
    </div>
  )
}
