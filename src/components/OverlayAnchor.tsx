import { useRef, useCallback } from 'react'

const DRAG_THRESHOLD = 5

interface OverlayAnchorProps {
  onLeftClick: () => void
  onRightClick: () => void
  /** When true, the anchor is the sole content of the overlay window and should fill it. */
  fillWindow?: boolean
}

export default function OverlayAnchor({
  onLeftClick,
  onRightClick,
  fillWindow = false,
}: OverlayAnchorProps) {
  const dragRef = useRef<{ startX: number; startY: number; dragging: boolean } | null>(null)
  const isElectronOverlay = !!window.electronAPI?.isOverlay

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onRightClick()
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragRef.current = { startX: e.screenX, startY: e.screenY, dragging: false }

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.screenX - dragRef.current.startX
      const dy = ev.screenY - dragRef.current.startY
      if (!dragRef.current.dragging && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        dragRef.current.dragging = true
        window.electronAPI?.startDrag()
      }
    }

    const handleMouseUp = () => {
      const wasDragging = dragRef.current?.dragging ?? false
      dragRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (wasDragging) {
        window.electronAPI?.stopDrag()
      } else {
        onLeftClick()
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [onLeftClick])

  // Electron overlay in anchor mode: the button IS the window — no padding, no transparent frame
  if (isElectronOverlay && fillWindow) {
    return (
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 transition-colors cursor-grab active:cursor-grabbing shadow-[inset_0_0_0_1px_rgba(246,233,201,0.25),0_4px_12px_rgba(0,0,0,0.5)]"
        title="Drag to move — Click to open — Right-click for settings"
        style={{
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.08em',
        }}
      >
        <span className="text-sm font-semibold text-gold-50 pointer-events-none drop-shadow-sm">
          IR
        </span>
      </div>
    )
  }

  // Electron overlay, inside expanded title bar: compact button
  if (isElectronOverlay) {
    return (
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        className="w-7 h-7 rounded flex items-center justify-center bg-gradient-to-br from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 transition-colors cursor-grab active:cursor-grabbing shadow-[inset_0_0_0_1px_rgba(246,233,201,0.25)]"
        title="Drag to move — Click to collapse — Right-click for settings"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}
      >
        <span className="text-[11px] font-semibold text-gold-50 pointer-events-none">
          IR
        </span>
      </div>
    )
  }

  // Non-overlay (webapp): native drag
  return (
    <div
      className="flex justify-end p-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <button
        onClick={onLeftClick}
        onContextMenu={handleContextMenu}
        className="w-8 h-8 rounded flex items-center justify-center bg-gradient-to-br from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 transition-colors shadow-[inset_0_0_0_1px_rgba(246,233,201,0.25)]"
        style={{
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.08em',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
        title="Left-click: toggle overlay — Right-click: settings"
      >
        <span className="text-xs font-semibold text-gold-50">IR</span>
      </button>
    </div>
  )
}
