// ─── Calendar Types ────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  start: string // ISO 8601
  end: string   // ISO 8601
  allDay?: boolean
  status?: 'confirmed' | 'tentative' | 'cancelled'
}

export interface DateRange {
  start: number // Unix ms
  end: number   // Unix ms
}

export interface Slot {
  start: string // ISO 8601
  end: string   // ISO 8601
  durationMinutes: number
}

export interface AvailabilityParams {
  date: string          // ISO date: "2025-04-01"
  durationMinutes: number
  timezone?: string
  workingHoursStart?: string  // "09:00"
  workingHoursEnd?: string    // "17:00"
  slotIntervalMinutes?: number
  bufferAfterMinutes?: number
}

// ─── Calendar Provider Interface ──────────────────────────────────────────

export interface CalendarConnection {
  id: string
  userId: string
  provider: 'google' | 'outlook' | 'icloud' | 'caldav'
  accessToken: string
  refreshToken?: string
  tokenExpiresAt?: Date
  isPrimary: boolean
}

export interface CalendarProvider {
  readonly id: string
  readonly name: string
  getEvents(connection: CalendarConnection, range: { start: string; end: string }): Promise<CalendarEvent[]>
  createEvent(connection: CalendarConnection, event: NewCalendarEvent): Promise<CalendarEvent>
  deleteEvent(connection: CalendarConnection, eventId: string): Promise<void>
  refreshToken(connection: CalendarConnection): Promise<{ accessToken: string; expiresAt: Date }>
}

export interface NewCalendarEvent {
  title: string
  description?: string
  start: string
  end: string
  attendeeEmail: string
  attendeeName: string
  location?: string
}

// ─── Payment Types ─────────────────────────────────────────────────────────

export interface CheckoutParams {
  amount: number        // in smallest unit (cents)
  currency: string
  bookingId: string
  description: string
  customerEmail: string
  successUrl: string
  cancelUrl: string
  connectedAccountId?: string  // Stripe Connect: host's Express account ID
}

export interface CheckoutSession {
  id: string
  url: string           // redirect user here to pay
  expiresAt: Date
}

export interface WebhookEvent {
  type: 'payment.completed' | 'payment.failed' | 'refund.completed'
  chargeId: string
  amount: number
  currency: string
  metadata?: Record<string, string>
}

export interface Refund {
  id: string
  chargeId: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed'
}

export interface PaymentGateway {
  readonly id: string
  readonly name: string
  createCheckout(params: CheckoutParams): Promise<CheckoutSession>
  verifyWebhook(payload: Buffer, signature: string): Promise<WebhookEvent>
  refund(chargeId: string, amount?: number): Promise<Refund>
}

// ─── Booking Types ─────────────────────────────────────────────────────────

export interface Booking {
  id: string
  bookingTypeId: string
  hostUserId: string
  attendeeName: string
  attendeeEmail: string
  startTime: string
  endTime: string
  timezone: string
  status: 'confirmed' | 'cancelled' | 'rescheduled' | 'no_show'
  calendarEventId?: string
  payment?: Payment
  createdAt: string
}

export interface Payment {
  id: string
  bookingId: string
  gateway: string
  gatewayChargeId?: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'refunded' | 'failed'
  paidAt?: string
}

export interface CreateBookingParams {
  bookingTypeId: string
  hostUserId: string
  attendeeName: string
  attendeeEmail: string
  slot: Slot
  timezone: string
  answers?: Record<string, string>
}
