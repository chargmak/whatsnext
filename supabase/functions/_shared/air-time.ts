// When an episode actually airs, for the push jobs.
//
// TMDB gives date-only air dates in the network's own timezone. Announcing "out
// now" the moment that date matches UTC tells people an episode has dropped when
// it hasn't — up to a full day early for viewers east of UTC, and always early
// for a show that airs in the evening. So the date is joined to a release hour
// (the platform's, or the origin country's prime time) in that platform's zone
// to get a real instant to compare against.
//
// This mirrors src/services/releaseTime.js — the frontend copy is the canonical
// one. Edge functions are deployed on their own and can't import from src/, so
// the tables are repeated here; keep the two in sync.

// Country code → representative IANA zone.
export const COUNTRY_TIME_ZONES: Record<string, string> = {
    AE: 'Asia/Dubai', AR: 'America/Argentina/Buenos_Aires', AT: 'Europe/Vienna',
    AU: 'Australia/Sydney', BE: 'Europe/Brussels', BG: 'Europe/Sofia',
    BR: 'America/Sao_Paulo', CA: 'America/Toronto', CH: 'Europe/Zurich',
    CL: 'America/Santiago', CN: 'Asia/Shanghai', CO: 'America/Bogota',
    CZ: 'Europe/Prague', DE: 'Europe/Berlin', DK: 'Europe/Copenhagen',
    EE: 'Europe/Tallinn', EG: 'Africa/Cairo', ES: 'Europe/Madrid',
    FI: 'Europe/Helsinki', FR: 'Europe/Paris', GB: 'Europe/London',
    GR: 'Europe/Athens', HK: 'Asia/Hong_Kong', HR: 'Europe/Zagreb',
    HU: 'Europe/Budapest', ID: 'Asia/Jakarta', IE: 'Europe/Dublin',
    IL: 'Asia/Jerusalem', IN: 'Asia/Kolkata', IS: 'Atlantic/Reykjavik',
    IT: 'Europe/Rome', JP: 'Asia/Tokyo', KR: 'Asia/Seoul',
    LT: 'Europe/Vilnius', LU: 'Europe/Luxembourg', LV: 'Europe/Riga',
    MX: 'America/Mexico_City', MY: 'Asia/Kuala_Lumpur', NG: 'Africa/Lagos',
    NL: 'Europe/Amsterdam', NO: 'Europe/Oslo', NZ: 'Pacific/Auckland',
    PE: 'America/Lima', PH: 'Asia/Manila', PL: 'Europe/Warsaw',
    PT: 'Europe/Lisbon', RO: 'Europe/Bucharest', RS: 'Europe/Belgrade',
    RU: 'Europe/Moscow', SA: 'Asia/Riyadh', SE: 'Europe/Stockholm',
    SG: 'Asia/Singapore', SI: 'Europe/Ljubljana', SK: 'Europe/Bratislava',
    TH: 'Asia/Bangkok', TR: 'Europe/Istanbul', TW: 'Asia/Taipei',
    UA: 'Europe/Kyiv', US: 'America/New_York', VN: 'Asia/Ho_Chi_Minh',
    ZA: 'Africa/Johannesburg',
};

const PACIFIC = 'America/Los_Angeles';
const EASTERN = 'America/New_York';

interface NetworkRule {
    match: string[];
    zone: string;
    hour: number;
    minute: number;
    global?: boolean;
}

