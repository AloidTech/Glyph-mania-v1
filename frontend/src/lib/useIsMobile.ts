import { useState, useEffect } from 'react';

/**
 * Shared mobile breakpoint queries kept strictly in sync with responsive.css:
 * - Mobile portrait: max-width 768px
 * - Mobile landscape: orientation landscape with constrained vertical height (max-height 540px)
 */
export const MOBILE_MEDIA_QUERY = '(max-width: 768px), (orientation: landscape and (max-height: 540px))';

/**
 * Synchronously checks if current viewport matches mobile boundaries.
 */
export function getIsMobile(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

/**
 * Reusable React hook for reactive mobile detection synchronized with CSS breakpoints.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(getIsMobile);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mql.matches);

    // Modern API with legacy fallback
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else {
      // @ts-ignore - legacy Safari support
      mql.addListener(handler);
      // @ts-ignore
      return () => mql.removeListener(handler);
    }
  }, []);

  return isMobile;
}
