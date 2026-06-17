export interface RouteProofTarget {
  pairIndex: number;
}

let routeProofTarget: RouteProofTarget | null = null;
let routeProofSequenceActive = false;

export function setRouteProofTarget(target: RouteProofTarget | null): void {
  routeProofTarget = target;
}

export function getRouteProofTarget(): RouteProofTarget | null {
  return routeProofTarget;
}

export function setRouteProofSequenceActive(active: boolean): void {
  routeProofSequenceActive = active;
}

export function isRouteProofSequenceActive(): boolean {
  return routeProofSequenceActive;
}
