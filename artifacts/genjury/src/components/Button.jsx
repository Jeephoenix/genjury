import React, { memo } from 'react'

/**
 * Button — standardized, accessible button component
 * Prevents inconsistent button styling across the app
 */
const Button = memo(function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
  onClick,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-white/30 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-plasma text-white hover:bg-plasma/90 shadow-[0_0_24px_rgba(162,89,255,0.3)]',
    secondary: 'bg-white/[0.08] text-white border border-white/15 hover:bg-white/12 hover:border-white/25',
    danger: 'bg-signal/15 text-signal border border-signal/30 hover:bg-signal/25 hover:border-signal/50',
    success: 'bg-neon/15 text-neon border border-neon/30 hover:bg-neon/25 hover:border-neon/50',
    ghost: 'text-white/70 hover:text-white hover:bg-white/[0.05]',
  }

  const sizes = {
    xs: 'px-3 py-1.5 text-xs',
    sm: 'px-3.5 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  )
})

export default Button
