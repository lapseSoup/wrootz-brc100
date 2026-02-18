'use client'

import { useState, useEffect, useRef } from 'react'

interface SatsInputProps {
  value: string
  onChange: (value: string) => void
  max?: number
  placeholder?: string
  className?: string
  disabled?: boolean
  label?: string
}

export default function SatsInput({
  value,
  onChange,
  max,
  placeholder = "10,000",
  className = "",
  disabled = false,
  label = "Amount in sats"
}: SatsInputProps) {
  const [displayValue, setDisplayValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Format number with commas
  const formatWithCommas = (num: string): string => {
    const cleaned = num.replace(/[^\d]/g, '')
    if (!cleaned) return ''
    return parseInt(cleaned, 10).toLocaleString()
  }

  // Parse formatted string to raw number string
  const parseToRaw = (formatted: string): string => {
    return formatted.replace(/[^\d]/g, '')
  }

  // Update display value when value prop changes
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatWithCommas(value))
    }
  }, [value, isFocused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    let raw = parseToRaw(input)

    // Clamp to max if provided (only when max is positive to avoid clamping to 0 when balance not loaded)
    if (max !== undefined && max > 0 && raw && parseInt(raw, 10) > max) {
      raw = String(max)
    }

    // Update the raw value (for form state)
    onChange(raw)

    // Update display with commas
    setDisplayValue(formatWithCommas(raw))
  }

  const handleFocus = () => {
    setIsFocused(true)
  }

  const handleBlur = () => {
    setIsFocused(false)
    // Reformat on blur to ensure proper comma formatting
    setDisplayValue(formatWithCommas(value))
  }

  // Handle keyboard shortcuts for quick amounts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, arrow keys
    if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(e.key)) {
      return
    }
    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
      return
    }
    // Block non-numeric characters (except comma which we handle)
    if (!/[\d,]/.test(e.key)) {
      e.preventDefault()
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={`input ${className}`}
      aria-label={label}
    />
  )
}
