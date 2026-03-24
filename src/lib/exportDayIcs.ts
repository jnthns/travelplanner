import { addDays, format, parseISO } from 'date-fns';
import type { Activity } from './types';
import { compareActivitiesByTimeThenOrder } from './itinerary';

function escapeIcsText(s: string): string {
    return s
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

function foldIcsLine(line: string): string {
    const max = 73;
    if (line.length <= max) return line;
    let rest = line;
    let out = '';
    while (rest.length > max) {
        out += `${rest.slice(0, max)}\r\n `;
        rest = rest.slice(max);
    }
    return out + rest;
}

function formatUtcStamp(d: Date): string {
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
}

function formatFloatingLocal(d: Date): string {
    return format(d, "yyyyMMdd'T'HHmmss");
}

interface Range {
    start: Date;
    end: Date;
    allDay: boolean;
}

function rangeForActivity(dateStr: string, timeStr: string | undefined): Range | null {
    if (!timeStr?.trim()) {
        const start = new Date(`${dateStr}T00:00:00`);
        if (Number.isNaN(start.getTime())) return null;
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { start, end, allDay: true };
    }
    const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) {
        const start = new Date(`${dateStr}T12:00:00`);
        if (Number.isNaN(start.getTime())) return null;
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        return { start, end, allDay: false };
    }
    const h = Number.parseInt(m[1], 10);
    const min = Number.parseInt(m[2], 10);
    const start = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end, allDay: false };
}

/**
 * Build an iCalendar (.ics) document for one day’s activities.
 */
export function buildIcsForDay(params: { tripName: string; dateStr: string; activities: Activity[] }): string {
    const { tripName, dateStr } = params;
    const activities = [...params.activities].sort(compareActivitiesByTimeThenOrder);
    const calName = `${tripName} — ${dateStr}`.replace(/\r|\n/g, ' ');

    const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//TravelPlanner//EN',
        'CALSCALE:GREGORIAN',
        foldIcsLine(`X-WR-CALNAME:${escapeIcsText(calName)}`),
    ];

    const stamp = formatUtcStamp(new Date());

    for (const act of activities) {
        const range = rangeForActivity(act.date, act.time);
        if (!range) continue;

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${act.id}@travelplanner.local`);
        lines.push(`DTSTAMP:${stamp}`);

        if (range.allDay) {
            const ds = act.date.replace(/-/g, '');
            const endDs = format(addDays(parseISO(act.date), 1), 'yyyyMMdd');
            lines.push(`DTSTART;VALUE=DATE:${ds}`);
            lines.push(`DTEND;VALUE=DATE:${endDs}`);
        } else {
            lines.push(`DTSTART:${formatFloatingLocal(range.start)}`);
            lines.push(`DTEND:${formatFloatingLocal(range.end)}`);
        }

        lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(act.title)}`));
        if (act.location) {
            lines.push(foldIcsLine(`LOCATION:${escapeIcsText(act.location)}`));
        }
        const desc = [act.details, act.notes].filter(Boolean).join('\n\n').slice(0, 4000);
        if (desc) {
            lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(desc)}`));
        }
        lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return `${lines.join('\r\n')}\r\n`;
}

export function downloadIcsFile(filename: string, content: string): void {
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
    a.click();
    URL.revokeObjectURL(url);
}
