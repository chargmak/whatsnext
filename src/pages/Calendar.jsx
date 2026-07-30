import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Film, Tv } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { getTVShowWithEpisodes, getTVSeasonDetails, getMovieReleaseForCountry } from '../services/tmdb';
import {
    PRECISION,
    describeRelease,
    formatZonedDate,
    getShowReleaseRule,
    movieReleaseRule,
    resolveReleaseTime,
    todayKey,
    viewerDayRule,
    zoneAbbreviation,
} from '../services/releaseTime';
import { motion } from 'framer-motion';

// How far back the grid keeps already-aired entries, so browsing the current or
// previous month shows what has happened rather than an empty page.
const PAST_WINDOW_DAYS = 60;

// The gap until a release, at whatever granularity still says something useful.
const countdownLabel = (air) => {
    const { days, hours, minutes, passed } = air.countdown;
    if (passed) return '';
    if (days > 0) return `· in ${days} day${days === 1 ? '' : 's'}`;
    if (hours > 0) return `· in ${hours}h ${minutes}m`;
    return `· in ${minutes}m`;
};

const Calendar = () => {
    const navigate = useNavigate();
    const { watchlist, user, timeZone } = useUser();
    const country = user?.country || 'US';
    const [currentDate, setCurrentDate] = useState(new Date());
    // Every dated release in range, aired or not; the list below shows only the
    // ones still to come.
    const [releases, setReleases] = useState([]);
    const [loading, setLoading] = useState(true);

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

    // The grid's cells are plain calendar arithmetic, so a cell's key is just its
    // own y-m-d. Entries carry the day they land on *in the viewer's zone*, which
    // is what makes a 21:00 Sunday US episode show up on Monday in Athens.
    const toDateKey = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const getReleasesForDate = (date) => {
        if (!date) return [];
        const dateStr = toDateKey(date);
        return releases.filter((release) => release.air.dateKey === dateStr);
    };

    // Resolve every dated release in the watchlist to a real moment, in the
    // viewer's own clock.
    useEffect(() => {
        let active = true;

        const load = async () => {
            setLoading(true);
            const now = new Date();
            const earliest = now.getTime() - PAST_WINDOW_DAYS * 86400000;

            const processTvItem = async (item) => {
                const out = [];
                try {
                    const tvDetails = await getTVShowWithEpisodes(item.id);
                    if (!tvDetails?.seasons) return out;

                    // When the show goes out — Netflix's global midnight Pacific,
                    // HBO's 21:00 Eastern, a local broadcaster's prime time.
                    const rule = tvDetails.releaseRule || getShowReleaseRule(tvDetails);

                    // Only the latest 2 real seasons to keep request volume sane
                    const relevantSeasons = [...tvDetails.seasons]
                        .sort((a, b) => b.season_number - a.season_number)
                        .filter(s => s.season_number !== 0 && s.episode_count)
                        .slice(0, 2);

                    const seasonResults = await Promise.all(
                        relevantSeasons.map(season =>
                            getTVSeasonDetails(item.id, season.season_number).catch((error) => {
                                console.error(`Error fetching season ${season.season_number}:`, error);
                                return null;
                            })
                        )
                    );

                    for (const seasonData of seasonResults) {
                        for (const episode of seasonData?.episodes || []) {
                            const air = resolveReleaseTime({
                                dateStr: episode.air_date, rule, viewerZone: timeZone, now,
                            });
                            if (!air || air.instant.getTime() < earliest) continue;
                            out.push({
                                ...item,
                                title: `${item.title} - S${episode.season_number}E${episode.episode_number}`,
                                showTitle: item.title,
                                episodeTitle: episode.name,
                                releaseDate: episode.air_date,
                                air,
                                isEpisode: true,
                                seasonNumber: episode.season_number,
                                episodeNumber: episode.episode_number
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error fetching TV details:', error);
                }
                return out;
            };

            const processMovieItem = async (item) => {
                if (!item.releaseDate) return [];
                // Opening dates differ by country, so ask for the viewer's before
                // counting down to the global one.
                let release = null;
                try {
                    release = await getMovieReleaseForCountry(item.id, country);
                } catch (error) {
                    console.error('Error fetching movie release dates:', error);
                }
                const dateStr = release?.date || item.releaseDate;
                const rule = release ? movieReleaseRule(release, timeZone) : viewerDayRule(timeZone);
                const air = resolveReleaseTime({ dateStr, rule, viewerZone: timeZone, now });
                if (!air || air.instant.getTime() < earliest) return [];
                return [{
                    ...item,
                    releaseDate: dateStr,
                    air,
                    releaseKind: release?.typeLabel || null,
                    releaseCountry: release?.isFallback ? release.country : null,
                    isUpcoming: !air.hasAired,
                }];
            };

            const results = await Promise.all(watchlist.map((item) => {
                if (item.type === 'tv') return processTvItem(item);
                if (item.type === 'movie') return processMovieItem(item);
                return [];
            }));

            if (!active) return;
            const all = results.flat();
            all.sort((a, b) => a.air.instant - b.air.instant);
            setReleases(all);
            setLoading(false);
        };

        load();
        return () => { active = false; };
    }, [watchlist, timeZone, country]);

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const previousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    // "Today" belongs to the viewer's zone, not the device's, so a pinned zone
    // highlights the right cell.
    const today = todayKey(timeZone);
    const isToday = (date) => Boolean(date) && toDateKey(date) === today;

    const calendarDays = getCalendarDays();
    const zoneLabel = zoneAbbreviation(new Date(), timeZone);

    return (
        <div className="container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <header className="page-header">
                <h1 className="brand-title">
                    <CalendarIcon size={28} style={{ marginRight: '8px' }} />
                    Release Calendar
                </h1>
            </header>

            {/* Which clock everything on this page is in */}
            <p style={{
                margin: '-8px 0 20px 0',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                <Clock size={14} />
                Times shown for {timeZone.replace(/_/g, ' ')}{zoneLabel ? ` (${zoneLabel})` : ''}
            </p>

            {/* Month Navigation */}
            <div className="flex-between" style={{ marginBottom: '24px' }}>
                <button
                    onClick={previousMonth}
                    className="action-btn secondary"
                    style={{ width: 'auto', padding: '12px 16px', height: 'auto' }}
                >
                    <ChevronLeft size={20} />
                </button>

                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>

                <button
                    onClick={nextMonth}
                    className="action-btn secondary"
                    style={{ width: 'auto', padding: '12px 16px', height: 'auto' }}
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Calendar Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '8px',
                marginBottom: '30px'
            }}>
                {/* Day headers */}
                {dayNames.map(day => (
                    <div
                        key={day}
                        style={{
                            textAlign: 'center',
                            fontWeight: '600',
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            padding: '8px 0',
                            borderBottom: '1px solid rgba(255,255,255,0.1)'
                        }}
                    >
                        {day}
                    </div>
                ))}

                {/* Calendar days */}
                {calendarDays.map((date, index) => {
                    const dayReleases = getReleasesForDate(date);
                    const hasReleases = dayReleases.length > 0;

                    return (
                        <motion.div
                            key={index}
                            whileHover={hasReleases ? { scale: 1.05 } : {}}
                            className="glass-panel"
                            style={{
                                minHeight: '120px',
                                padding: '8px',
                                borderRadius: 'var(--radius-md)',
                                position: 'relative',
                                cursor: hasReleases ? 'pointer' : 'default',
                                border: isToday(date)
                                    ? '2px solid var(--brand-600)'
                                    : hasReleases
                                        ? '1px solid var(--accent-primary)'
                                        : '1px solid rgba(255,255,255,0.05)',
                                background: !date
                                    ? 'transparent'
                                    : isToday(date)
                                        ? 'rgba(220, 38, 38, 0.1)'
                                        : hasReleases
                                            ? 'rgba(255, 215, 0, 0.05)'
                                            : 'rgba(255,255,255,0.02)',
                                opacity: !date ? 0 : 1
                            }}
                        >
                            {date && (
                                <>
                                    <div style={{
                                        fontSize: '0.9rem',
                                        fontWeight: isToday(date) ? '700' : '500',
                                        color: isToday(date) ? 'var(--brand-600)' : 'var(--text-primary)',
                                        marginBottom: '4px'
                                    }}>
                                        {date.getDate()}
                                    </div>

                                    {hasReleases && (
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '4px',
                                            marginTop: '4px'
                                        }}>
                                            {dayReleases.slice(0, 4).map((release, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/${release.type}/${release.id}`);
                                                    }}
                                                    style={{
                                                        position: 'relative',
                                                        width: dayReleases.length === 1 ? '100%' : 'calc(50% - 2px)',
                                                        aspectRatio: '2/3',
                                                        borderRadius: '4px',
                                                        overflow: 'hidden',
                                                        cursor: 'pointer',
                                                        border: '1px solid rgba(255,255,255,0.1)'
                                                    }}
                                                    title={`${release.title} — ${describeRelease(release.air, {
                                                        verb: release.isEpisode ? 'air' : 'release',
                                                        zone: timeZone,
                                                    })}`}
                                                >
                                                    <img
                                                        src={release.poster}
                                                        alt={release.title}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover',
                                                            // Already out — the grid shouldn't make a past
                                                            // episode look like something still to come.
                                                            filter: release.air.hasAired ? 'grayscale(0.7)' : 'none',
                                                            opacity: release.air.hasAired ? 0.55 : 1
                                                        }}
                                                    />
                                                    {release.air.timeLabel && !release.air.hasAired && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            bottom: 0,
                                                            left: 0,
                                                            right: 0,
                                                            background: 'rgba(0,0,0,0.72)',
                                                            color: 'white',
                                                            fontSize: '0.55rem',
                                                            fontWeight: 600,
                                                            textAlign: 'center',
                                                            padding: '1px 0',
                                                            letterSpacing: '0.02em'
                                                        }}>
                                                            {release.air.timeLabel}
                                                        </div>
                                                    )}
                                                    {/* Type indicator badge */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '2px',
                                                        right: '2px',
                                                        background: 'rgba(0,0,0,0.7)',
                                                        borderRadius: '3px',
                                                        padding: '2px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        {release.type === 'tv' ? (
                                                            <Tv size={8} color="var(--accent-primary)" />
                                                        ) : (
                                                            <Film size={8} color="var(--brand-600)" />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {dayReleases.length > 4 && (
                                                <div style={{
                                                    width: 'calc(50% - 2px)',
                                                    aspectRatio: '2/3',
                                                    borderRadius: '4px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.7rem',
                                                    color: 'var(--text-secondary)'
                                                }}>
                                                    +{dayReleases.length - 4}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Upcoming List */}
            <section>
                <h3 style={{ marginBottom: '16px' }}>Upcoming Releases</h3>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        Loading upcoming releases...
                    </div>
                ) : upcomingReleases.length === 0 ? (
                    <div className="empty-state">
                        <CalendarIcon size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                        <p>No upcoming releases in your watchlist</p>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Add movies and TV shows to your list to track their releases
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Group by the day each release lands on where the viewer is */}
                        {(() => {
                            const groupedReleases = {};
                            upcomingReleases.forEach(item => {
                                const dateKey = formatZonedDate(item.air.instant, timeZone, {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                });
                                if (!groupedReleases[dateKey]) {
                                    groupedReleases[dateKey] = [];
                                }
                                groupedReleases[dateKey].push(item);
                            });

                            return Object.entries(groupedReleases).map(([dateStr, items]) => (
                                <div key={dateStr}>
                                    <h4 style={{
                                        margin: '0 0 12px 4px',
                                        color: 'var(--accent-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }}></div>
                                        {dateStr}
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {items.map((item, idx) => (
                                            <motion.div
                                                key={`${item.id}-${idx}`}
                                                whileHover={{ scale: 1.02 }}
                                                onClick={() => navigate(`/${item.type}/${item.id}`)}
                                                className="glass-panel"
                                                style={{
                                                    padding: '16px',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    gap: '16px',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <img
                                                    src={item.poster}
                                                    alt={item.title}
                                                    style={{
                                                        width: '60px',
                                                        height: '90px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        objectFit: 'cover'
                                                    }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        {item.type === 'tv' ? <Tv size={16} /> : <Film size={16} />}
                                                        <h4 style={{ margin: 0 }}>{item.title}</h4>
                                                    </div>
                                                    {item.isEpisode && item.episodeTitle && (
                                                        <p style={{
                                                            fontSize: '0.85rem',
                                                            color: 'var(--accent-primary)',
                                                            margin: '2px 0 4px 0',
                                                            fontStyle: 'italic'
                                                        }}>
                                                            "{item.episodeTitle}"
                                                        </p>
                                                    )}
                                                    {/* The day is in the header; this is the hour */}
                                                    <p style={{
                                                        fontSize: '0.85rem',
                                                        color: 'var(--text-secondary)',
                                                        margin: '4px 0'
                                                    }}>
                                                        {item.isEpisode ? `Season ${item.seasonNumber} • Episode ${item.episodeNumber}` : item.year}
                                                    </p>

                                                    <p style={{
                                                        fontSize: '0.85rem',
                                                        color: 'var(--brand-600)',
                                                        fontWeight: 600,
                                                        margin: '4px 0 0 0',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        flexWrap: 'wrap'
                                                    }}>
                                                        <Clock size={13} />
                                                        {item.air.timeLabel
                                                            ? `${item.air.precision === PRECISION.ESTIMATED ? '~' : ''}${item.air.timeLabel} ${item.air.zoneLabel}`
                                                            : 'Time not announced'}
                                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                                                            {countdownLabel(item.air)}
                                                        </span>
                                                    </p>

                                                    {/* Where the time comes from, so an odd-looking hour makes sense */}
                                                    {(item.air.sourceLabel || item.releaseKind) && (
                                                        <p style={{
                                                            fontSize: '0.75rem',
                                                            color: 'var(--text-tertiary)',
                                                            margin: '3px 0 0 0'
                                                        }}>
                                                            {item.isEpisode
                                                                ? item.air.global
                                                                    ? `${item.air.sourceLabel} — worldwide drop`
                                                                    : `${item.air.sourceLabel} — ${item.air.sourceDate} local broadcast`
                                                                : `${item.releaseKind || 'Release'}${item.releaseCountry ? ` (${item.releaseCountry} date)` : ''}`}
                                                        </p>
                                                    )}

                                                    {!item.isEpisode && (
                                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                            {item.genres?.slice(0, 3).map(genre => (
                                                                <span key={genre} className="meta-tag">
                                                                    {genre}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                )}

                {/* Say which times are guesses rather than letting them read as fact */}
                {!loading && hasEstimates && (
                    <p style={{
                        marginTop: '20px',
                        fontSize: '0.78rem',
                        color: 'var(--text-tertiary)',
                        lineHeight: 1.5
                    }}>
                        Times marked ~ are estimated from the channel's usual prime-time slot —
                        the streaming services publish a fixed drop time, local broadcasters don't.
                    </p>
                )}
            </section>
        </div>
    );
};

export default Calendar;