// Streamers publish at one global instant (midnight Pacific); linear channels air
// in their own prime time.
const NETWORK_RULES: NetworkRule[] = [
    { match: ['netflix'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['disney+', 'disney plus'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['prime video', 'amazon'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['apple tv+', 'apple tv plus'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['hulu'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['max', 'hbo max'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['paramount+', 'paramount plus'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['peacock'], zone: PACIFIC, hour: 0, minute: 0, global: true },

    { match: ['hbo'], zone: EASTERN, hour: 21, minute: 0 },
    { match: ['amc', 'fx', 'showtime', 'starz', 'usa network', 'tnt', 'syfy'], zone: EASTERN, hour: 22, minute: 0 },
    { match: ['abc', 'cbs', 'nbc', 'fox', 'the cw'], zone: EASTERN, hour: 20, minute: 0 },
    { match: ['adult swim'], zone: EASTERN, hour: 23, minute: 30 },
    { match: ['bbc one', 'bbc two', 'bbc three', 'bbc four', 'bbc', 'itv', 'channel 4', 'channel 5', 'sky'], zone: 'Europe/London', hour: 21, minute: 0 },

    { match: ['crunchyroll'], zone: 'Asia/Tokyo', hour: 23, minute: 0 },
];

const COUNTRY_PRIME_TIME: Record<string, { hour: number; minute: number }> = {
    AU: { hour: 19, minute: 30 }, BR: { hour: 21, minute: 0 }, DE: { hour: 20, minute: 15 },
    ES: { hour: 22, minute: 0 }, FR: { hour: 21, minute: 0 }, GB: { hour: 21, minute: 0 },
    GR: { hour: 21, minute: 0 }, IN: { hour: 20, minute: 30 }, IT: { hour: 21, minute: 0 },
    JP: { hour: 22, minute: 0 }, KR: { hour: 22, minute: 0 }, MX: { hour: 21, minute: 0 },
    TR: { hour: 20, minute: 0 }, US: { hour: 20, minute: 0 },
};
const DEFAULT_PRIME_TIME = { hour: 20, minute: 0 };

export interface ReleaseRule {
    zone: string;
    hour: number;
    minute: number;
    estimated: boolean;
    global: boolean;
}

// Zone offset in minutes at an instant, read back from a formatted wall clock so
// DST is handled without a date library.
const zoneOffsetMinutes = (zone: string, instant: Date): number => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUTC = Date.UTC(
        get('year'), get('month') - 1, get('day'),
        get('hour') % 24, get('minute'), get('second'),
    );
    return (asUTC - instant.getTime()) / 60000;
};

// A wall-clock time in `zone` → the instant it happens at. Guess with the naive
// value, then refine once now that we know roughly which offset applies.
const wallTimeToInstant = (
    { year, month, day, hour, minute }: { year: number; month: number; day: number; hour: number; minute: number },
    zone: string,
): Date => {
    const naive = Date.UTC(year, month - 1, day, hour, minute);
    let instant = naive - zoneOffsetMinutes(zone, new Date(naive)) * 60000;
    instant = naive - zoneOffsetMinutes(zone, new Date(instant)) * 60000;
    return new Date(instant);
};

const normalize = (name: string | undefined) => String(name ?? '').toLowerCase().trim();

// How a show's date-only air dates should be placed in time.
export const releaseRuleForShow = (
    networks: (string | undefined)[] = [],
    originCountry?: string | null,
): ReleaseRule => {
    for (const name of networks) {
        const needle = normalize(name);
        if (!needle) continue;
        const rule = NETWORK_RULES.find((r) => r.match.some((m) => needle === m || needle.includes(m)));
        if (rule) {
            return {
                zone: rule.zone, hour: rule.hour, minute: rule.minute,
                estimated: false, global: Boolean(rule.global),
            };
        }
    }
    const zone = (originCountry && COUNTRY_TIME_ZONES[originCountry]) || 'UTC';
    const prime = (originCountry && COUNTRY_PRIME_TIME[originCountry]) || DEFAULT_PRIME_TIME;
    return { zone, hour: prime.hour, minute: prime.minute, estimated: true, global: false };
};

// The instant a date-only air date becomes available under `rule`.
export const airInstant = (airDate: string | undefined, rule: ReleaseRule): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(airDate ?? ''));
    if (!match) return null;
    return wallTimeToInstant({
        year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
        hour: rule.hour, minute: rule.minute,
    }, rule.zone);
};

// The zone to phrase a notification in: the viewer's pinned setting, else their
// country. No device to ask out here, which is why signup sends the zone along.
export const zoneForUser = (timezone?: string | null, country?: string | null): string => {
    if (timezone) {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: timezone });
            return timezone;
        } catch {
            // fall through to the country
        }
    }
    return (country && COUNTRY_TIME_ZONES[country]) || 'UTC';
};

export const formatZonedTime = (instant: Date, zone: string): string =>
    new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' })
        .format(instant);

// 'YYYY-MM-DD' for an instant as seen in `zone`.
export const zonedDateKey = (instant: Date, zone: string): string =>
    new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(instant);

// Whole days from today to a date-only release, both counted in `zone`. Both
// sides are wall dates in the same zone, so plain calendar arithmetic is exact —
// and the answer can't be a day off for someone far from UTC.
export const daysUntilInZone = (releaseDate: string, zone: string, now: Date): number | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(releaseDate ?? '');
    if (!match) return null;
    const [ty, tm, td] = zonedDateKey(now, zone).split('-').map(Number);
    const release = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Math.round((release - Date.UTC(ty, tm - 1, td)) / 86400000);
};
