import React, { useEffect, useRef, useState } from 'react'

/**
 * XpFlyout
 * Renders an animated "+N XP" number that floats upward and fades out.
 *
 * Props:
 *   value   {number}  — XP amount to show. Re-fires the animation whenever
 *                       this value changes to a number > 0.
 *   color   {string}  — CSS colour for the number (default: gold).
 *   origin  {string}  — Tailwind position classes for where the flyout starts
 *                       relative to its nearest `position: relative` ancestor.
 *                       Default: 'bottom-2 right-2'
 */
export default function XpFlyout({
  value,
  color   = '#f5c842',
  origin  = 'bottom-2 right-2',
}) {
  const [items, setItems] = useState([])
  const counterRef = useRef(0)

  useEffect(() => {
    if (!value || value <= 0) return

    const id = ++counterRef.current
    setItems((prev) => [...prev, { id, value }])

    // Remove this particular flyout after the animation finishes (1.6 s)
    const timer = setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id))
    }, 1650)

    return () => clearTimeout(timer)
  }, [value])

  if (items.length === 0) return null

  return (
    <>
      {items.map((item) => (
        <span
          key={item.id}
          className={`xp-flyout absolute ${origin} pointer-events-none select-none z-50`}
          style={{ color }}
        >
          +{item.value}&thinsp;XP
        </span>
      ))}
    </>
  )
}
