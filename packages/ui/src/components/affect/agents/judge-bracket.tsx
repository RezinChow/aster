import { Check, Trophy } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge } from '../shared'

export interface Contender { id: string; name: string; icon?: ReactNode; meta?: string; output?: string }
export interface Verdict { winner: string; reason?: string; scores?: [number, number] }
export interface JudgeBracketProps {
  contenders: Contender[]
  verdicts?: Record<string, Verdict>
  judging?: string
  judge?: string
  task?: string
  onPick?: (winner: Contender) => void
  title?: string
  className?: string
}

interface Match { round: number; index: number; key: string; a: string; b: string }
const contenderById = (list: Contender[], id: string) => list.find((contender) => contender.id === id)
const winnerOf = (verdicts: Record<string, Verdict>, key: string) => verdicts[key]?.winner

function MatchDetails({
  match, verdict, contenders, judge, onPick, onClose
}: {
  match: Match
  verdict?: Verdict
  contenders: Contender[]
  judge: string
  onPick?: (winner: Contender) => void
  onClose: () => void
}) {
  return (
    <div role="dialog" aria-label={`Round ${match.round + 1} match details`} className="mt-3 rounded-md border border-border bg-background p-2.5">
      <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-medium text-foreground">Match {match.round + 1}:{match.index + 1}</span><button type="button" aria-label="Close match" onClick={onClose} className="text-[11px] text-muted-foreground">Close</button></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {[contenderById(contenders, match.a), contenderById(contenders, match.b)].filter((item): item is Contender => !!item).map((contender, slot) => (
          <div key={contender.id} className={cn('rounded-md border p-2', verdict?.winner === contender.id ? 'border-success' : 'border-border')}>
            <div className="flex items-center justify-between"><span className="truncate text-[11px] font-medium text-foreground">{contender.name}</span>{verdict?.scores ? <span className="text-[11px] tabular-nums text-muted-foreground">{verdict.scores[slot]}</span> : null}</div>
            <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">{contender.output ?? contender.meta ?? 'No output'}</p>
          </div>
        ))}
      </div>
      {verdict?.reason ? <p className="mt-2 text-[11px] text-foreground">{judge}: {verdict.reason}</p> : null}
      {onPick && verdict?.winner ? (
        <button type="button" onClick={() => { const winner = contenderById(contenders, verdict.winner); if (winner) onPick(winner) }} className="mt-2 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground">Use winner</button>
      ) : null}
    </div>
  )
}

