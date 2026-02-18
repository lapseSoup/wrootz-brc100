/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SatsInput from '../SatsInput'

afterEach(() => cleanup())

describe('SatsInput', () => {
  const noop = () => {}

  describe('display formatting', () => {
    it('renders formatted value with commas', () => {
      render(<SatsInput value="10000" onChange={noop} />)
      expect(screen.getByRole('textbox')).toHaveValue('10,000')
    })

    it('shows empty when value is empty', () => {
      render(<SatsInput value="" onChange={noop} />)
      expect(screen.getByRole('textbox')).toHaveValue('')
    })

    it('uses custom placeholder', () => {
      render(<SatsInput value="" onChange={noop} placeholder="Enter amount" />)
      expect(screen.getByPlaceholderText('Enter amount')).toBeInTheDocument()
    })
  })

  describe('input handling', () => {
    it('calls onChange with raw numeric string (no commas)', async () => {
      const onChange = vi.fn()
      render(<SatsInput value="" onChange={onChange} />)
      const input = screen.getByRole('textbox')
      // Use fireEvent for direct change simulation
      fireEvent.change(input, { target: { value: '5000' } })
      expect(onChange).toHaveBeenCalledWith('5000')
    })

    it('strips non-numeric characters on input', () => {
      const onChange = vi.fn()
      render(<SatsInput value="" onChange={onChange} />)
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'abc123def' } })
      expect(onChange).toHaveBeenCalledWith('123')
    })

    it('clamps to max when max is provided and exceeded', () => {
      const onChange = vi.fn()
      render(<SatsInput value="" onChange={onChange} max={500} />)
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '1000' } })
      expect(onChange).toHaveBeenCalledWith('500')
    })

    it('does not clamp when max is 0 (balance not loaded)', () => {
      const onChange = vi.fn()
      render(<SatsInput value="" onChange={onChange} max={0} />)
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '1000' } })
      expect(onChange).toHaveBeenCalledWith('1000')
    })

    it('blocks non-numeric key presses', () => {
      render(<SatsInput value="" onChange={noop} />)
      const input = screen.getByRole('textbox')
      const event = new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true })
      const prevented = vi.spyOn(event, 'preventDefault')
      input.dispatchEvent(event)
      expect(prevented).toHaveBeenCalled()
    })

    it('allows arrow key presses', () => {
      render(<SatsInput value="" onChange={noop} />)
      const input = screen.getByRole('textbox')
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })
      const prevented = vi.spyOn(event, 'preventDefault')
      input.dispatchEvent(event)
      expect(prevented).not.toHaveBeenCalled()
    })

    it('allows digit key presses', () => {
      render(<SatsInput value="" onChange={noop} />)
      const input = screen.getByRole('textbox')
      const event = new KeyboardEvent('keydown', { key: '5', bubbles: true, cancelable: true })
      const prevented = vi.spyOn(event, 'preventDefault')
      input.dispatchEvent(event)
      expect(prevented).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('has aria-label "Amount in sats"', () => {
      render(<SatsInput value="" onChange={noop} />)
      expect(screen.getByRole('textbox', { name: /amount in sats/i })).toBeInTheDocument()
    })

    it('is disabled when disabled prop is true', () => {
      render(<SatsInput value="" onChange={noop} disabled={true} />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('uses numeric inputMode for mobile keyboards', () => {
      render(<SatsInput value="" onChange={noop} />)
      expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'numeric')
    })
  })

  describe('blur formatting', () => {
    it('reformats display value on blur', () => {
      render(<SatsInput value="5000" onChange={noop} />)
      const input = screen.getByRole('textbox')
      fireEvent.focus(input)
      fireEvent.blur(input)
      expect(input).toHaveValue('5,000')
    })
  })
})
