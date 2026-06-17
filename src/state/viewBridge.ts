export interface ViewControls {
  yaw: number;
  pitch: number;
  zoom: number;
}

interface BlobScreenTarget {
  x: number;
  y: number;
  radius: number;
}

const DEFAULT_VIEW: ViewControls = {
  yaw: 0,
  pitch: 0,
  zoom: 1,
};

const MIN_PITCH = -0.55;
const MAX_PITCH = 0.62;
const MIN_ZOOM = 0.68;
const MAX_ZOOM = 1.65;

let viewControls: ViewControls = { ...DEFAULT_VIEW };
let blobTarget: BlobScreenTarget = { x: Number.NaN, y: Number.NaN, radius: 76 };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function getViewControls(): ViewControls {
  return viewControls;
}

export function rotateView(deltaX: number, deltaY: number): void {
  viewControls = {
    yaw: viewControls.yaw - deltaX * 0.0065,
    pitch: clamp(viewControls.pitch - deltaY * 0.0048, MIN_PITCH, MAX_PITCH),
    zoom: viewControls.zoom,
  };
}

export function zoomView(delta: number): void {
  viewControls = {
    ...viewControls,
    zoom: clamp(viewControls.zoom * Math.exp(delta * 0.0022), MIN_ZOOM, MAX_ZOOM),
  };
}

export function setViewZoom(zoom: number): void {
  viewControls = { ...viewControls, zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) };
}

export function resetViewControls(): void {
  viewControls = { ...DEFAULT_VIEW };
}

export function setBlobScreenTarget(target: BlobScreenTarget): void {
  blobTarget = target;
}

export function isBlobScreenTarget(x: number, y: number): boolean {
  if (!Number.isFinite(blobTarget.x) || !Number.isFinite(blobTarget.y)) return true;
  return Math.hypot(x - blobTarget.x, y - blobTarget.y) <= blobTarget.radius;
}
