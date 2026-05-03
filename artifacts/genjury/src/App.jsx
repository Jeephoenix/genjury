import React, { useEffect, Suspense, lazy } from 'react'
import useGameStore, { PHASES } from './lib/store'
import { isValidRoomCode, normalizeRoomCode, autoReconnect, myAddress, subscribeWallet } from './lib/genlayer'
import { initProfileForAddress, clearProfileCache, applyServerProfile, applyEnsName } from './lib/profile'
import { fetchServerProfile } from './lib/profileApi'
import { lookupEnsName } from './lib/ens'
import ToastContainer from './components/ToastContainer'
import GameHeader from './components/GameHeader'
import TopNav from './components/TopNav'
import WalletPanel from './components/WalletPanel'
import TxStatusBanner from './components/TxStatusBanner'
import ChatPanel from './components/ChatPanel'
import NetworkBanner from './components/NetworkBanner'
import Footer from './components/Footer'
import ErrorBoundary from './components/ErrorBoundary'
import OnboardingModal from './components/OnboardingModal'
import IdentityGateModal from './components/IdentityGateModal'
import PlayerProfileCard from './components/PlayerProfileCard'

// Lazy load pages for better code splitting
const HomePage       = lazy(() => import('./pages/HomePage'))
const MistrialPage   = lazy(() => import('./pages/MistrialPage'))
const LobbyPage      = lazy(() => import('./pages/LobbyPage'))
const WritingPhase   = lazy(() => import('./pages/WritingPhase'))
const VotingPhase    = lazy(() => import('./pages/VotingPhase'))
const AIJudgingPhase = lazy(() => import('./pages/AIJudgingPhase'))
const ObjectionPhase = lazy(() => import('./pages/ObjectionPhase'))
const RevealPhase    = lazy(() => import('./pages/RevealPhase'))
const ScoreboardPage = lazy(() => import('./pages/ScoreboardPage'))
const GamesPage      = lazy(() => import('./pages/GamesPage'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))
const ProfilePage    = lazy(() => import('./pages/ProfilePage'))
const LoadingPage    = lazy(() => import('./pages/LoadingPage'))

function PageLoader() {
  return <LoadingPage />
}

export default function App() {
  const phase        = useGameStore(s => s.phase)
  const roomCode     = useGameStore(s => s.roomCode)
  const activeTab    = useGameStore(s => s.activeTab)
  const tickTimer    = useGameStore(s => s.tickTimer)
  const setActiveTab = useGameStore(s => s.setActiveTab)

  useEffect(() => {
    const interval = setInterval(tickTimer, 1000)
    return () => clearInterval(interval)
  }, [tickTimer])

  // Silently reconnect on page load if the user previously approved this site.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { autoReconnect() }, [])

  // Whenever the wallet connects, switches, or disconnects:
  // - Load the wallet-specific localStorage profile (isolated per address)
  // - Fetch the server-registered identity
  // - Run ENS reverse lookup in parallel
  // When disconnected, clear the in-memory cache so no stale name bleeds through.
  useEffect(() => {
    async function syncProfile(addr) {
      if (!addr) {
        // Wallet disconnected — wipe in-memory profile so nothing leaks
        clearProfileCache()
        return
      }

      // Load (or create) the per-address profile slot before any async work
      // so that the UI immediately reflects the correct wallet's cached state
      initProfileForAddress(addr)

      try {
        const [serverProfile, ensName] = await Promise.all([
          fetchServerProfile(addr),
          lookupEnsName(addr),
        ])
        if (serverProfile) applyServerProfile(serverProfile)
        if (ensName !== undefined) applyEnsName(ensName)
      } catch {}
    }

    const unsub = subscribeWallet(() => syncProfile(myAddress()))
    syncProfile(myAddress())   // run immediately on mount
    return unsub
  }, [])

  // Deep-link: ?join=CODE → auto-navigate to Mistrial tab
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw  = new URLSearchParams(window.location.search).get('join') || ''
    const code = normalizeRoomCode(raw)
    if (isValidRoomCode(code)) setActiveTab('mistrial')
  }, [setActiveTab])

  const inGame     = roomCode && phase !== PHASES.LOBBY
  const showTopNav = !inGame

  return (
    <ErrorBoundary>
      <a href="#main-content" className="skip-link">Skip to content</a>

      <div className="min-h-screen bg-void bg-grid relative flex flex-col">
        {/* Ambient glows */}
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-plasma/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-crimson/4 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="fixed top-1/2 left-0 w-64 h-64 bg-ice/3 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

        <NetworkBanner />
        {showTopNav && <TopNav />}
        {inGame && <GameHeader />}
        <WalletPanel />

        <main
          id="main-content"
          className={`flex-1 ${inGame ? 'pt-20 md:pt-16' : ''} ${showTopNav ? 'pb-20 md:pb-0' : ''}`}
        >
          <Suspense fallback={<PageLoader />}>
            {inGame ? (
              <>
                {phase === PHASES.WRITING        && <WritingPhase />}
                {phase === PHASES.VOTING         && <VotingPhase />}
                {phase === PHASES.AI_JUDGING     && <AIJudgingPhase />}
                {(phase === PHASES.OBJECTION || phase === PHASES.OBJECTION_VOTE) && <ObjectionPhase />}
                {phase === PHASES.REVEAL         && <RevealPhase />}
                {phase === PHASES.SCOREBOARD     && <ScoreboardPage />}
              </>
            ) : (
              <>
                {activeTab === 'lobby'       && roomCode && phase === PHASES.LOBBY && <LobbyPage />}
                {activeTab === 'home'        && <HomePage />}
                {activeTab === 'mistrial'    && <MistrialPage />}
                {activeTab === 'games'       && <GamesPage />}
                {activeTab === 'leaderboard' && <LeaderboardPage />}
                {activeTab === 'profile'     && <ProfilePage />}
              </>
            )}
          </Suspense>
        </main>

        <Footer />

        <ToastContainer />
        <TxStatusBanner />
        <ChatPanel />
        <OnboardingModal />
        <IdentityGateModal />
        <PlayerProfileCard />
      </div>
    </ErrorBoundary>
  )
}
