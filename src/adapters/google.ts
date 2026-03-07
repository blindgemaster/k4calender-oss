import type { CalendarProvider, CalendarConnection, CalendarEvent, NewCalendarEvent } from '../types.js'

/**
 * Google Calendar Provider
 * Uses Google Calendar API v3 via OAuth2
 */
export class GoogleCalendarProvider implements CalendarProvider {
  readonly id = 'google'
  readonly name = 'Google Calendar'

  private async fetchWithAuth(connection: CalendarConnection, url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (response.status === 401) {
      throw new Error('GOOGLE_TOKEN_EXPIRED')
    }

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Google Calendar API error: ${response.status} ${error}`)
    }

    return response.json()
  }

  async getEvents(
    connection: CalendarConnection,
    range: { start: string; end: string }
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: new Date(range.start).toISOString(),
      timeMax: new Date(range.end).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '500',
    })

    const data = await this.fetchWithAuth(
      connection,
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`
    )

    return (data.items ?? [])
      .filter((item: any) => item.status !== 'cancelled')
      .map((item: any): CalendarEvent => ({
        id: item.id,
        calendarId: connection.id,
        title: item.summary ?? '(No title)',
        start: item.start?.dateTime ?? item.start?.date,
        end: item.end?.dateTime ?? item.end?.date,
        allDay: !item.start?.dateTime,
        status: item.status,
      }))
  }

  async createEvent(
    connection: CalendarConnection,
    event: NewCalendarEvent
  ): Promise<CalendarEvent> {
    const body = {
      summary: event.title,
      description: event.description,
      start: { dateTime: event.start, timeZone: 'UTC' },
      end: { dateTime: event.end, timeZone: 'UTC' },
      attendees: [{ email: event.attendeeEmail, displayName: event.attendeeName }],
      location: event.location,
      sendUpdates: 'all',
    }

    const created = await this.fetchWithAuth(
      connection,
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      { method: 'POST', body: JSON.stringify(body) }
    )

    return {
      id: created.id,
      calendarId: connection.id,
      title: created.summary,
      start: created.start.dateTime,
      end: created.end.dateTime,
      status: 'confirmed',
    }
  }

  async deleteEvent(connection: CalendarConnection, eventId: string): Promise<void> {
    await this.fetchWithAuth(
      connection,
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
      { method: 'DELETE' }
    )
  }

  async refreshToken(
    connection: CalendarConnection
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refreshToken!,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    })

    if (!response.ok) throw new Error('Failed to refresh Google token')

    const data = await response.json()
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }
  }
}
