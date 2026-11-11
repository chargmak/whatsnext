import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useReleases, countdownText } from '../hooks/useReleases';
import { PRECISION, formatZonedDate, todayKey, zoneAbbreviation } from '../services/releaseTime';
import '../styles/calendar.css';

const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// The grid's cells are plain calendar arithmetic, so a cell's key is just its
// own y-m-d. Entries carry the day they land on *in the viewer's zone*, which
// is what makes a 21:00 Sunday US episode show up on Monday in Athens.
const toDateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// The hour a release lands, then how far off it is (or that it already happened).
const timeLine = (item) => {
    const time = item.air.timeLabel
        ? `${item.air.precision === PRECISION.ESTIMATED ? '~' : ''}${item.air.timeLabel} ${item.air.zoneLabel}`
        : 'Time not announced';
    const tail = item.air.hasAired
        ? (item.isEpisode ? 'aired' : 'released')
        : countdownText(item.air);
    return tail ? `${time} · ${tail}` : time;
};

// Where the time comes from, so an odd-looking hour makes sense.
const sourceLine = (item) => {
    if (!item.air.sourceLabel && !item.releaseKind) return '';
    if (item.isEpisode) {
        return item.air.global
            ? `${item.air.sourceLabel} — worldwide drop`
            : `${item.air.sourceLabel} — ${item.air.sourceDate} local broadcast`;
    }
    return `${item.releaseKind || 'Release'}${item.releaseCountry ? ` (${item.releaseCountry} date)` : ''}`;
};

const ReleaseRow = ({ item }) => {
    const source = sourceLine(item);
    const title = item.isEpisode
        ? `${item.showTitle} · S${item.seasonNumber}E${item.episodeNumber}`
        : item.title;
    // Movies have no episode name, so their second line is the kind of release.
    const movieSub = [source, item.year].filter(Boolean).join(' · ');
    const genres = item.isEpisode ? [] : (item.genres || []).slice(0, 3);

    return (
        <Link
            to={`/${item.type}/${item.id}`}
            className={`cal-release${item.air.hasAired ? ' is-aired' : ''}`}
        >
            <img className="cal-poster" src={item.poster} alt="" />
            <span className="cal-release-body">
                <span className="cal-release-title truncate">{title}</span>
                {item.isEpisode
                    ? item.episodeTitle && (
                        <span className="cal-release-sub is-episode truncate">{item.episodeTitle}</span>
                    )
                    : movieSub && <span className="cal-release-sub truncate">{movieSub}</span>}
                {/* The day is in the header; this is the hour */}
                <span className="cal-release-time">{timeLine(item)}</span>
                {item.isEpisode && source && (
                    <span className="cal-release-source">{source}</span>
                )}
                {genres.length > 0 && (
                    <span className="cal-release-genres">
                        {genres.map((genre) => (
                            <span key={genre} className="cal-genre">{genre}</span>
                        ))}
                    </span>
                )}
            </span>
            <span className="badge">{item.type === 'tv' ? 'TV' : 'Movie'}</span>
        </Link>
    );
};

