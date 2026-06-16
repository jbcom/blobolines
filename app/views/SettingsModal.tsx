import { Dialog, Slider, Switch } from "@app/components/ui";
import { setMasterVolume, setMusicEnabled, setSfxVolume } from "@/audio";
import { useGameStore } from "@/state";

/**
 * Settings — master volume, music toggle, slingshot sensitivity, haptics. Writes to the
 * persisted game store (Capacitor Preferences) and pushes audio changes to the engine.
 */
export function SettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const settings = useGameStore((s) => s.settings);
  const update = useGameStore((s) => s.updateSettings);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} ariaLabel="Settings" testId="settings">
      <h2 className="font-display text-xl font-bold text-cream">Settings</h2>

      <div className="mt-5 flex flex-col gap-5 font-ui text-sm text-fg-muted">
        <Row label="Master volume" value={`${Math.round(settings.masterVolume * 100)}%`}>
          <Slider
            aria-label="Master volume"
            min={0}
            max={1}
            step={0.05}
            value={[settings.masterVolume]}
            onValueChange={([v]) => {
              update({ masterVolume: v });
              setMasterVolume(v);
            }}
          />
        </Row>

        <Row label="SFX volume" value={`${Math.round(settings.sfxVolume * 100)}%`}>
          <Slider
            aria-label="SFX volume"
            min={0}
            max={1}
            step={0.05}
            value={[settings.sfxVolume]}
            onValueChange={([v]) => {
              update({ sfxVolume: v });
              setSfxVolume(v);
            }}
          />
        </Row>

        <Toggle
          label="Music"
          checked={settings.musicEnabled}
          onChange={(on) => {
            update({ musicEnabled: on });
            setMusicEnabled(on);
          }}
        />

        <Row label="Slingshot sensitivity" value={`${settings.slingshotSensitivity.toFixed(1)}×`}>
          <Slider
            aria-label="Slingshot sensitivity"
            min={0.5}
            max={2}
            step={0.1}
            value={[settings.slingshotSensitivity]}
            onValueChange={([v]) => update({ slingshotSensitivity: v })}
          />
        </Row>

        <Toggle
          label="Haptics (mobile)"
          checked={settings.haptics}
          onChange={(on) => update({ haptics: on })}
        />

        <Toggle
          label="Reduce motion"
          checked={settings.reducedMotion}
          onChange={(on) => update({ reducedMotion: on })}
        />
      </div>

      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="mt-6 w-full rounded-xl bg-accent py-2.5 font-display font-bold uppercase tracking-wider text-bg"
      >
        Done
      </button>
    </Dialog>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{label}</span>
        <span className="font-display text-accent">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-semibold">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
