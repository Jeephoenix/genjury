import React, { useEffect } from 'react'
import useGameStore, { PHASES } from './lib/store'
import LandingPage from './pages/LandingPage'
import LobbyPage from './pages/LobbyPage'
import WritingPhase from './pages/WritingPhase'
import VotingPhase from './pages/VotingPhase'
import AIJudgingPhase from './pages/AIJudgingPhase'
import ObjectionPhase from './pages/ObjectionPhase'
import RevealPhase from './pages/RevealPhase'
import ScoreboardPage from './pages/ScoreboardPage'
import ToastContainer from './components/ToastContainer'
import GameHeader from './components/GameHeader'

export default function App() {
  const phase = useGameStore(s => s.phase)
  const roomCode = useGameStore(s => s.roomCode)
  const tickTimer = useGameStore(s => s.tickTimer)

  // Global timer tick
  useEffect(() => {
    const interval = setInterval(tickTimer, 1000)
    return () => clearInterval(interval)
  }, [tickTimer])

  const inGame = roomCode && phase !== PHASES.LOBBY

  return (
    <div className="min-h-screen bg-void bg-grid relative">
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-plasma/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-neon/4 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/2 left-0 w-64 h-64 bg-ice/3 rounded-full blur-3xl pointer-events-none" />

      {inGame && <GameHeader />}

      <main className={inGame ? 'pt-16' : ''}>
        {phase === PHASES.LOBBY && !roomCode && <LandingPage />}
        {phase === PHASES.LOBBY && roomCode && <LobbyPage />}
        {phase === PHASES.WRITING && <WritingPhase />}
        {phase === PHASES.VOTING && <VotingPhase />}
        {phase === PHASES.AI_JUDGING && <AIJudgingPhase />}
        {(phase === PHASES.OBJECTION || phase === PHASES.OBJECTION_VOTE) && <ObjectionPhase />}
        {phase === PHASES.REVEAL && <RevealPhase />}
        {phase === PHASES.SCOREBOARD && <ScoreboardPage />}
      </main>

      <ToastContainer />
    </div>
  )
}
