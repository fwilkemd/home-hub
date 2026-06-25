/*
  Pure layout math for the time-grid views (week / day) — the part that makes a
  calendar a real calendar:

  - splitAtMidnight: a timed event becomes one segment per day it touches, each
    clipped to that day's [0, 1440] minutes. This is what lets an overnight
    night-float shift (21:00 → 07:00) render correctly as an evening block on one
    day and a morning block on the next.

  - layoutDay: given the segments on a single day, pack overlapping ones into
    side-by-side columns (interval-sweep), returning colIndex / colCount so a view
    can size each block to width = colW/colCount and offset = colIndex.
*/
import { parseLocal, dateKey, startOfDay, addDays } from './dateUtils.js'

const DAY_MIN = 1440

/** Timed event -> [{ event, dateKey, startMin, endMin, continuesBefore, continuesAfter }] */
export function splitAtMidnight(event) {
  const s = parseLocal(event.start)
  let e = parseLocal(event.end)
  if (!s || !e) return []
  if (e <= s) e = new Date(s.getTime() + 30 * 60000) // guard zero/negative length

  const segments = []
  let dayStart = startOfDay(s)
  let guard = 0
  while (dayStart < e && guard++ < 14) {
    const dayEnd = addDays(dayStart, 1)
    const segStart = s > dayStart ? s : dayStart
    const segEnd = e < dayEnd ? e : dayEnd
    segments.push({
      event,
      dateKey: dateKey(dayStart),
      startMin: Math.max(0, Math.round((segStart - dayStart) / 60000)),
      endMin: Math.min(DAY_MIN, Math.round((segEnd - dayStart) / 60000)),
      continuesBefore: segStart.getTime() > s.getTime(),
      continuesAfter: segEnd.getTime() < e.getTime(),
    })
    dayStart = dayEnd
  }
  return segments
}

/**
 * Pack a single day's segments into overlap columns.
 * Input: [{ startMin, endMin, ... }]  Output: same objects + { colIndex, colCount }.
 */
export function layoutDay(segments) {
  const items = segments
    .slice()
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const out = []
  let cluster = []
  let clusterEnd = -1

  const flush = () => {
    const colEnds = [] // last endMin placed in each column
    for (const it of cluster) {
      let col = colEnds.findIndex((end) => it.startMin >= end)
      if (col === -1) {
        col = colEnds.length
        colEnds.push(it.endMin)
      } else {
        colEnds[col] = it.endMin
      }
      it._col = col
    }
    const colCount = colEnds.length
    for (const it of cluster) out.push({ ...it, colIndex: it._col, colCount })
    cluster = []
    clusterEnd = -1
  }

  for (const it of items) {
    if (cluster.length && it.startMin >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.endMin)
  }
  flush()
  return out
}
