interface OverlayAnchorProps {
  onLeftClick: () => void
  onRightClick: () => void
}

export default function OverlayAnchor({
  onLeftClick,
  onRightClick,
}: OverlayAnchorProps) {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onRightClick()
  }

  return (
    <div className="flex justify-end p-2">
      <button
        onClick={onLeftClick}
        onContextMenu={handleContextMenu}
        className="w-8 h-8 rounded bg-amber-600/60 hover:bg-amber-500/80 border border-amber-500/40 flex items-center justify-center transition-colors"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title="Left-click: toggle overlay | Right-click: settings"
      >
        <span className="text-xs font-bold text-amber-100">BG</span>
      </button>
    </div>
  )
}
