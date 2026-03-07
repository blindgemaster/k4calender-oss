"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleCalendarProvider = void 0;
/**
 * Google Calendar Provider
 * Uses Google Calendar API v3 via OAuth2
 */
class GoogleCalendarProvider {
    constructor() {
        this.id = 'google';
        this.name = 'Google Calendar';
    }
    fetchWithAuth(connection_1, url_1) {
        return __awaiter(this, arguments, void 0, function* (connection, url, options = {}) {
            const response = yield fetch(url, Object.assign(Object.assign({}, options), { headers: Object.assign({ Authorization: `Bearer ${connection.accessToken}`, 'Content-Type': 'application/json' }, options.headers) }));
            if (response.status === 401) {
                throw new Error('GOOGLE_TOKEN_EXPIRED');
            }
            if (!response.ok) {
                const error = yield response.text();
                throw new Error(`Google Calendar API error: ${response.status} ${error}`);
            }
            return response.json();
        });
    }
    getEvents(connection, range) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const params = new URLSearchParams({
                timeMin: new Date(range.start).toISOString(),
                timeMax: new Date(range.end).toISOString(),
                singleEvents: 'true',
                orderBy: 'startTime',
                maxResults: '500',
            });
            const data = yield this.fetchWithAuth(connection, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`);
            return ((_a = data.items) !== null && _a !== void 0 ? _a : [])
                .filter((item) => item.status !== 'cancelled')
                .map((item) => {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                return ({
                    id: item.id,
                    calendarId: connection.id,
                    title: (_a = item.summary) !== null && _a !== void 0 ? _a : '(No title)',
                    start: (_c = (_b = item.start) === null || _b === void 0 ? void 0 : _b.dateTime) !== null && _c !== void 0 ? _c : (_d = item.start) === null || _d === void 0 ? void 0 : _d.date,
                    end: (_f = (_e = item.end) === null || _e === void 0 ? void 0 : _e.dateTime) !== null && _f !== void 0 ? _f : (_g = item.end) === null || _g === void 0 ? void 0 : _g.date,
                    allDay: !((_h = item.start) === null || _h === void 0 ? void 0 : _h.dateTime),
                    status: item.status,
                });
            });
        });
    }
    createEvent(connection, event) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = {
                summary: event.title,
                description: event.description,
                start: { dateTime: event.start, timeZone: 'UTC' },
                end: { dateTime: event.end, timeZone: 'UTC' },
                attendees: [{ email: event.attendeeEmail, displayName: event.attendeeName }],
                location: event.location,
                sendUpdates: 'all',
            };
            const created = yield this.fetchWithAuth(connection, 'https://www.googleapis.com/calendar/v3/calendars/primary/events', { method: 'POST', body: JSON.stringify(body) });
            return {
                id: created.id,
                calendarId: connection.id,
                title: created.summary,
                start: created.start.dateTime,
                end: created.end.dateTime,
                status: 'confirmed',
            };
        });
    }
    deleteEvent(connection, eventId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.fetchWithAuth(connection, `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`, { method: 'DELETE' });
        });
    }
    refreshToken(connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: connection.refreshToken,
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET,
                }),
            });
            if (!response.ok)
                throw new Error('Failed to refresh Google token');
            const data = yield response.json();
            return {
                accessToken: data.access_token,
                expiresAt: new Date(Date.now() + data.expires_in * 1000),
            };
        });
    }
}
exports.GoogleCalendarProvider = GoogleCalendarProvider;
