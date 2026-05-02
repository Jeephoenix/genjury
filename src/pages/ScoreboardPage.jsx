import React from 'react'
import {
  Crown, Trophy, Medal, Award, Home, RotateCcw, Banknote, Sparkles,
} from 'lucide-react'
import useGameStore from '../lib/store'
import { formatGen, getChainNativeSymbol } from '../lib/genlayer'
import Confetti from '../components/Confetti'
import Avatar from '../components/Avatar'

const RANK_LABELS = ['Champion', 'Runner-Up', 'Third Place', '4th Place', '5th Place', '6th Place', '7th Place', '8th Place']

function RankBadge({ rank }) {
  if (rank === 1) return <Crown  className="w-6 h-6 text-gold"     strokeWidth={2} />
  if (rank === 2) return <Trophy className="w-6 h-6 text-white/60" strokeWidth={2} />
  if (rank === 3) return <Medal  className="w-6 h-6 text-signal"   strokeWidth={2} />
  return <span className="font-display font-bold text-base text-white/30">#{rank}</span>
}

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

export default function ScoreboardPage() {
  const players             = useGameStore((s) => s.players)
  const myId                = useGameStore((s) => s.myId)
  const scoreHistory        = useGameStore((s) => s.scoreHistory)
  const resetGame           = useGameStore((s) => s.resetGame)
  const startGame           = useGameStore((s) => s.startGame)
  const winnerAddress       = useGameStore((s) => s.winnerAddress)
  const winnerWinningsWei   = useGameStore((s) => s.winnerWinningsWei)
  const prizeDistributed    = useGameStore((s) => s.prizeDistributed)
  const houseAddress        = useGameStore((s) => s.houseAddress)
  const houseCutBps         = useGameStore((s) => s.houseCutBps)
  const houseFeesCollectedWei = useGameStore((s) => s.houseFeesCollectedWei)
  const claimPrize          = useGameStore((s) => s.claimPrize)
  const claimHouseFees      = useGameStore((s) => s.claimHouseFees)

  const symbol  = getChainNativeSymbol()
  const sorted  = [...players].sort((a, b) => b.xp - a.xp)
  const winner  = sorted[0]
  const me      = players.find((p) => p.id === myId)
  const myRank  = sorted.findIndex((p) => p.id === myId) + 1

  const iAmWinner         = !!winnerAddress && winnerAddress === myId
  const iAmHouse          = !!houseAddress && houseAddress === myId
  const hasUnclaimedPrize = !prizeDistributed && winnerWinningsWei > 0n
  const hasUnclaimedFees  = houseFeesCollectedWei > 0n
  const houseCutPct       = (Number(houseCutBps || 0) / 100).toFixed(2)

  const playAgainBlocked = hasUnclaimedPrize || hasUnclaimedFees
  const playAgainTitle   = hasUnclaimedPrize
    ? 'Winner must claim the prize before resetting'
    : hasUnclaimedFees
    ? 'House must sweep fees before resetting'
    : ''

  const iAmTopPlayer = myRank === 1

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16 gap-8 animate-slide-up relative overflow-x-hidden">
      {iAmTopPlayer && <Confetti duration={5000} />}

      <div className="w-full max-w-lg">

        {/* Winner spotlight */}
        {winner && (
          <div className="text-center mb-10 animate-bounce-in">
            <div className="relative inline-block mb-5">
              {/* Ambient glow */}
              <div
                className="absolute -inset-6 rounded-full blur-3xl opacity-30 pointer-events-none"
                style={{ background: winner.color }}
              />
              <div className="relative">
                <Avatar
                  name={winner.name}
                  src={winner.avatar && String(winner.avatar).startsWith('data:') ? winner.avatar : ''}
                  color={winner.color}
                  size={96}
                />
                <div className="absolute -top-3 -right-2 drop-shadow-[0_0_16px_rgba(245,200,66,0.8)]">
                  <Crown className="w-8 h-8 text-gold" strokeWidth={2} />
                </div>
              </div>
            </div>

            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-1">
              <span style={{ color: winner.color }}>{winner.name}</span> wins!
            </h2>
            <p className="text-white/35 text-sm mb-3 tnum">{winner.xp} XP · Level {winner.level}</p>

            <span className="inline-flex items-center gap-1.5 badge bg-gold/15 text-gold border border-gold/30 text-sm">
              <Trophy className="w-3.5 h-3.5" /> Genjury Champion
            </span>
          </div>
        )}

        {/* Settlement panel */}
        {(winnerWinningsWei > 0n || hasUnclaimedFees || iAmHouse) && (
          <div className="glass rounded-2xl border border-white/[0.09] p-5 mb-6 space-y-4">
            <h3 className="font-display font-bold text-white inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gold" strokeWidth={2} />
              Settlement
            </h3>

            {/* Prize row */}
            <div className="relative rounded-xl bg-gold/[0.07] border border-gold/20 p-4 overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <span className="text-white/50 text-xs font-mono uppercase tracking-wider">Prize pool</span>
                <span className="text-gold font-display font-bold text-xl text-glow-gold">
                  {formatGen(winnerWinningsWei, 6)} {symbol}
                </span>
              </div>
              <div className="text-white/35 text-xs mb-3">
                {hasUnclaimedPrize
                  ? <>Awarded to <span className="font-mono text-white/60">{short(winnerAddress)}</span> — awaiting claim.</>
                  : winnerWinningsWei === 0n && winner
                  ? 'Free-play room — no prize to distribute.'
                  : <>Claimed by <span className="font-mono text-white/60">{short(winnerAddress)}</span>.</>}
              </div>
              {hasUnclaimedPrize && (
                <button
                  className={`btn ${iAmWinner ? 'btn-gold' : 'btn-ghost'} w-full py-3 text-sm`}
                  disabled={!iAmWinner}
                  title={iAmWinner ? '' : 'Only the winner can claim'}
                  onClick={claimPrize}
                >
                  {iAmWinner ? (
                    <span className="inline-flex items-center gap-1.5 justify-center">
                      <Trophy className="w-4 h-4" strokeWidth={2.25} />
                      Claim {formatGen(winnerWinningsWei, 6)} {symbol}
                    </span>
                  ) : 'Waiting for winner to claim'}
                </button>
              )}
            </div>

            {/* House fees */}
            {(hasUnclaimedFees || iAmHouse) && (
              <div className="relative rounded-xl bg-plasma/[0.07] border border-plasma/20 p-4 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-plasma/40 to-transparent" />
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <span className="text-white/50 text-xs font-mono uppercase tracking-wider">
                    House cut · {houseCutPct}%
                  </span>
                  <span className="text-plasma font-display font-bold text-lg">
                    {formatGen(houseFeesCollectedWei, 6)} {symbol}
                  </span>
                </div>
                <div className="text-white/35 text-xs mb-3">
                  House: <span className="font-mono text-white/55">{short(houseAddress)}</span>
                  {iAmHouse && <span className="ml-2 badge bg-plasma/15 text-plasma border border-plasma/25 text-[9px]">YOU</span>}
                </div>
                {hasUnclaimedFees && (
                  <button
                    className={`btn ${iAmHouse ? 'btn-plasma' : 'btn-ghost'} w-full py-3 text-sm`}
                    disabled={!iAmHouse}
                    title={iAmHouse ? '' : 'Only the house wallet can sweep fees'}
                    onClick={claimHouseFees}
                  >
                    {iAmHouse ? (
                      <span className="inline-flex items-center gap-1.5 justify-center">
                        <Banknote className="w-4 h-4" strokeWidth={2.25} />
                        Sweep {formatGen(houseFeesCollectedWei, 6)} {symbol}
                      </span>
                    ) : 'Waiting for the house to sweep'}
                  </button>
                )}
                {!hasUnclaimedFees && iAmHouse && (
                  <p className="text-white/25 text-xs italic">
                    No fees to claim yet. You'll earn {houseCutPct}% of every entry fee.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Player rankings */}
        <div className="space-y-2.5 mb-8">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`relative rounded-2xl flex items-center gap-4 p-4 overflow-hidden transition-all duration-300 ${p.id === myId ? 'ring-1' : ''}`}
              style={{
                background:   i === 0
                  ? `linear-gradient(135deg, ${p.color}15, rgba(12,12,20,0.9))`
                  : 'rgba(12,12,20,0.85)',
                border:       `1px solid ${i === 0 ? p.color + '35' : 'rgba(255,255,255,0.06)'}`,
                '--tw-ring-color': p.color,
                animationDelay: `${i * 0.07}s`,
              }}
            >
              {i === 0 && (
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent"
                  style={{ backgroundImage: `linear-gradient(90deg, transparent, ${p.color}60, transparent)` }}
                />
              )}

              <div className="flex-shrink-0 w-8 flex items-center justify-center">
                <RankBadge rank={i + 1} />
              </div>

              <Avatar
                name={p.name}
                src={p.avatar && String(p.avatar).startsWith('data:') ? p.avatar : ''}
                color={p.color}
                size={40}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="font-display font-bold text-white text-sm">{p.name}</span>
                  {p.id === myId && (
                    <span className="badge bg-plasma/12 text-plasma border border-plasma/25 text-[9px]">YOU</span>
                  )}
                </div>
                <div className="text-white/25 text-[10px] font-mono mb-2">{RANK_LABELS[i] || `${i + 1}th`}</div>
                <div className="h-1 bg-white/[0.07] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width:     `${(p.xp / (sorted[0]?.xp || 1)) * 100}%`,
                      background: p.color,
                      boxShadow:  i === 0 ? `0 0 8px ${p.color}70` : 'none',
                    }}
                  />
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="font-display font-bold text-xl tnum" style={{ color: p.color }}>{p.xp}</div>
                <div className="text-white/25 text-[10px] font-mono">XP</div>
                <div className="text-white/20 text-[10px] tnum">Lv.{p.level}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Round breakdown table */}
        {scoreHistory.length > 0 && (
          <div className="glass rounded-2xl border border-white/[0.08] p-5 mb-8">
            <h3 className="font-display font-bold text-white mb-4">Round Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07]">
                    <th className="text-white/25 text-[10px] font-mono pb-2.5 text-left uppercase tracking-wider">Player</th>
                    {scoreHistory.map((_, i) => (
                      <th key={i} className="text-white/25 text-[10px] font-mono pb-2.5 text-center uppercase tracking-wider">R{i + 1}</th>
                    ))}
                    <th className="text-white/25 text-[10px] font-mono pb-2.5 text-right uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr key={p.id} className="border-b border-white/[0.04]">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <Avatar
                            name={p.name}
                            src={p.avatar && String(p.avatar).startsWith('data:') ? p.avatar : ''}
                            color={p.color}
                            size={20}
                          />
                          <span className="text-white/65 text-xs">{p.name}</span>
                        </div>
                      </td>
                      {scoreHistory.map((rnd, i) => (
                        <td key={i} className="py-2.5 text-center">
                          <span className={`text-xs font-mono ${(rnd.xpGained?.[p.id] || 0) > 0 ? 'text-gold' : 'text-white/20'}`}>
                            {(rnd.xpGained?.[p.id] || 0) > 0 ? `+${rnd.xpGained[p.id]}` : '—'}
                          </span>
                        </td>
                      ))}
                      <td className="py-2.5 text-right font-display font-bold tnum" style={{ color: p.color }}>
                        {p.xp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* My personal result */}
        {me && (
          <div
            className="glass rounded-2xl border text-center p-5 mb-6"
            style={{
              borderColor: me.color + '30',
              background:  me.color + '08',
            }}
          >
            <p className="text-white/40 text-sm mb-1">Your result</p>
            <p
              className="font-display font-bold text-2xl inline-flex items-center gap-2 justify-center"
              style={{ color: me.color }}
            >
              <RankBadge rank={myRank} />
              {RANK_LABELS[myRank - 1] || `${myRank}th place`}
            </p>
            <p className="text-white/25 text-xs mt-1.5 font-mono">{me.xp} XP · Level {me.level}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            className="btn btn-ghost py-4 inline-flex items-center justify-center gap-2"
            onClick={resetGame}
          >
            <Home className="w-4 h-4" strokeWidth={2.25} /> Main Menu
          </button>
          <button
            className="btn btn-neon py-4 inline-flex items-center justify-center gap-2"
            onClick={startGame}
            disabled={playAgainBlocked}
            title={playAgainTitle}
          >
            <RotateCcw className="w-4 h-4" strokeWidth={2.25} /> Play Again
          </button>
        </div>

        {playAgainBlocked && (
          <p className="text-white/30 text-xs text-center mt-3">{playAgainTitle}</p>
        )}

        <div className="text-center mt-8 text-white/12 text-xs font-mono">
          Genjury · Built on GenLayer · Intelligent Contracts + Optimistic Democracy
        </div>
      </div>
    </div>
  )
}
