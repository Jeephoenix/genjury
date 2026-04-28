import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[genjury] uncaught error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-void flex items-center justify-center px-6">
        <div className="max-w-md w-full card glass space-y-4 text-center">
          <div className="text-4xl">💥</div>
          <h1 className="font-display font-700 text-xl text-white">
            Something broke
          </h1>
          <p className="text-white/60 text-sm">
            The game hit an unexpected error. Reloading usually fixes it.
          </p>
          <pre className="text-left rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-[11px] text-white/40 font-mono break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-plasma w-full py-2.5 text-sm"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
