// When something actually becomes watchable, and what that is in the viewer's
// own clock.
//
// TMDB only gives date-only strings: an episode's `air_date` is the calendar day
// it airs *in its own network's timezone*, with no hour attached. Comparing that
// string with `new Date(...)` parses it as UTC midnight, which is wrong twice
// over:
//
//   • UTC midnight isn't when the episode airs. A show dated 2026-08-02 that
//     goes out at 21:00 New York time is treated as available 21 hours early,
//     so the app announces a release that hasn't happened.
//   • UTC midnight isn't the viewer's midnight. East of UTC that same date flips
//     over hours before the day even starts in the show's country; west of UTC
//     today's releases read as still-in-the-future.
//
// So this module reconstructs a real instant: the air date is joined to a
// release *hour* (from the platform the show runs on, or the origin country's
// prime time) interpreted in that platform's timezone, then rendered in the
// viewer's zone. Every returned value carries a `precision` so the UI can be
// honest about which times are known and which are estimates.
//
// Keep in sync with supabase/functions/_shared/air-time.ts, which repeats the
// tables below for the push-notification jobs (edge functions are deployed on
// their own and can't import from src/).

// --- Time zones -------------------------------------------------------------

// Country code → representative IANA zone. Big countries span several zones, so
// these are the "most viewers live here" pick: they're a fallback for when we
// don't have the viewer's device zone, and they're what we use to place a
// broadcaster in time. The list covers the countries the profile form offers
// plus the origin countries TMDB commonly reports.
export const COUNTRY_TIME_ZONES = {
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

const UTC = 'UTC';

// --- Formatter cache --------------------------------------------------------

// Building an Intl.DateTimeFormat is expensive — it resolves a locale and loads
// timezone data, and it measures ~150µs on a desktop, several times that on a
// phone. Formatters are immutable and reusable, but the functions below are
// called per title and per episode, so constructing one each time turns a screen
// full of dates into hundreds of milliseconds of blocked main thread. Keyed on
// the arguments, so callers just ask for the formatter they want.
const formatterCache = new Map();

const formatter = (locale, options) => {
    const key = `${locale}|${JSON.stringify(options)}`;
    let cached = formatterCache.get(key);
    if (!cached) {
        cached = new Intl.DateTimeFormat(locale, options);
        formatterCache.set(key, cached);
    }
    return cached;
};

// The zone the device is set to — the most accurate read on where the viewer
// actually is, since it follows them when they travel.
export const deviceTimeZone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || UTC;
    } catch {
        return UTC;
    }
};

// Whether a value can actually be handed to Intl as a `timeZone`. Exported
// because every zone that reaches this module comes from somewhere loose — a
// profile field, a device setting, a function argument — and an unusable one
// makes Intl throw rather than degrade.
// Memoized: this is asked once per title mapped, and the answer for a given
// string never changes within a session.
const zoneValidity = new Map();

export const isValidZone = (zone) => {
    if (typeof zone !== 'string' || !zone) return false;
    let known = zoneValidity.get(zone);
    if (known === undefined) {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: zone });
            known = true;
        } catch {
            known = false;
        }
        zoneValidity.set(zone, known);
    }
    return known;
};

// The zone to show release times in. An explicit profile setting wins (a viewer
// who travels or whose device is wrong can pin it), then the device zone, then
// the country they signed up with, then UTC.
export const resolveViewerZone = (user) => {
    if (isValidZone(user?.timezone)) return user.timezone;
    const device = deviceTimeZone();
    if (isValidZone(device)) return device;
    const fromCountry = COUNTRY_TIME_ZONES[user?.country];
    return isValidZone(fromCountry) ? fromCountry : UTC;
};

