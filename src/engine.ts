import type { CalendarEvent, DateRange, Slot, AvailabilityParams } from './types.js'

/**
 * Merges overlapping busy blocks into a minimal sorted list.
 */
export function mergeBusyBlocks(events: CalendarEvent[]): DateRange[] {
  if (events.length === 0) return []

  const sorted = [...events]
    .map(e => ({ start: new Date(e.start).getTime(), end: new Date(e.end).getTime() }))
    .sort((a, b) => a.start - b.start)

  const merged: DateRange[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end)
    } else {
      merged.push(current)
    }
  }

  return merged
}

/**
 * Checks if a slot overlaps with any busy block.
 */
export function overlapsAnyBlock(slot: { start: number; end: number }, blocks: DateRange[]): boolean {
  return blocks.some(b => slot.start < b.end && slot.end > b.start)
}

/**
 * Generates all candidate slots within working hours.
 */
export function generateCandidateSlots(params: AvailabilityParams): Slot[] {
  const {
    date,
    durationMinutes,
    workingHoursStart = '09:00',
    workingHoursEnd = '17:00',
    slotIntervalMinutes = 30,
  } = params

  const slots: Slot[] = []
  const [startHour, startMin] = workingHoursStart.split(':').map(Number)
  const [endHour, endMin] = workingHoursEnd.split(':').map(Number)

  const dayStart = new Date(date)
  dayStart.setHours(startHour, startMin, 0, 0)

  const dayEnd = new Date(date)
  dayEnd.setHours(endHour, endMin, 0, 0)

  let cursor = dayStart.getTime()

  while (cursor + durationMinutes * 60_000 <= dayEnd.getTime()) {
    const slotEnd = cursor + durationMinutes * 60_000
    slots.push({
      start: new Date(cursor).toISOString(),
      end: new Date(slotEnd).toISOString(),
      durationMinutes,
    })
    cursor += slotIntervalMinutes * 60_000
  }

  return slots
}

/**
 * Main availability engine.
 * Takes all busy events from all connected calendars and returns free slots.
 */
export function computeAvailableSlots(
  params: AvailabilityParams,
  allEvents: CalendarEvent[]
): Slot[] {
  const busyBlocks = mergeBusyBlocks(allEvents)
  const candidates = generateCandidateSlots(params)

  return candidates.filter(slot => {
    const slotStart = new Date(slot.start).getTime()
    const slotEnd = new Date(slot.end).getTime()
    const bufferEnd = slotEnd + (params.bufferAfterMinutes ?? 0) * 60_000
    return !overlapsAnyBlock({ start: slotStart, end: bufferEnd }, busyBlocks)
  })
}
