/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'

vi.mock('@/app/actions/posts', () => ({
  tipPost: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import TipForm from '../TipForm'
import { tipPost } from '@/app/actions/posts'

const mockTipPost = tipPost as ReturnType<typeof vi.fn>

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

// Helper: get the submit button
function getSubmitBtn() {
  return screen.getAllByRole('button').find(b => b.getAttribute('type') === 'submit')!
}
function submitForm() {
  fireEvent.submit(getSubmitBtn().closest('form')!)
}
function getQuickButtons() {
  return screen.getAllByRole('button').filter(b => b.getAttribute('type') === 'button')
}

describe('TipForm', () => {
  const defaultProps = {
    postId: 'post-123',
    ownerUsername: 'alice',
    userBalance: 0.001, // ~100,000 sats
  }

  describe('rendering', () => {
    it('renders four quick amount buttons', () => {
      render(<TipForm {...defaultProps} />)
      expect(getQuickButtons()).toHaveLength(4)
    })

    it('shows balance reminder', () => {
      render(<TipForm {...defaultProps} />)
      expect(screen.getByText(/your balance/i)).toBeInTheDocument()
    })

    it('disables submit button when amount is zero', () => {
      render(<TipForm {...defaultProps} />)
      expect(getSubmitBtn()).toBeDisabled()
    })
  })

  describe('validation', () => {
    it('shows error on form submit with no amount', async () => {
      render(<TipForm {...defaultProps} />)
      await act(async () => { submitForm() })
      expect(await screen.findByText(/enter an amount/i)).toBeInTheDocument()
    })

    it('disables all quick amount buttons when balance is too low', () => {
      render(<TipForm {...defaultProps} userBalance={0.000001} />) // ~100 sats
      getQuickButtons().forEach(btn => expect(btn).toBeDisabled())
    })
  })

  describe('successful tip', () => {
    it('shows success message with owner username', async () => {
      mockTipPost.mockResolvedValue({ success: true })
      render(<TipForm {...defaultProps} />)

      fireEvent.click(getQuickButtons()[0])
      await act(async () => { submitForm() })

      await waitFor(() => {
        expect(screen.getByText(/tip sent to @alice/i)).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('calls tipPost with correct postId', async () => {
      mockTipPost.mockResolvedValue({ success: true })
      render(<TipForm {...defaultProps} />)

      fireEvent.click(getQuickButtons()[0])
      await act(async () => { submitForm() })

      await waitFor(() => expect(mockTipPost).toHaveBeenCalledTimes(1))
      const formData: FormData = mockTipPost.mock.calls[0][0]
      expect(formData.get('postId')).toBe('post-123')
    })
  })

  describe('error handling', () => {
    it('shows error message returned from tipPost', async () => {
      mockTipPost.mockResolvedValue({ error: 'Wallet disconnected' })
      render(<TipForm {...defaultProps} />)

      fireEvent.click(getQuickButtons()[0])
      await act(async () => { submitForm() })

      await waitFor(() => {
        expect(screen.getByText(/wallet disconnected/i)).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('error element has role="alert"', async () => {
      mockTipPost.mockResolvedValue({ error: 'Wallet disconnected' })
      render(<TipForm {...defaultProps} />)

      fireEvent.click(getQuickButtons()[0])
      await act(async () => { submitForm() })

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('setTimeout cleanup', () => {
    it('unmounts without throwing after success (cleared timer)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      mockTipPost.mockResolvedValue({ success: true })
      const { unmount } = render(<TipForm {...defaultProps} />)

      fireEvent.click(getQuickButtons()[0])

      // Use real timers for the transition, then switch back
      vi.useRealTimers()
      await act(async () => { submitForm() })

      await waitFor(() => expect(screen.queryByText(/tip sent/i)).toBeInTheDocument(), { timeout: 2000 })

      // Unmount before the 3s timer fires — should not throw
      expect(() => unmount()).not.toThrow()
    })
  })
})