// Zone offset in minutes at a given instant (positive east of UTC). Derived by
// formatting the instant in that zone and reading the wall clock back — the
// standard no-dependency trick, and it picks up DST automatically.
const zoneOffsetMinutes = (zone, instant) => {
    const parts = formatter('en-US', {
        timeZone: zone,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant);

    const get = (type) => Number(parts.find((p) => p.type === type)?.value);
    // Some engines render midnight as hour 24 under hour12:false.
    const asUTC = Date.UTC(
        get('year'), get('month') - 1, get('day'),
        get('hour') % 24, get('minute'), get('second'),
    );
    return (asUTC - instant.getTime()) / 60000;
};

// A wall-clock time in `zone` → the UTC instant it happens at. The offset
// depends on the instant we're solving for, so guess with the naive value and
// refine once; that settles every case except times inside a DST spring-forward
// gap, where the result lands just after the jump (which is when a release in
// that hour actually becomes available anyway).
const wallTimeToInstant = ({ year, month, day, hour = 0, minute = 0 }, zone) => {
    const naive = Date.UTC(year, month - 1, day, hour, minute);
    let instant = naive - zoneOffsetMinutes(zone, new Date(naive)) * 60000;
    instant = naive - zoneOffsetMinutes(zone, new Date(instant)) * 60000;
    return new Date(instant);
};

// 'YYYY-MM-DD' → parts, ignoring any time TMDB may have appended.
const parseDateOnly = (dateStr) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

// --- Release rules ----------------------------------------------------------

// How precise a resolved time is, worst to best. 'day' means we know the date
// but nothing about the hour; 'estimated' is an origin-country prime-time guess;
// 'network' comes from a known platform's release pattern; 'exact' is a real
// timestamp TMDB gave us.
export const PRECISION = { DAY: 'day', ESTIMATED: 'estimated', NETWORK: 'network', EXACT: 'exact' };

const PACIFIC = 'America/Los_Angeles';
const EASTERN = 'America/New_York';

// Platform → when it drops. The big streamers publish at one global instant, so
// a single zone+hour describes them for every viewer on earth: midnight Pacific
// (03:00 Eastern) is the near-universal convention. Linear channels air in their
// own prime time instead, which is why HBO's Sunday 21:00 ET differs from Max's
// catalogue drop.
const NETWORK_RULES = [
    // US streamers — simultaneous worldwide at 00:00 Pacific.
    { match: ['netflix'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['disney+', 'disney plus'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['prime video', 'amazon'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['apple tv+', 'apple tv plus'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['hulu'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['max', 'hbo max'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['paramount+', 'paramount plus'], zone: PACIFIC, hour: 0, minute: 0, global: true },
    { match: ['peacock'], zone: PACIFIC, hour: 0, minute: 0, global: true },

    // Linear channels — prime time in their own zone.
    { match: ['hbo'], zone: EASTERN, hour: 21, minute: 0 },
    { match: ['amc', 'fx', 'showtime', 'starz', 'usa network', 'tnt', 'syfy'], zone: EASTERN, hour: 22, minute: 0 },
    { match: ['abc', 'cbs', 'nbc', 'fox', 'the cw'], zone: EASTERN, hour: 20, minute: 0 },
    { match: ['adult swim'], zone: EASTERN, hour: 23, minute: 30 },
    { match: ['bbc one', 'bbc two', 'bbc three', 'bbc four', 'bbc', 'itv', 'channel 4', 'channel 5', 'sky'], zone: 'Europe/London', hour: 21, minute: 0 },

    // Anime simulcasts follow the Japanese late-night broadcast.
    { match: ['crunchyroll'], zone: 'Asia/Tokyo', hour: 23, minute: 0 },
];

// Prime-time start per country, for shows whose network we don't recognise.
// Rough by nature — resolved times built from these are flagged 'estimated'.
const COUNTRY_PRIME_TIME = {
    AU: { hour: 19, minute: 30 }, BR: { hour: 21, minute: 0 }, DE: { hour: 20, minute: 15 },
    ES: { hour: 22, minute: 0 }, FR: { hour: 21, minute: 0 }, GB: { hour: 21, minute: 0 },
    GR: { hour: 21, minute: 0 }, IN: { hour: 20, minute: 30 }, IT: { hour: 21, minute: 0 },
    JP: { hour: 22, minute: 0 }, KR: { hour: 22, minute: 0 }, MX: { hour: 21, minute: 0 },
    TR: { hour: 20, minute: 0 }, US: { hour: 20, minute: 0 },
};
const DEFAULT_PRIME_TIME = { hour: 20, minute: 0 };

const normalize = (name) => String(name || '').toLowerCase().trim();

const matchNetwork = (names) => {
    for (const name of names) {
        const needle = normalize(name);
        if (!needle) continue;
        const rule = NETWORK_RULES.find((r) => r.match.some((m) => needle === m || needle.includes(m)));
        if (rule) return { rule, name };
    }
    return null;
};

// Work out when a series releases, from a TMDB /tv/{id} payload. Returns the
// zone + hour to place its air dates at, how much to trust that, and a label for
// the UI ("Netflix", "HBO", "prime time in Japan").
export const getShowReleaseRule = (details) => {
    const networks = (details?.networks || []).map((n) => n?.name).filter(Boolean);
    const originCountry = details?.origin_country?.[0] || details?.production_countries?.[0]?.iso_3166_1 || null;

    const matched = matchNetwork(networks);
    if (matched) {
        return {
            zone: matched.rule.zone,
            hour: matched.rule.hour,
            minute: matched.rule.minute,
            precision: PRECISION.NETWORK,
            global: Boolean(matched.rule.global),
            source: matched.name,
        };
    }

    const zone = COUNTRY_TIME_ZONES[originCountry] || UTC;
    const prime = COUNTRY_PRIME_TIME[originCountry] || DEFAULT_PRIME_TIME;
    return {
        zone,
        hour: prime.hour,
        minute: prime.minute,
        precision: PRECISION.ESTIMATED,
        global: false,
        source: networks[0] || null,
    };
};

// A rule for titles we know nothing else about: treat the date as starting at
// midnight in the viewer's own zone, and don't pretend to know the hour.
export const viewerDayRule = (viewerZone) => ({
    zone: viewerZone,
    hour: 0,
    minute: 0,
    precision: PRECISION.DAY,
    global: false,
    source: null,
});

// A rule for a movie's country-specific release (from
// getMovieReleaseForCountry). The date TMDB reports belongs to that country's
// clock, so it's placed there; an hour is only claimed when TMDB actually gave
// one, which is rare outside digital drops.
export const movieReleaseRule = (release, viewerZone) => {
    if (!release) return viewerDayRule(viewerZone);
    const zone = COUNTRY_TIME_ZONES[release.country] || viewerZone;
    const knowsHour = release.hour != null;
    return {
        zone,
        hour: knowsHour ? release.hour : 0,
        minute: knowsHour ? (release.minute || 0) : 0,
        precision: knowsHour ? PRECISION.EXACT : PRECISION.DAY,
        global: false,
        source: release.typeLabel || null,
    };
};

// --- Resolving and formatting ----------------------------------------------

// The instant a date-only release becomes available under `rule`.
export const releaseInstant = (dateStr, rule) => {
    const parts = parseDateOnly(dateStr);
    if (!parts || !rule) return null;
    return wallTimeToInstant({ ...parts, hour: rule.hour, minute: rule.minute }, rule.zone);
};

// 'YYYY-MM-DD' for an instant as seen in `zone` — the key the calendar groups
// on, so a 21:00 Sunday US episode lands on Monday for a viewer in Athens,
// which is when they can actually watch it.
export const zonedDateKey = (instant, zone) => {
    const parts = formatter('en-CA', {
        timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(instant);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
};

// Midnight in `zone` on the given date key — the start of that day for the viewer.
export const startOfZonedDay = (dateStr, zone) => {
    const parts = parseDateOnly(dateStr);
    return parts ? wallTimeToInstant(parts, zone) : null;
};

// Today's date key in the viewer's zone.
export const todayKey = (zone, now = new Date()) => zonedDateKey(now, zone);

export const formatZonedTime = (instant, zone) =>
    formatter(undefined, { timeZone: zone, hour: 'numeric', minute: '2-digit' })
        .format(instant);

export const formatZonedDate = (instant, zone, options) =>
    formatter(undefined, {
        timeZone: zone, weekday: 'short', month: 'short', day: 'numeric', ...options,
    }).format(instant);

// "EEST", "GMT+3" — whatever the platform calls the zone at that moment.
export const zoneAbbreviation = (instant, zone) => {
    const parts = formatter('en-US', { timeZone: zone, timeZoneName: 'short' })
        .formatToParts(instant);
    return parts.find((p) => p.type === 'timeZoneName')?.value || '';
};

// Days/hours/minutes from now until `instant` (all zero once it has passed).
export const countdownTo = (instant, now = new Date()) => {
    const diff = instant.getTime() - now.getTime();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, passed: true, totalMs: 0 };
    return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff / 3600000) % 24),
        minutes: Math.floor((diff / 60000) % 60),
        passed: false,
        totalMs: diff,
    };
};

// The full picture for one dated release, ready to render.
//
//   dateStr    TMDB's date-only value ('2026-08-02')
//   rule       from getShowReleaseRule / viewerDayRule
//   viewerZone where the person watching is
//
// Returns null when there's no usable date. `hasAired` is the answer to the
// question this module exists for: is it *actually* out yet?
export const resolveReleaseTime = ({ dateStr, rule, viewerZone, now = new Date() }) => {
    const instant = releaseInstant(dateStr, rule);
    if (!instant) return null;

    const knowsHour = rule.precision !== PRECISION.DAY;
    return {
        instant,
        sourceDate: dateStr,
        sourceZone: rule.zone,
        sourceLabel: rule.source || null,
        precision: rule.precision,
        knowsHour,
        // Simultaneous global drops are the same moment everywhere, so there's
        // no "local broadcast" caveat to explain for them.
        global: Boolean(rule.global),
        hasAired: instant.getTime() <= now.getTime(),
        dateKey: zonedDateKey(instant, viewerZone),
        dayLabel: formatZonedDate(instant, viewerZone),
        timeLabel: knowsHour ? formatZonedTime(instant, viewerZone) : null,
        zoneLabel: zoneAbbreviation(instant, viewerZone),
        viewerZone,
        countdown: countdownTo(instant, now),
    };
};

// One-line "when is it out" for a resolved release: "Airs today at 9:00 PM",
// "Aired Sun, Aug 2 · 10:00 PM", "Releases Aug 14". `verb` picks the wording
// for episodes ('air') vs titles ('release').
export const describeRelease = (resolved, { verb = 'air', zone, now = new Date() } = {}) => {
    if (!resolved) return '';
    const viewerZone = zone || resolved.viewerZone;
    const past = resolved.hasAired;
    const time = resolved.timeLabel ? ` at ${resolved.timeLabel}` : '';
    const isToday = resolved.dateKey === todayKey(viewerZone, now);
    const verbPast = verb === 'air' ? 'Aired' : 'Released';
    const verbFuture = verb === 'air' ? 'Airs' : 'Releases';

    if (past) {
        return isToday ? `${verbPast} today${time}` : `${verbPast} ${resolved.dayLabel}${time}`;
    }
    if (isToday) return `${verbFuture} today${time}`;

    const tomorrow = zonedDateKey(new Date(now.getTime() + 86400000), viewerZone);
    if (resolved.dateKey === tomorrow) return `${verbFuture} tomorrow${time}`;
    return `${verbFuture} ${resolved.dayLabel}${time}`;
};

// Zones to offer in the profile picker: everything the platform knows about,
// falling back to the countries we have mappings for.
export const timeZoneOptions = () => {
    try {
        const all = Intl.supportedValuesOf?.('timeZone');
        if (all?.length) return all;
    } catch {
        // older browsers — fall through
    }
    return Array.from(new Set(Object.values(COUNTRY_TIME_ZONES))).sort();
};
