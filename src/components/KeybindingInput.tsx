import { useState, useCallback, useEffect, useRef } from 'react'

interface KeybindingInputProps {
  value: string
  onChange: (accelerator: string) => void
}

function keyEventToAccelerator(e: KeyboardEvent): string | null {
  // Ignore bare modifier keys
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  // Normalize key name to Electron accelerator format
  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  // F1-F24 are already correct from e.key

  parts.push(key)
  return parts.join('+')
}

export default function KeybindingInput({ value, onChange }: KeybindingInputProps) {
  const [listening, setListening] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const startListening = useCallback(() => {
    setListening(true)
  }, [])

  useEffect(() => {
    if (!listening) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setListening(false)
        return
      }

      const accelerator = keyEventToAccelerator(e)
      if (accelerator) {
        onChange(accelerator)
        setListening(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [listening, onChange])

  // Close listening if user clicks away
  useEffect(() => {
    if (!listening) return

    const handleClick = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setListening(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [listening])

  return (
    <button
      ref={buttonRef}
      onClick={startListening}
      className={`px-3 py-1.5 text-sm rounded border transition-colors font-mono ${
        listening
          ? 'bg-amber-600/20 border-amber-500 text-amber-300 animate-pulse'
          : 'bg-stone-700 border-stone-600 text-stone-200 hover:border-stone-500'
      }`}
    >
      {listening ? 'Press a key...' : value}
    </button>
  )
}
