import { useMemo, useCallback } from 'react'

/**
 * Prevent common re-render issues by memoizing expensive computations
 * Use these hooks instead of custom memoization in components
 */

/**
 * useMemoizedSelector - stable reference to a store selector
 * Prevents unnecessary re-renders when store value doesn't change
 */
export function useMemoizedValue(value, deps = []) {
  return useMemo(() => value, deps)
}

/**
 * useMemoizedCallback - stable callback reference
 * Combines useCallback with better dependency tracking
 */
export function useMemoizedCallback(fn, deps = []) {
  return useCallback(fn, deps)
}

/**
 * useThrottledValue - debounce rapid updates
 * Useful for search inputs, resize handlers, etc.
 */
export function useThrottledValue(value, delay = 300) {
  const [throttled, setThrottled] = React.useState(value)

  React.useEffect(() => {
    const timer = setTimeout(() => setThrottled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return throttled
}
