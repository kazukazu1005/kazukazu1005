import { describe, expect, it } from 'vitest'
import { buildSeries, domain, METRICS, splitAxes } from './chartData'
import type { ExerciseStat } from './calc'

const st = (date: string, over: Partial<ExerciseStat>): ExerciseStat => ({ date, maxWeight: 0, best1RM: 0, volume: 0, maxReps: 0, totalReps: 0, ...over })

describe('chartData', () => {
  const stats = [st('2026-10-01', { best1RM: 80, maxWeight: 60, volume: 1200 }), st('2026-10-08', { best1RM: 0, maxWeight: 0, volume: 900 }), st('2026-10-15', { best1RM: 90, maxWeight: 70, volume: 1500 })]
  const [rm, max, vol] = METRICS.weight

  it('keeps a day when any selected metric has data and leaves gaps as null', () => {
    const { dates, series } = buildSeries(stats, [rm, vol])
    expect(dates).toEqual(['2026-10-01', '2026-10-08', '2026-10-15'])
    expect(series[0].values).toEqual([80, null, 90])
    expect(series[1].values).toEqual([1200, 900, 1500])
    expect(buildSeries(stats, [rm]).dates).toEqual(['2026-10-01', '2026-10-15']) // 1RM alone skips the empty day
  })
  it('uses a right axis only when large-scale and normal metrics are both selected', () => {
    const s = (defs: typeof METRICS.weight) => splitAxes(buildSeries(stats, defs).series)
    expect(s([rm, max]).dual).toBe(false)
    expect(s([vol]).dual).toBe(false)
    const both = s([rm, max, vol])
    expect(both.dual).toBe(true)
    expect(both.left.map((x) => x.def.key)).toEqual(['1rm', 'max'])
    expect(both.right.map((x) => x.def.key)).toEqual(['vol'])
  })
  it('domain pads the range and never goes below zero', () => {
    const [lo, hi] = domain([80, 90])
    expect(lo).toBeCloseTo(78)
    expect(hi).toBeCloseTo(92)
    expect(domain([1, 1])[0]).toBeGreaterThanOrEqual(0)
    expect(domain([0.5, 5])[0]).toBe(0) // padding would go negative
  })
})
