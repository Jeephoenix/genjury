import { useEffect, useRef } from 'react'

const COLORS = ['#3db87a', '#a259ff', '#38d9f5', '#f5c842', '#c05b30', '#ffffff']

export default function Confetti({ duration = 4000 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const count = window.innerWidth < 600 ? 120 : 220
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: -30 - Math.random() * canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: Math.random() * 10 + 5,
      h: Math.random() * 5 + 3,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      gravity: 0.12 + Math.random() * 0.08,
      opacity: 1,
    }))

    const startTime = performance.now()
    let frame

    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let allGone = true
      particles.forEach(p => {
        p.vy += p.gravity
        p.x += p.vx
        p.y += p.vy
        p.rot += p.rotSpeed
        if (progress > 0.6) {
          p.opacity = Math.max(0, 1 - (progress - 0.6) / 0.4)
        }

        if (p.y < canvas.height + 40) allGone = false

        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rot * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      })

      if (!allGone && progress < 1) {
        frame = requestAnimationFrame(animate)
      }
    }

    frame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [duration])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9998 }}
    />
  )
}
