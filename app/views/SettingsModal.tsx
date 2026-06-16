import { Dialog, Slider, Switch } from "@app/components/ui";
import { useState } from "react";
import { setMasterVolume, setMusicEnabled, setSfxVolume } from "@/audio";
import { ImpactStyle, impact } from "@/platform";
import { useGameStore } from "@/state";

/** Touch-capable device? Pointer-only desktops don't vibrate, so the haptics control is
 *  pointless there — hide it. Guarded for SSR/test (no window). */
const TOUCH_CAPABLE =
  typeof window !== "undefined" &&
  ("ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0);

/**
 * Settings — volumes, music/haptics/reduce-motion toggles, slingshot sensitivity, and a
 * (confirmed) reset-progress action. Writes to the persisted game store (Capacitor
 * Preferences) and pushes audio changes to the engine.
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
  const resetProgress = useGameStore((s) => s.resetProgress);
  // Two-step destructive confirm: first tap arms, second tap wipes (avoids a nested dialog).
  const [confirmReset, setConfirmReset] = useState(false);

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
          <SensitivityPreview sensitivity={settings.slingshotSensitivity} />
        </Row>

        {/* Haptics only on touch devices (a pointer-only desktop can't vibrate). When on,
            a Test button fires a sample buzz so the player can feel the strength. */}
        {TOUCH_CAPABLE && (
          <div className="flex items-center justify-between">
            <span className="font-semibold">Haptics</span>
            <div className="flex items-center gap-3">
              {settings.haptics && (
                <button
                  type="button"
                  onClick={() => impact(ImpactStyle.Medium)}
                  className="rounded-lg border border-border px-2.5 py-1 font-ui text-[11px] font-bold text-fg-subtle hover:text-cream"
                >
                  Test
                </button>
              )}
              <Switch
                checked={settings.haptics}
                onCheckedChange={(on) => update({ haptics: on })}
                aria-label="Haptics"
              />
            </div>
          </div>
        )}

        <Toggle
          label="Reduce motion"
          checked={settings.reducedMotion}
          onChange={(on) => update({ reducedMotion: on })}
        />

        {/* Reset progress — destructive, so a two-step confirm: first tap arms ("Tap again
            to confirm"), second tap wipes best height / crystals / unlocks / skin. */}
        <div className="flex items-center justify-between gap-3 border-border/40 border-t pt-4">
          <span className="font-semibold text-fg-subtle">Reset progress</span>
          <button
            type="button"
            onClick={() => {
              if (confirmReset) {
                resetProgress();
                setConfirmReset(false);
              } else {
                setConfirmReset(true);
              }
            }}
            className={`rounded-lg px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wide ${
              confirmReset ? "bg-danger text-bg" : "border border-danger/60 text-danger"
            }`}
          >
            {confirmReset ? "Tap to confirm" : "Reset"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setConfirmReset(false);
          onOpenChange(false);
        }}
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

/**
 * A drag-to-test strip under the sensitivity slider: drag the dot and it tracks your
 * pointer scaled by the current sensitivity — so you can feel how far a given drag throws
 * before committing to a value. Pure UI; clamps to the strip and snaps home on release.
 */
function SensitivityPreview({ sensitivity }: { sensitivity: number }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [dotX, setDotX] = useState(0); // px offset of the dot from center
  const [dragging, setDragging] = useState(false);

  const onMove = (clientX: number) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const raw = (clientX - center) * sensitivity;
    const half = rect.width / 2 - 12;
    setDotX(Math.max(-half, Math.min(half, raw)));
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a non-essential drag-feel preview; the slider above is the accessible control
    <div
      ref={setEl}
      className="relative mt-1 h-8 select-none rounded-lg border border-border bg-bg/50 touch-none"
      onPointerDown={(e) => {
        setDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onMove(e.clientX);
      }}
      onPointerMove={(e) => dragging && onMove(e.clientX)}
      onPointerUp={() => {
        setDragging(false);
        setDotX(0);
      }}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-ui text-[10px] text-fg-subtle">
        {dragging ? "" : "drag to test"}
      </span>
      <span
        className="pointer-events-none absolute top-1/2 left-1/2 size-5 rounded-full bg-accent shadow-[var(--glow-blue)]"
        style={{ transform: `translate(calc(-50% + ${dotX}px), -50%)` }}
      />
    </div>
  );
}
