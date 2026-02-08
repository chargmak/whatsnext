import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Film, Tv } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { getTVSeriesWithEpisodes, getTVSeasonDetails } from '../services/tmdb';
import { motion } from 'framer-motion';

const Calendar = () => {
    const navigate = useNavigate();
    const { watchlist } = useUser();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [upcomingReleases, setUpcomingReleases] = useState([]);
    const [loading, setLoading] = useState(true);

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

    // Get releases for a specific date
    const getReleasesForDate = (date) => {
        if (!date) return [];

        const dateStr = date.toISOString().split('T')[0];
        return upcomingReleases.filter(release => {
            const releaseDate = new Date(release.releaseDate).toISOString().split('T')[0];
            return releaseDate === dateStr;
        });
    };

    // Process watchlist for upcoming releases including TV episodes
    useEffect(() => {
        const fetchUpcomingReleases = async () => {
            setLoading(true);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const releases = [];

            // Process each item in watchlist
            for (const item of watchlist) {
                if (item.type === 'tv') {
                    // Fetch TV series details to get all upcoming episodes
                    try {
                        const tvDetails = await getTVSeriesWithEpisodes(item.id);

                        if (tvDetails?.seasons) {
                            // OPTIMIZATION: Only fetch the last 2 seasons to avoid rate limits
                            // Sort seasons by season_number just in case
                            const sortedSeasons = [...tvDetails.seasons].sort((a, b) => b.season_number - a.season_number);
                            const relevantSeasons = sortedSeasons.slice(0, 2);

                            for (const season of relevantSeasons) {
                                // Skip season 0 (specials) and seasons without episodes
                                if (season.season_number === 0 || !season.episode_count) continue;

                                try {
                                    // Use the service function instead of raw fetch
                                    const seasonData = await getTVSeasonDetails(item.id, season.season_number);

                                    if (seasonData?.episodes) {
                                        // Add all upcoming episodes from this season
                                        for (const episode of seasonData.episodes) {
                                            if (episode.air_date) {
                                                const airDate = new Date(episode.air_date);
                                                // Create a slightly loosened check for "today" to handle timezone diffs
                                                // Use the same 'today' reference from outer scope
                                                if (airDate >= today) {
                                                    releases.push({
                                                        ...item,
                                                        title: `${item.title} - S${episode.season_number}E${episode.episode_number}`,
                                                        episodeTitle: episode.name,
                                                        releaseDate: episode.air_date,
                                                        isEpisode: true,
                                                        seasonNumber: episode.season_number,
                                                        episodeNumber: episode.episode_number
                                                    });
                                                }
                                            }
                                        }
                                    }
                                } catch (seasonError) {
                                    console.error(`Error fetching season ${season.season_number}:`, seasonError);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error fetching TV details:', error);
                    }
                } else if (item.type === 'movie') {
                    // Movie release
                    const releaseDate = new Date(item.releaseDate);
                    if (releaseDate >= today) {
                        releases.push({
                            ...item,
                            isUpcoming: true
                        });
                    }
                }
            }

            // Sort by release date
            releases.sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));
            setUpcomingReleases(releases);
            setLoading(false);
        };

        fetchUpcomingReleases();
    }, [watchlist]);

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

    const isToday = (date) => {
        if (!date) return false;
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const calendarDays = getCalendarDays();

    return (
        <div className="container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <header className="page-header">
                <h1 className="brand-title">
                    <CalendarIcon size={28} style={{ marginRight: '8px' }} />
                    Release Calendar
                </h1>
            </header>

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
                    const releases = getReleasesForDate(date);
                    const hasReleases = releases.length > 0;

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
                                            {releases.slice(0, 4).map((release, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/${release.type}/${release.id}`);
                                                    }}
                                                    style={{
                                                        position: 'relative',
                                                        width: releases.length === 1 ? '100%' : 'calc(50% - 2px)',
                                                        aspectRatio: '2/3',
                                                        borderRadius: '4px',
                                                        overflow: 'hidden',
                                                        cursor: 'pointer',
                                                        border: '1px solid rgba(255,255,255,0.1)'
                                                    }}
                                                    title={release.title}
                                                >
                                                    <img
                                                        src={release.poster}
                                                        alt={release.title}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                        }}
                                                    />
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
                                            {releases.length > 4 && (
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
                                                    +{releases.length - 4}
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
                        {/* Group items by date */}
                        {(() => {
                            const groupedReleases = {};
                            upcomingReleases.forEach(item => {
                                const dateKey = new Date(item.releaseDate).toLocaleDateString('en-US', {
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
                                                    {/* Date removed from here as it's in the header now */}
                                                    <p style={{
                                                        fontSize: '0.85rem',
                                                        color: 'var(--text-secondary)',
                                                        margin: '4px 0'
                                                    }}>
                                                        {item.isEpisode ? `Season ${item.seasonNumber} • Episode ${item.episodeNumber}` : item.year}
                                                    </p>

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
            </section>
        </div>
    );
};

export default Calendar;
