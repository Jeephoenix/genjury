import React from 'react'
import { AlertOctagon, RefreshCw, Home } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null, hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[genjury] uncaught error:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-void flex items-center justify-center px-4 py-6">
        <div className="max-w-md w-full">
          {/* Error card */}
          <div className="glass-strong rounded-2xl border border-white/[0.1] p-6 space-y-4 text-center">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-xl bg-signal/15 border border-signal/30 flex items-center justify-center">
                <AlertOctagon className="w-6 h-6 text-signal" strokeWidth={1.75} />
              </div>
            </div>

            {/* Title */}
            <div>
              <h1 className="font-display font-bold text-xl text-white mb-2">
                Oops, something broke
              </h1>
              <p className="text-white/60 text-sm leading-relaxed">
                We encountered an unexpected error. Try refreshing the page or going home.
              </p>
            </div>

            {/* Error details (dev only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left">
                <summary className="cursor-pointer text-xs font-mono text-white/40 hover:text-white/60 transition-colors">
                  Error details
                </summary>
                <pre className="mt-2 rounded-lg bg-black/50 border border-white/10 px-3 py-2 text-[10px] text-white/50 font-mono break-all overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.08] border border-white/15 text-white/70 hover:text-white hover:bg-white/12 transition-all font-medium text-sm"
              >
                <Home className="w-4 h-4" strokeWidth={2.25} />
                Go home
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-plasma text-white hover:bg-plasma/90 transition-all shadow-[0_0_24px_rgba(162,89,255,0.3)] font-medium text-sm"
              >
                <RefreshCw className="w-4 h-4" strokeWidth={2.25} />
                Reload
              </button>
            </div>
          </div>

          {/* Help text */}
          <p className="text-center text-xs text-white/30 mt-4">
            If the problem persists, try clearing your browser cache.
          </p>
        </div>
      </div>
    )
  }
}
