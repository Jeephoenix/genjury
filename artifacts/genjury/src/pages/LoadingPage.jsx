import React from 'react'

export default function LoadingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
            <div 
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-plasma border-r-plasma animate-spin"
              style={{ animationDuration: '0.8s' }}
            />
          </div>
        </div>
        <p className="text-white/40 text-sm">Loading game...</p>
      </div>
    </div>
  )
}
