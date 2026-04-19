import { useRef, useCallback } from 'react'

const DRAG_THRESHOLD = 5

interface OverlayAnchorProps {
  onLeftClick: () => void
  onRightClick: () => void
}

export default function OverlayAnchor({
  onLeftClick,
  onRightClick,
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

  // In Electron overlay: manual drag handling (click vs drag detection)
  // In webapp or non-overlay: use standard -webkit-app-region: drag
  if (isElectronOverlay) {
    return (
      <div className="flex justify-end p-2">
        <div
          onMouseDown={handleMouseDown}
          onContextMenu={handleContextMenu}
          className="w-8 h-8 rounded bg-amber-600/60 hover:bg-amber-500/80 border border-amber-500/40 flex items-center justify-center transition-colors cursor-grab active:cursor-grabbing"
          title="Drag to move | Click: toggle | Right-click: settings"
        >
          <span className="text-xs font-bold text-amber-100 pointer-events-none">IR</span>
        </div>
      </div>
    )
  }

  // Non-overlay (main window, webapp): use -webkit-app-region for native drag
  return (
    <div
      className="flex justify-end p-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <button
        onClick={onLeftClick}
        onContextMenu={handleContextMenu}
        className="w-8 h-8 rounded bg-amber-600/60 hover:bg-amber-500/80 border border-amber-500/40 flex items-center justify-center transition-colors"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title="Left-click: toggle overlay | Right-click: settings"
      >
        <span className="text-xs font-bold text-amber-100">IR</span>
      </button>
    </div>
  )
}
