import React, { useState } from 'react'

/**
 * OptimizedImage — lazy-load images with placeholder and error handling
 * Prevents layout shift, improves perceived performance
 */
export default function OptimizedImage({ src, alt = '', width, height, className = '', ...props }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div
        className={`bg-white/5 border border-white/10 flex items-center justify-center ${className}`}
        style={{ aspectRatio: width && height ? `${width}/${height}` : 'auto' }}
        role="img"
        aria-label={`Failed to load: ${alt}`}
      >
        <span className="text-white/30 text-xs">Image unavailable</span>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${!loaded ? 'animate-pulse' : ''}`}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
        {...props}
      />
      {!loaded && (
        <div
          className="absolute inset-0 bg-white/5"
          style={{ aspectRatio: width && height ? `${width}/${height}` : 'auto' }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
