// Wide touch tablets retain the compact shell in landscape orientation.
export const PORTAL_COMPACT_MEDIA = '(max-width: 1279px), (hover: none) and (pointer: coarse)';

export interface NavigationScrollState {
  top: number;
  anchor: number;
  direction: number;
  visible: boolean;
}

export function navigationScrollState(top = 0): NavigationScrollState {
  return { top, anchor: top, direction: 0, visible: true };
}

export function updateNavigationScroll(state: NavigationScrollState, scrollTop: number, maximum: number, keepVisible: boolean): NavigationScrollState {
  // Safari rubber-band scrolling must not reverse the navigation direction.
  const top = Math.max(0, Math.min(scrollTop, Math.max(0, maximum)));
  if (keepVisible || top <= 24) return navigationScrollState(top);
  const delta = top - state.top;
  const direction = Math.abs(delta) >= 2 ? Math.sign(delta) : state.direction;
  const anchor = direction !== state.direction ? state.top : state.anchor;
  let visible = state.visible;
  if (direction > 0 && top > 80 && top - anchor >= 32) visible = false;
  if (direction < 0 && top - anchor <= -14) visible = true;
  return { top, anchor, direction, visible };
}
