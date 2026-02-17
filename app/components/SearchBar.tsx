'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatWrootz } from '@/app/lib/constants'

interface TagSuggestion {
  tag: string
  wrootz: number
}

// Extract the current tag being typed (last word after space, +, or #)
function getCurrentTagInput(query: string): { prefix: string; currentTag: string } {
  // Find the last separator (space, +, or start of string)
  const match = query.match(/^(.*[\s+])?(#?)([a-zA-Z0-9_-]*)$/)
  if (match) {
    const prefix = match[1] || ''
    const hashPrefix = match[2] || ''
    const currentTag = match[3] || ''
    return { prefix: prefix + hashPrefix, currentTag }
  }
  return { prefix: '', currentTag: query }
}

export default function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentSearch = searchParams.get('search') || ''
  const currentFilter = searchParams.get('filter') || 'all'

  const [query, setQuery] = useState(currentSearch)

  // Sync query state when URL search parameter changes (e.g., browser back/forward)
  useEffect(() => {
    setQuery(currentSearch)
  }, [currentSearch])
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

  // Fetch suggestions for the current tag being typed
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    const { currentTag } = getCurrentTagInput(searchQuery)

    if (currentTag.length < 1) {
      setSuggestions([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/tags/search?q=${encodeURIComponent(currentTag)}`)
      if (!mountedRef.current) return
      if (res.ok) {
        const data = await res.json()
        if (mountedRef.current) setSuggestions(data)
      }
    } catch {
      console.error('Failed to fetch suggestions')
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
      fetchSuggestions(query)
    }, 150)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [query, fetchSuggestions])

  // Handle search submission
  const handleSearch = (searchTerm: string) => {
    setShowSuggestions(false)
    setSelectedIndex(-1)

    const params = new URLSearchParams()
    if (searchTerm) {
      params.set('search', searchTerm)
    }
    if (currentFilter !== 'all') {
      params.set('filter', currentFilter)
    }

    const queryString = params.toString()
    router.push(queryString ? `/?${queryString}` : '/')
  }

  // Apply a selected tag suggestion (append to existing query)
  const applyTagSuggestion = (tag: string, shouldSearch: boolean = true) => {
    const { prefix } = getCurrentTagInput(query)
    const newQuery = prefix + tag
    setQuery(newQuery)
    setShowSuggestions(false)
    setSelectedIndex(-1)
    if (shouldSearch) {
      handleSearch(newQuery)
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSearch(query)
      }
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
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          const selected = suggestions[selectedIndex]
          applyTagSuggestion(selected.tag)
        } else {
          handleSearch(query)
        }
        break
      case 'Tab':
        // Tab to autocomplete without searching (allows adding more tags)
        if (selectedIndex >= 0 || suggestions.length > 0) {
          e.preventDefault()
          const selected = suggestions[selectedIndex >= 0 ? selectedIndex : 0]
          const { prefix } = getCurrentTagInput(query)
          const newQuery = prefix + selected.tag + ' '
          setQuery(newQuery)
          setSuggestions([])
          setSelectedIndex(-1)
          // Keep focus on input to allow typing more tags
          inputRef.current?.focus()
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
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
    applyTagSuggestion(tag)
  }

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setShowSuggestions(true)
          setSelectedIndex(-1)
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search... (use spaces for multiple tags)"
        className="input pr-10 w-full"
      />
      <button
        type="button"
        onClick={() => handleSearch(query)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-[var(--background)]"
      >
        {loading ? (
          <svg className="w-5 h-5 text-[var(--muted)] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </button>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.tag}
              type="button"
              onClick={() => handleSuggestionClick(suggestion.tag)}
              className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                index === selectedIndex
                  ? 'bg-[var(--primary)] text-white'
                  : 'hover:bg-[var(--background)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={index === selectedIndex ? 'text-white/70' : 'text-[var(--primary)]'}>#</span>
                <span className="font-medium">{suggestion.tag}</span>
              </span>
              <span className={`text-sm ${index === selectedIndex ? 'text-white/70' : 'text-[var(--accent)]'}`}>
                {formatWrootz(suggestion.wrootz)} wrootz
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
