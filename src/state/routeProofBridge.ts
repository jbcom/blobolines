export interface RouteProofTarget {
  pairIndex: number;
}

let routeProofTarget: RouteProofTarget | null = null;

export function setRouteProofTarget(target: RouteProofTarget | null): void {
  routeProofTarget = target;
}

export function getRouteProofTarget(): RouteProofTarget | null {
  return routeProofTarget;
}
