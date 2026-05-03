import React from 'react'

// Renders the user's avatar — either a chosen image (data URL or remote URL)
// or a clean SVG monogram with a deterministic gradient based on the seed.
// No emojis, no external network calls.
export default function Avatar({ name = '', src = '', size = 40, color = '' }) {
  const px = `${size}px`
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="rounded-full object-cover border border-white/15"
        style={{ width: px, height: px }}
      />
    )
  }
  const initial = (name || 'P').trim().charAt(0).toUpperCase() || 'P'
  const grad = gradientFor(name || color || 'p')
  return (
    <div
      className="rounded-full flex items-center justify-center font-display font-700 text-white border border-white/15 select-none"
      style={{
        width: px,
        height: px,
        background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`,
        fontSize: Math.max(10, Math.floor(size * 0.42)) + 'px',
      }}
      aria-hidden
    >
      {initial}
    </div>
  )
}

const PALETTES = [
  { from: '#a259ff', to: '#3eddff' },
  { from: '#7fff6e', to: '#3eddff' },
  { from: '#ff8a00', to: '#ff5d8f' },
  { from: '#ffce54', to: '#ff8a00' },
  { from: '#5dffd4', to: '#a259ff' },
  { from: '#ff6b6b', to: '#a259ff' },
  { from: '#3eddff', to: '#7fff6e' },
  { from: '#a259ff', to: '#ff8a00' },
]

function gradientFor(seed) {
  let h = 0
  const s = String(seed)
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTES[h % PALETTES.length]
}
