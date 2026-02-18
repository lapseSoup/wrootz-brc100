'use client'

import { useState } from 'react'
import { register } from '@/app/actions/auth'
import Link from 'next/link'
import ErrorMessage from '@/app/components/ErrorMessage'

export default function RegisterPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError('')
    const result = await register(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h1 className="text-2xl font-bold mb-6 text-center">Join Wrootz</h1>

        <form action={handleSubmit} className="space-y-4">
          <ErrorMessage message={error} />

          <div>
            <label htmlFor="username" className="label">Username</label>
            <input
              id="username"
              type="text"
              name="username"
              className="input"
              placeholder="Choose a username"
              minLength={3}
              maxLength={20}
              required
            />
            <p className="text-xs text-[var(--muted)] mt-1">3-20 characters</p>
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              className="input"
              placeholder="Choose a password"
              minLength={12}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-[var(--muted)] mt-1">At least 12 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="label">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              className="input"
              placeholder="Confirm your password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-[var(--danger)] mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--primary)] hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