/** An LLM judge picking the best attempt, round by round. */
export function JudgeBracket({
  contenders,
  verdicts = {},
  judging,
  judge = 'Judge',
  task,
  onPick,
  title = 'Judge',
  className
}: JudgeBracketProps) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)

  const rounds: Match[][] = []
  let survivors = contenders.map((contender) => contender.id)
  let round = 0
  while (survivors.length > 1) {
    const matches: Match[] = []
    for (let index = 0; index < survivors.length; index += 2) {
      const a = survivors[index]
      const b = survivors[index + 1]
      if (!b) { matches.push({ round, index: Math.floor(index / 2), key: `${round}:${Math.floor(index / 2)}`, a, b: a }); continue }
      matches.push({ round, index: Math.floor(index / 2), key: `${round}:${Math.floor(index / 2)}`, a, b })
    }
    rounds.push(matches)
    survivors = matches.map((match) => winnerOf(verdicts, match.key) ?? match.a)
    round += 1
  }
  const finalWinner = survivors[0]
  const allMatches = rounds.flat()
  const pathKeys = new Set<string>()
  if (finalWinner) {
    let current = finalWinner
    for (let r = rounds.length - 1; r >= 0; r--) {
      const match = rounds[r].find((item) => item.a === current || item.b === current)
      if (match) { pathKeys.add(match.key); current = winnerOf(verdicts, match.key) ?? match.a }
    }
  }
  const openMatch = allMatches.find((match) => match.key === openKey)

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, match: Match) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpenKey((current) => (current === match.key ? null : match.key)) }
    else if (event.key === 'ArrowRight') { event.preventDefault(); const next = allMatches.find((item) => item.round === match.round + 1 && (item.a === winnerOf(verdicts, match.key) || item.b === winnerOf(verdicts, match.key))); if (next) setFocusedKey(next.key) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); const previous = allMatches.find((item) => item.round === match.round - 1 && (item.a === match.a || item.b === match.a || item.a === match.b || item.b === match.b)); if (previous) setFocusedKey(previous.key) }
    else if (event.key === 'ArrowDown') { event.preventDefault(); const next = rounds[match.round]?.[match.index + 1]; if (next) setFocusedKey(next.key) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); const previous = rounds[match.round]?.[match.index - 1]; if (previous) setFocusedKey(previous.key) }
    else if (event.key === 'Escape') { event.preventDefault(); setOpenKey(null); setFocusedKey(judging ?? null) }
  }

  return (
    <div data-slot="judge-bracket" className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader title={title} description={task ?? `${judge} judging`} actions={finalWinner ? <AffectToneBadge tone="success">Winner: {contenderById(contenders, finalWinner)?.name ?? finalWinner}</AffectToneBadge> : undefined} />
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {rounds.map((matches, roundIndex) => (
            <div key={roundIndex} className="min-w-[140px] flex-1 space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Round {roundIndex + 1}</div>
              {matches.map((match) => {
                const winner = winnerOf(verdicts, match.key)
                const verdict = verdicts[match.key]
                const isJudging = judging === match.key
                const isOpen = openKey === match.key
                const contenderA = contenderById(contenders, match.a)
                const contenderB = contenderById(contenders, match.b)
                return (
                  <button
                    key={match.key}
                    type="button"
                    aria-label={`Round ${roundIndex + 1} match ${match.index + 1}: ${contenderA?.name ?? match.a} versus ${contenderB?.name ?? match.b}. ${isJudging ? 'Being judged' : winner ? `${contenderById(contenders, winner)?.name ?? winner} won` : 'Pending'}.`}
                    aria-expanded={isOpen}
                    tabIndex={focusedKey === match.key || (!focusedKey && roundIndex === 0 && match.index === 0) ? 0 : -1}
                    onFocus={() => setFocusedKey(match.key)}
                    onKeyDown={(event) => onKeyDown(event, match)}
                    onClick={() => setOpenKey((current) => (current === match.key ? null : match.key))}
                    className={cn('w-full rounded-md border border-border p-2 text-left transition-colors hover:bg-muted/60', isJudging && 'animate-pulse border-info', pathKeys.has(match.key) && 'border-success', isOpen && 'bg-accent')}
                  >
                    {[contenderA, match.b === match.a ? undefined : contenderB].filter(Boolean).map((contender, slot) => {
                      const item = contender as Contender
                      const won = winner === item?.id
                      return (
                        <div key={slot} className={cn('flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px]', won ? 'bg-success-subtle text-success-subtle-foreground' : 'text-muted-foreground', !won && winner && 'line-through opacity-60')}>
                          {item?.icon ? <span className="shrink-0">{item.icon}</span> : <span className="size-2 shrink-0 rounded-sm bg-muted-foreground/50" />}
                          <span className="min-w-0 flex-1 truncate">{item?.name ?? '—'}</span>
                          {won ? <Check aria-hidden="true" className="size-3 shrink-0" /> : null}
                          {verdict?.scores ? <span className="shrink-0 tabular-nums">{verdict.scores[slot]}</span> : null}
                        </div>
                      )
                    })}
                  </button>
                )
              })}
            </div>
          ))}
          {finalWinner ? (
            <div className="min-w-[140px] flex-1 space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Winner</div>
              <div className="flex items-center gap-2 rounded-md border border-success bg-success-subtle p-2 text-xs text-success-subtle-foreground"><Trophy aria-hidden="true" className="size-4 shrink-0" /><span className="truncate">{contenderById(contenders, finalWinner)?.name ?? finalWinner}</span></div>
            </div>
          ) : null}
        </div>

        {openMatch ? (
          <MatchDetails
            match={openMatch}
            verdict={verdicts[openMatch.key]}
            contenders={contenders}
            judge={judge}
            onPick={onPick}
            onClose={() => setOpenKey(null)}
          />
        ) : null}
      </AffectSurface>
    </div>
  )
}