const Calendar = () => {
    const { timeZone } = useUser();
    const [currentDate, setCurrentDate] = useState(new Date());
    // The day picked in the grid (y-m-d), whose releases are listed under it.
    const [selectedKey, setSelectedKey] = useState(null);
    // Every dated release in range, aired or not; the list below shows only the
    // ones still to come.
    const { releases, loading } = useReleases();

    const upcomingReleases = releases.filter((r) => !r.air.hasAired);
    // True when at least one time on screen is a prime-time guess rather than a
    // known platform drop, which the footnote then explains.
    const hasEstimates = releases.some((r) => r.air.precision === PRECISION.ESTIMATED);

    // Get calendar data
    const getCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];

        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        // Add actual days
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(new Date(year, month, day));
        }

        return days;
    };

    const releasesByDay = {};
    releases.forEach((release) => {
        (releasesByDay[release.air.dateKey] ||= []).push(release);
    });

    const changeMonth = (offset) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
        setSelectedKey(null);
    };

    // "Today" belongs to the viewer's zone, not the device's, so a pinned zone
    // highlights the right cell.
    const today = todayKey(timeZone);

    const calendarDays = getCalendarDays();
    const zoneLabel = zoneAbbreviation(new Date(), timeZone);
    const selectedReleases = (selectedKey && releasesByDay[selectedKey]) || [];

    // Group by the day each release lands on where the viewer is. The list is
    // already sorted soonest first, so the groups come out in order.
    const groups = [];
    upcomingReleases.forEach((item) => {
        const last = groups[groups.length - 1];
        if (last && last.key === item.air.dateKey) last.items.push(item);
        else groups.push({ key: item.air.dateKey, items: [item] });
    });

    const dateHeading = (item) => {
        const label = formatZonedDate(item.air.instant, timeZone);
        return item.air.dateKey === today ? `Today · ${label}` : label;
    };

    return (
        <div className="container page cal-page">
            <header>
                <h1 className="page-title">Calendar</h1>
                {/* Which clock everything on this page is in */}
                <p className="page-sub cal-zone">
                    <Clock size={14} aria-hidden="true" />
                    Times shown for {timeZone.replace(/_/g, ' ')}{zoneLabel ? ` (${zoneLabel})` : ''}
                </p>
            </header>

            <section className="tile cal-month" aria-label="Month">
                <div className="cal-month-nav">
                    <button
                        type="button"
                        className="icon-btn"
                        onClick={() => changeMonth(-1)}
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={18} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                    <h2 className="cal-month-name" aria-live="polite">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                    <button
                        type="button"
                        className="icon-btn"
                        onClick={() => changeMonth(1)}
                        aria-label="Next month"
                    >
                        <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                </div>

                <div className="cal-weekdays" aria-hidden="true">
                    {dayNames.map((day) => <span key={day}>{day}</span>)}
                </div>

                <div className="cal-grid">
                    {calendarDays.map((date, index) => {
                        if (!date) return <span key={index} />;

                        const key = toDateKey(date);
                        const count = releasesByDay[key]?.length || 0;
                        const selected = key === selectedKey;
                        const className = [
                            'cal-day',
                            key === today && 'is-today',
                            key < today && 'is-past',
                            count > 0 && 'has-releases',
                            selected && 'is-selected',
                        ].filter(Boolean).join(' ');
                        const content = (
                            <>
                                <span className="cal-day-num">{date.getDate()}</span>
                                <span className="cal-day-dot" />
                                {/* Wide screens have room to name what's on */}
                                {count > 0 && (
                                    <span className="cal-day-chips" aria-hidden="true">
                                        {releasesByDay[key].slice(0, 2).map((r, i) => (
                                            <span key={i} className={`cal-chip ${r.type === 'movie' ? 'is-movie' : ''}`}>
                                                {r.isEpisode ? `${r.showTitle} E${r.episodeNumber}` : r.title}
                                            </span>
                                        ))}
                                        {count > 2 && <span className="cal-chip-more">+{count - 2} more</span>}
                                    </span>
                                )}
                            </>
                        );

                        // Only a day with something on it is worth tapping.
                        return count > 0 ? (
                            <button
                                key={index}
                                type="button"
                                className={className}
                                aria-pressed={selected}
                                aria-label={`${date.getDate()} ${monthNames[date.getMonth()]}${key === today ? ', today' : ''}, ${count} release${count === 1 ? '' : 's'}`}
                                onClick={() => setSelectedKey(selected ? null : key)}
                            >
                                {content}
                            </button>
                        ) : (
                            <div
                                key={index}
                                className={className}
                                aria-current={key === today ? 'date' : undefined}
                            >
                                {content}
                            </div>
                        );
                    })}
                </div>
            </section>

            <div className="cal-rail">
            {/* The picked day, aired entries included */}
            {selectedReleases.length > 0 && (
                <section className="cal-group" aria-live="polite">
                    <h2 className={`cal-date${selectedKey === today ? ' is-today' : ''}`}>
                        {dateHeading(selectedReleases[0])}
                    </h2>
                    {selectedReleases.map((item, idx) => (
                        <ReleaseRow key={`${item.type}-${item.id}-${idx}`} item={item} />
                    ))}
                </section>
            )}

            <section>
                <h2 className="section-title">Upcoming releases</h2>

                {loading ? (
                    <div className="cal-loading" role="status">
                        <div className="spinner" aria-hidden="true" />
                        Loading upcoming releases...
                    </div>
                ) : upcomingReleases.length === 0 ? (
                    <div className="empty-state cal-empty">
                        <CalendarIcon size={40} aria-hidden="true" />
                        <p>No upcoming releases in your watchlist</p>
                        <p>Add movies and TV shows to your list to track their releases</p>
                    </div>
                ) : (
                    <div className="cal-groups">
                        {groups.map((group) => (
                            <div key={group.key} className="cal-group">
                                <h3 className={`cal-date${group.key === today ? ' is-today' : ''}`}>
                                    {dateHeading(group.items[0])}
                                </h3>
                                {group.items.map((item, idx) => (
                                    <ReleaseRow key={`${item.type}-${item.id}-${idx}`} item={item} />
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* Say which times are guesses rather than letting them read as fact */}
                {!loading && hasEstimates && (
                    <p className="cal-footnote">
                        Times marked ~ are estimated from the channel's usual prime-time slot —
                        the streaming services publish a fixed drop time, local broadcasters don't.
                    </p>
                )}
            </section>
            </div>
        </div>
    );
};

export default Calendar;
