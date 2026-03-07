#!/usr/bin/env node
"use strict";
/**
 * K4Calender MCP Server
 *
 * Exposes K4Calender's booking infrastructure as Model Context Protocol tools.
 * AI assistants (Claude, GPT, etc.) can use these to manage bookings in natural language.
 *
 * Usage:
 *   npx k4calender-mcp --api-key YOUR_KEY --api-url https://k4calender.dev/api/v1
 *
 * Or via stdio transport for local dev:
 *   K4CALENDER_API_KEY=xxx K4CALENDER_API_URL=http://localhost:3000/api/v1 npx k4calender-mcp
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
// ─── Config ───────────────────────────────────────────────────────────────────
const API_KEY = (_a = process.env.K4CALENDER_API_KEY) !== null && _a !== void 0 ? _a : parseArg('--api-key');
const API_URL = (_c = (_b = process.env.K4CALENDER_API_URL) !== null && _b !== void 0 ? _b : parseArg('--api-url')) !== null && _c !== void 0 ? _c : 'https://k4calender.dev/api/v1';
if (!API_KEY) {
    console.error('Error: K4CALENDER_API_KEY environment variable or --api-key argument is required');
    process.exit(1);
}
function parseArg(flag) {
    const idx = process.argv.indexOf(flag);
    return idx !== -1 ? process.argv[idx + 1] : undefined;
}
// ─── API Client ───────────────────────────────────────────────────────────────
function api(path_1) {
    return __awaiter(this, arguments, void 0, function* (path, options = {}) {
        const res = yield fetch(`${API_URL}${path}`, Object.assign(Object.assign({}, options), { headers: Object.assign({ Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }, options.headers) }));
        if (!res.ok) {
            const text = yield res.text();
            throw new Error(`K4Calender API error ${res.status}: ${text}`);
        }
        return res.json();
    });
}
// ─── MCP Server ───────────────────────────────────────────────────────────────
const server = new mcp_js_1.McpServer({
    name: 'k4calender',
    version: '0.1.0',
});
// ─── Tool: check_availability ─────────────────────────────────────────────────
server.tool('check_availability', 'Check available booking slots for a given date and duration.', {
    date: zod_1.z.string().describe('Date to check in ISO format (YYYY-MM-DD) or natural language ("next Tuesday")'),
    duration_minutes: zod_1.z.number().describe('Duration of the booking in minutes'),
    booking_type_id: zod_1.z.string().optional().describe('Specific booking type ID to check (optional)'),
    timezone: zod_1.z.string().optional().describe('Timezone like "America/New_York" (defaults to host timezone)'),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ date, duration_minutes, booking_type_id, timezone }) {
    const params = new URLSearchParams(Object.assign(Object.assign({ date, duration: String(duration_minutes) }, (booking_type_id ? { booking_type_id } : {})), (timezone ? { timezone } : {})));
    const data = yield api(`/availability?${params}`);
    const slots = data.slots;
    if (slots.length === 0) {
        return { content: [{ type: 'text', text: `No available slots found for ${date}.` }] };
    }
    const formatted = slots
        .slice(0, 10) // Return first 10 slots max
        .map(s => `• ${new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(s.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
        .join('\n');
    return {
        content: [{
                type: 'text',
                text: `Available slots on ${date}:\n${formatted}\n\n${slots.length > 10 ? `...and ${slots.length - 10} more.` : ''}`,
            }],
    };
}));
// ─── Tool: create_booking ─────────────────────────────────────────────────────
server.tool('create_booking', 'Create a new booking for an available slot. Optionally triggers payment collection.', {
    booking_type_id: zod_1.z.string().describe('The booking type ID'),
    start_time: zod_1.z.string().describe('Start time in ISO 8601 format'),
    attendee_name: zod_1.z.string().describe('Full name of the person booking'),
    attendee_email: zod_1.z.string().email().describe('Email address of the person booking'),
    timezone: zod_1.z.string().describe('Timezone of the attendee, e.g. "Europe/London"'),
    collect_payment: zod_1.z.boolean().optional().describe('Whether to generate a payment link'),
    notes: zod_1.z.string().optional().describe('Any notes from the attendee'),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ booking_type_id, start_time, attendee_name, attendee_email, timezone, collect_payment, notes }) {
    const data = yield api('/bookings', {
        method: 'POST',
        body: JSON.stringify({
            booking_type_id,
            start_time,
            attendee_name,
            attendee_email,
            timezone,
            collect_payment: collect_payment !== null && collect_payment !== void 0 ? collect_payment : false,
            notes,
        }),
    });
    let text = `✅ Booking confirmed!\n\nID: ${data.id}\nTime: ${new Date(data.start_time).toLocaleString()}\nAttendee: ${attendee_name} (${attendee_email})`;
    if (data.payment_url) {
        text += `\n\nPayment link: ${data.payment_url}`;
    }
    return { content: [{ type: 'text', text }] };
}));
// ─── Tool: get_upcoming_bookings ──────────────────────────────────────────────
server.tool('get_upcoming_bookings', 'Retrieve upcoming bookings within a date range.', {
    from: zod_1.z.string().optional().describe('Start of range (ISO date or "today"). Defaults to now.'),
    to: zod_1.z.string().optional().describe('End of range (ISO date). Defaults to 7 days from now.'),
    limit: zod_1.z.number().optional().describe('Max bookings to return (default 20)'),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ from, to, limit }) {
    const params = new URLSearchParams(Object.assign(Object.assign(Object.assign({}, (from ? { from } : {})), (to ? { to } : {})), { limit: String(limit !== null && limit !== void 0 ? limit : 20) }));
    const data = yield api(`/bookings?${params}`);
    const bookings = data.bookings;
    if (bookings.length === 0) {
        return { content: [{ type: 'text', text: 'No upcoming bookings found.' }] };
    }
    const list = bookings
        .map(b => `• ${new Date(b.start_time).toLocaleString()} — ${b.attendee_name} [${b.status}] (ID: ${b.id})`)
        .join('\n');
    return { content: [{ type: 'text', text: `Upcoming bookings:\n${list}` }] };
}));
// ─── Tool: cancel_booking ─────────────────────────────────────────────────────
server.tool('cancel_booking', 'Cancel an existing booking, with optional refund.', {
    booking_id: zod_1.z.string().describe('The booking ID to cancel'),
    reason: zod_1.z.string().optional().describe('Reason for cancellation'),
    issue_refund: zod_1.z.boolean().optional().describe('Whether to issue a refund if payment was collected'),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ booking_id, reason, issue_refund }) {
    yield api(`/bookings/${booking_id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason, issue_refund: issue_refund !== null && issue_refund !== void 0 ? issue_refund : false }),
    });
    return {
        content: [{
                type: 'text',
                text: `✅ Booking ${booking_id} cancelled.${issue_refund ? ' A refund has been initiated.' : ''}`,
            }],
    };
}));
// ─── Tool: reschedule_booking ─────────────────────────────────────────────────
server.tool('reschedule_booking', 'Reschedule an existing booking to a new time slot.', {
    booking_id: zod_1.z.string().describe('The booking ID to reschedule'),
    new_start_time: zod_1.z.string().describe('New start time in ISO 8601 format'),
    reason: zod_1.z.string().optional().describe('Reason for rescheduling'),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ booking_id, new_start_time, reason }) {
    const data = yield api(`/bookings/${booking_id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({ new_start_time, reason }),
    });
    return {
        content: [{
                type: 'text',
                text: `✅ Booking rescheduled to ${new Date(data.start_time).toLocaleString()}.`,
            }],
    };
}));
// ─── Tool: create_payment_link ────────────────────────────────────────────────
server.tool('create_payment_link', 'Generate a standalone booking + payment link for a booking type.', {
    booking_type_id: zod_1.z.string().describe('Booking type to create a link for'),
    expires_in_hours: zod_1.z.number().optional().describe('How many hours until the link expires (default: never)'),
    custom_amount: zod_1.z.number().optional().describe('Override the default price (in cents)'),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ booking_type_id, expires_in_hours, custom_amount }) {
    const data = yield api('/payment-links', {
        method: 'POST',
        body: JSON.stringify({ booking_type_id, expires_in_hours, custom_amount }),
    });
    return {
        content: [{
                type: 'text',
                text: `Payment link created: ${data.url}${expires_in_hours ? `\nExpires in ${expires_in_hours} hours.` : ''}`,
            }],
    };
}));
// ─── Tool: refund_booking ─────────────────────────────────────────────────────
server.tool('refund_booking', 'Issue a full or partial refund for a paid booking.', {
    booking_id: zod_1.z.string().describe('The booking ID'),
    amount_cents: zod_1.z.number().optional().describe('Amount to refund in cents. Omit for full refund.'),
    reason: zod_1.z.string().optional().describe('Reason for refund'),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ booking_id, amount_cents, reason }) {
    const data = yield api(`/bookings/${booking_id}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amount_cents, reason }),
    });
    const amountStr = data.refund_amount
        ? `$${(data.refund_amount / 100).toFixed(2)}`
        : 'full amount';
    return {
        content: [{
                type: 'text',
                text: `✅ Refund of ${amountStr} initiated for booking ${booking_id}. Refund ID: ${data.refund_id}`,
            }],
    };
}));
// ─── Tool: block_time ─────────────────────────────────────────────────────────
server.tool('block_time', 'Block out a time period so no bookings can be made during it.', {
    start: zod_1.z.string().describe('Start of blocked period (ISO 8601)'),
    end: zod_1.z.string().describe('End of blocked period (ISO 8601)'),
    reason: zod_1.z.string().optional().describe('Label for the block (e.g. "Holiday", "Deep work")'),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ start, end, reason }) {
    yield api('/blocks', {
        method: 'POST',
        body: JSON.stringify({ start, end, reason }),
    });
    return {
        content: [{
                type: 'text',
                text: `✅ Time blocked from ${new Date(start).toLocaleString()} to ${new Date(end).toLocaleString()}.`,
            }],
    };
}));
// ─── Tool: get_team_availability ──────────────────────────────────────────────
server.tool('get_team_availability', 'Find time slots when ALL specified team members are available.', {
    member_ids: zod_1.z.array(zod_1.z.string()).describe('List of user IDs to check'),
    date: zod_1.z.string().describe('Date to check (ISO YYYY-MM-DD)'),
    duration_minutes: zod_1.z.number().describe('Required duration in minutes'),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ member_ids, date, duration_minutes }) {
    const data = yield api('/availability/team', {
        method: 'POST',
        body: JSON.stringify({ member_ids, date, duration_minutes }),
    });
    const slots = data.slots;
    if (slots.length === 0) {
        return { content: [{ type: 'text', text: `No overlapping availability found for all team members on ${date}.` }] };
    }
    const list = slots
        .slice(0, 5)
        .map(s => `• ${new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(s.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
        .join('\n');
    return { content: [{ type: 'text', text: `Team availability on ${date}:\n${list}` }] };
}));
// ─── Tool: send_reminder ──────────────────────────────────────────────────────
server.tool('send_reminder', 'Manually send a reminder email/SMS for an upcoming booking.', {
    booking_id: zod_1.z.string().describe('The booking ID to send a reminder for'),
    channel: zod_1.z.enum(['email', 'sms', 'both']).optional().describe('Channel to send reminder via (default: email)'),
    message: zod_1.z.string().optional().describe('Custom reminder message'),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ booking_id, channel, message }) {
    yield api(`/bookings/${booking_id}/remind`, {
        method: 'POST',
        body: JSON.stringify({ channel: channel !== null && channel !== void 0 ? channel : 'email', message }),
    });
    return { content: [{ type: 'text', text: `✅ Reminder sent for booking ${booking_id}.` }] };
}));
// ─── Tool: sync_calendar ──────────────────────────────────────────────────────
server.tool('sync_calendar', 'Force a sync of a connected calendar to pull latest events.', {
    connection_id: zod_1.z.string().optional().describe('Specific calendar connection ID to sync. Omit to sync all.'),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ connection_id }) {
    const data = yield api('/calendars/sync', {
        method: 'POST',
        body: JSON.stringify({ connection_id }),
    });
    return {
        content: [{
                type: 'text',
                text: `✅ Synced ${data.synced_count} calendar(s). Last sync: ${new Date().toLocaleString()}`,
            }],
    };
}));
// ─── Tool: get_booking_analytics ──────────────────────────────────────────────
server.tool('get_booking_analytics', 'Get booking and revenue analytics for a given period.', {
    period: zod_1.z.enum(['today', 'week', 'month', 'year']).describe('Time period for analytics'),
    booking_type_id: zod_1.z.string().optional().describe('Filter by specific booking type'),
}, (_a) => __awaiter(void 0, [_a], void 0, function* ({ period, booking_type_id }) {
    var _b, _c;
    const params = new URLSearchParams(Object.assign({ period }, (booking_type_id ? { booking_type_id } : {})));
    const data = yield api(`/analytics?${params}`);
    return {
        content: [{
                type: 'text',
                text: [
                    `📊 Analytics for: ${period}`,
                    `Total bookings: ${data.total_bookings}`,
                    `Confirmed: ${data.confirmed}`,
                    `Cancelled: ${data.cancelled}`,
                    `No-shows: ${data.no_shows}`,
                    `Revenue: $${(((_b = data.total_revenue) !== null && _b !== void 0 ? _b : 0) / 100).toFixed(2)}`,
                    `Avg booking value: $${(((_c = data.avg_booking_value) !== null && _c !== void 0 ? _c : 0) / 100).toFixed(2)}`,
                ].join('\n'),
            }],
    };
}));
// ─── Start Server ─────────────────────────────────────────────────────────────
const transport = new stdio_js_1.StdioServerTransport();
await server.connect(transport);
console.error('K4Calender MCP server running on stdio');
