import React from 'react'

export default function MistrialMark({ className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <g transform="translate(32 11) rotate(-32)">
        <rect
          x="-9"
          y="-3.5"
          width="18"
          height="7"
          rx="1.4"
          fill="currentColor"
        />
        <line
          x1="0"
          y1="3.5"
          x2="0"
          y2="11"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>

      <path
        d="M8 56 L8 22 L17.5 22 L32 39 L46.5 22 L56 22 L56 56 L47 56 L47 33 L34 48.5 L30 48.5 L17 33 L17 56 Z"
        fill="currentColor"
      />

      <line
        x1="20"
        y1="60"
        x2="44"
        y2="60"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  )
}
