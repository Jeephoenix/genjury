import React, { useMemo } from 'react'

export default function TimerRing({ seconds, max, size = 48 }) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const progress = max > 0 ? seconds / max : 0
  const offset = circumference * (1 - progress)

  const color = useMemo(() => {
    if (progress > 0.5) return '#7fff6e'
    if (progress > 0.25) return '#f5c842'
    return '#ff6b35'
  }, [progress])

  const isUrgent = progress <= 0.25 && seconds > 0

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease', filter: `drop-shadow(0 0 4px ${color}88)` }}
        />
      </svg>
      <span
        className={`absolute font-mono text-xs font-500 ${isUrgent ? 'animate-pulse' : ''}`}
        style={{ color }}
      >
        {seconds}
      </span>
    </div>
  )
}
