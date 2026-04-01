import { useState, useEffect } from 'react'
import type { OverlaySettings } from '../types'
import KeybindingInput from './KeybindingInput'

interface SettingsPanelProps {
  settings: OverlaySettings
  onUpdateSettings: (patch: Partial<OverlaySettings>) => void
  onClose?: () => void
}

interface DisplayInfo {
  id: number
  label: string
}

export default function SettingsPanel({
  settings,
  onUpdateSettings,
  onClose,
}: SettingsPanelProps) {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const isElectron = !!window.electronAPI

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getDisplays().then(setDisplays)
    }
  }, [])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-amber-400">Settings</span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300 transition-colors text-lg leading-none"
          >
            &times;
          </button>
        )}
      </div>

      {/* Keybinding */}
      <div className="space-y-1">
        <label className="text-xs text-stone-400">Toggle Overlay</label>
        <KeybindingInput
          value={settings.keybinding}
          onChange={(accelerator) => onUpdateSettings({ keybinding: accelerator })}
        />
      </div>

      {/* Monitor selection */}
      <div className="space-y-1">
        <label className="text-xs text-stone-400">Monitor</label>
        {isElectron && displays.length > 0 ? (
          <select
            value={settings.monitorId}
            onChange={(e) => onUpdateSettings({ monitorId: Number(e.target.value) })}
            className="w-full bg-stone-700 border border-stone-600 rounded px-2 py-1.5 text-sm text-stone-200 outline-none focus:border-amber-500 transition-colors"
          >
            {displays.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-stone-500">
            {isElectron ? 'Loading displays...' : 'Available in overlay mode'}
          </p>
        )}
      </div>
    </div>
  )
}
