'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { formatWrootz } from '@/app/lib/constants'

interface TagSuggestion {
  tag: string
  wrootz: number
}

interface TagInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  className?: string
}

export default function TagInput({
  value,
  onChange,
  placeholder = 'e.g., quality, funny, informative',
  maxLength = 50,
  className = ''
}: TagInputProps) {
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [loading, setLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // Track mounted state to avoid setting state after unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [])

  // Fetch suggestions
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 1) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/tags/search?q=${encodeURIComponent(searchQuery)}`)
      if (!mountedRef.current) return
      if (res.ok) {
        const data = await res.json()
        if (mountedRef.current) setSuggestions(data)
      }
    } catch {
      console.error('Failed to fetch tag suggestions')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value)
    }, 150)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [value, fetchSuggestions])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault() // Always prevent form submission
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        onChange(suggestions[selectedIndex].tag)
        setShowSuggestions(false)
        setSelectedIndex(-1)
      } else if (value.trim()) {
        onChange(value.trim())
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
      return
    }

    if (!showSuggestions || suggestions.length === 0) {
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
      case 'Tab':
        if (selectedIndex >= 0) {
          e.preventDefault()
          const selected = suggestions[selectedIndex]
          onChange(selected.tag)
          setShowSuggestions(false)
          setSelectedIndex(-1)
        }
        break
    }
  }

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle suggestion click
  const handleSuggestionClick = (tag: string) => {
    onChange(tag)
    setShowSuggestions(false)
    setSelectedIndex(-1)
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setShowSuggestions(true)
            setSelectedIndex(-1)
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`input ${className}`}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-[var(--muted)] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-1)] border border-[var(--border)] rounded-lg shadow-xl z-[100] overflow-hidden max-h-48 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.tag}
              type="button"
              onClick={() => handleSuggestionClick(suggestion.tag)}
              className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                index === selectedIndex
                  ? 'bg-[var(--primary)] text-white'
                  : 'hover:bg-[var(--surface-2)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={index === selectedIndex ? 'text-white/70' : 'text-[var(--primary)]'}>#</span>
                <span className="font-medium">{suggestion.tag}</span>
              </span>
              <span className={`text-sm ${index === selectedIndex ? 'text-white/70' : 'text-[var(--accent)]'}`}>
                {formatWrootz(suggestion.wrootz)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
