import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Plus, Check, Share, Bell, Clock, ChevronDown, RefreshCw } from 'lucide-react';
import { isFilmReleased } from '../services/franchises';
import { getDetails, mapMediaData, getTVSeasonDetails, getCollection, getMovieReleaseForCountry, clearTmdbCache } from '../services/tmdb';
import {
    PRECISION,
    describeRelease,
    getShowReleaseRule,
    movieReleaseRule,
    resolveReleaseTime,
    viewerDayRule,
    zoneAbbreviation,
} from '../services/releaseTime';
import { TrailerModal } from '../components/TrailerModal';
import { useUser } from '../context/UserContext';
import '../styles/detail.css';

const pad2 = (n) => String(n).padStart(2, '0');

// Reusable Detail Component (handles both Movie and TV)
const MediaDetail = ({ type }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [item, setItem] = useState(null);
    const [showTrailer, setShowTrailer] = useState(false);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    // seasonNumber -> that season's episode list, filled in as seasons are viewed.
    const [seasons, setSeasons] = useState({});
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);
    const [collection, setCollection] = useState(null);
    // Bumped by the retry button after a failed load.
    const [retryKey, setRetryKey] = useState(0);
    // Where and when this title goes out, so air/release times are real instants
    // rather than a bare date parsed as UTC midnight.
    const [airRule, setAirRule] = useState(null);
    const [movieRelease, setMovieRelease] = useState(null);

    // React reuses this component when navigating detail→detail (a franchise
    // link, a same-type recommendation, or movie↔tv), so per-title state would
    // otherwise bleed through from the previous title. Reset it the moment the
    // route target changes — the render-phase reset pattern from the React docs,
    // which runs before the fetch effects below.
    const routeKey = `${type}-${id}`;
    const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
    if (prevRouteKey !== routeKey) {
        setPrevRouteKey(routeKey);
        setItem(null);
        setLoading(true);
        setSeasons({});
        setSelectedSeason(1);
        setCollection(null);
        setAirRule(null);
        setMovieRelease(null);
    }

    const {
        status, user, timeZone,
        addToWatchlist, removeFromWatchlist, watchlist,
        markAsWatched, watched, removeFromWatched,
        toggleEpisodeWatched, isEpisodeWatched,
        setSeasonWatched, isSeasonWatched,
        isReminderSet, toggleReminder
    } = useUser();

    // Saving anything requires an account or guest session.
    const withUser = (action) => {
        if (status === 'signedOut') {
            navigate('/login');
            return;
        }
        action();
    };

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({ title: item?.title, url });
            } catch {
                // user cancelled the share sheet
            }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch {
                // Clipboard access can be refused (insecure context, permissions)
            }
        }
    };

    // Which title the loaded detail belongs to and how many seasons it has —
    // the only parts of `item` the episode effect depends on, so a re-render of
    // the same title doesn't refetch the season.
    const seasonCount = type === 'tv' ? item?.seasons || 0 : 0;

    // Fetch episodes for TV shows
    useEffect(() => {
        if (seasonCount <= 0) return;
        let active = true;
        const fetchEpisodes = async () => {
            setLoadingEpisodes(true);
            const seasonData = await getTVSeasonDetails(id, selectedSeason);
            // Changing season mid-flight must not let the old season's
            // episodes land under the new season's number.
            if (!active) return;
            setSeasons(prev => ({
                ...prev,
                [selectedSeason]: seasonData?.episodes || [],
            }));
            setLoadingEpisodes(false);
        };
        fetchEpisodes();
        return () => { active = false; };
    }, [seasonCount, selectedSeason, id]);

    useEffect(() => {
        let active = true;
        const fetchDetail = async () => {
            // Streaming providers are looked up for the user's country
            const userCountry = user?.country || 'US';

            const tmdbData = await getDetails(id, type, userCountry);
            // Detail→detail navigation (a franchise link, a recommendation) can
            // leave the previous title's response arriving after this one's.
            if (!active) return;

            if (!tmdbData) {
                setItem(null);
                setLoading(false);
                return;
            }

            const mapped = mapMediaData({ ...tmdbData, media_type: type }, timeZone);
            setItem({
                ...mapped,
                trailerKey: tmdbData.trailerKey,
                credits: tmdbData.credits,
                belongsToCollection: tmdbData.belongs_to_collection || null,
                // For a returning series the meaningful countdown is the next
                // episode, not the premiere date years ago.
                nextEpisode: tmdbData.next_episode_to_air || null,
                streaming: tmdbData.streaming || [],
            });

            if (type === 'tv') {
                setAirRule(getShowReleaseRule(tmdbData));
                setLoading(false);
                return;
            }

            // Show the page as soon as the title is in; the country-specific
            // opening date refines the countdown when it lands.
            setLoading(false);
            const release = await getMovieReleaseForCountry(id, userCountry);
            if (!active) return;
            setMovieRelease(release);
            setAirRule(release ? movieReleaseRule(release, timeZone) : viewerDayRule(timeZone));
        };

        fetchDetail();
        return () => { active = false; };
    }, [id, type, user?.country, timeZone, retryKey]);

    const retry = () => {
        clearTmdbCache();
        setLoading(true);
        setRetryKey((k) => k + 1);
    };

    // Load franchise/collection details for movies that belong to one.
    useEffect(() => {
        let active = true;
        const collectionId = item?.belongsToCollection?.id;
        const load = async () => {
            if (type === 'movie' && collectionId) {
                const data = await getCollection(collectionId);
                if (active) setCollection(data);
            } else {
                setCollection(null);
            }
        };
        load();
        return () => { active = false; };
    }, [type, item?.belongsToCollection?.id]);

    if (loading) {
        return (
            <div className="container detail-status" role="status" aria-label="Loading">
                <div className="spinner"></div>
            </div>
        );
    }
    if (!item) {
        return (
            <div className="container detail-status">
                <div className="tile detail-error">
                    <h2>Couldn't load this title</h2>
                    <p>It may not exist, or the connection dropped.</p>
                    <div className="detail-error-actions">
                        <button type="button" className="pill-btn primary" onClick={retry}>
                            <RefreshCw size={16} aria-hidden="true" /> Try again
                        </button>
                        <button type="button" className="pill-btn ghost" onClick={() => navigate(-1)}>
                            <ArrowLeft size={16} aria-hidden="true" /> Go back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Movies and TV shows can share the same numeric TMDB id, so match on type
    // too — otherwise a watched movie makes a same-id show read as already seen.
    const isInWatchlist = watchlist.some(m => m.id === item.id && (m.type || 'movie') === type);
    const isWatched = watched.some(m => m.id === item.id && (m.type || 'movie') === type);

    // What we're counting down to: a series' next episode, or a movie's opening
    // day in the viewer's country. Resolved to a real instant in their zone, so
    // the countdown can't claim something is out before it is.
    const resolveCountdownTarget = () => {
        const rule = airRule || viewerDayRule(timeZone);
        if (type === 'tv') {
            if (!item.nextEpisode?.air_date) return null;
            return resolveReleaseTime({ dateStr: item.nextEpisode.air_date, rule, viewerZone: timeZone });
        }
        const dateStr = movieRelease?.date || item.releaseDate;
        return resolveReleaseTime({ dateStr, rule, viewerZone: timeZone });
    };

    const release = resolveCountdownTarget();
    const timeLeft = release && !release.hasAired ? release.countdown : null;
    // Movies gate "Mark Watched" on actually being out. Fall back to the mapped
    // flag while the country-specific date is still loading.
    const notOutYet = type === 'movie' && (release ? !release.hasAired : item.upcoming);

    const franchiseParts = collection?.parts || [];
    // Progress counts only the films that are out: an unreleased sequel can't
    // be watched, so it stays in the list (marked) but out of the total.
    const franchiseReleased = franchiseParts.filter((p) => isFilmReleased(p));
    const franchiseTotal = franchiseReleased.length;
    const franchiseWatchedCount = franchiseReleased.filter(
        (p) => watched.some((w) => w.id === p.id && w.type === 'movie')
    ).length;

    const addFranchiseToWatchlist = () => withUser(() => {
        franchiseParts.forEach((p) => {
            const seen = watched.some((w) => w.id === p.id && (w.type || 'movie') === 'movie');
            const listed = watchlist.some((w) => w.id === p.id && (w.type || 'movie') === 'movie');
            if (!seen && !listed) addToWatchlist({ ...p, genres: [] });
        });
    });

    const reminderSet = isReminderSet(item.id, item.type);

    // "8.4 RATING · 2024 · 2 SEASONS · 16 EPS" — only the parts TMDB actually has.
    const metaParts = [
        item.rating && item.rating !== 'N/A' ? `${item.rating} rating` : null,
        item.year && item.year !== 'N/A' ? item.year : null,
        ...(item.type === 'tv'
            ? [`${item.seasons} Seasons`, `${item.episodes} Eps`]
            : [item.runtime]),
        notOutYet ? 'Not released yet' : null,
    ].filter(Boolean);

    const episodeList = seasons[selectedSeason];

    return (
        <>
            <motion.div
                className="container page detail-page"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                {/* Hero: full-bleed backdrop */}
                <div className="detail-hero">
                    <img
                        src={item.backdrop || item.poster}
                        alt={item.title}
                        fetchPriority="high"
                    />
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="detail-hero-back"
                        aria-label="Back"
                    >
                        <ArrowLeft size={20} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                    {item.trailerKey && (
                        <button
                            type="button"
                            onClick={() => setShowTrailer(true)}
                            className="detail-hero-play"
                            aria-label="Play trailer"
                        >
                            <Play size={22} fill="currentColor" aria-hidden="true" />
                        </button>
                    )}
                </div>

                {/* Title & stats */}
                <header>
                    <h1 className="detail-title">{item.title}</h1>
                    {metaParts.length > 0 && (
                        <div className="detail-meta">{metaParts.join(' · ')}</div>
                    )}
                </header>

                {/* Action tiles */}
                <div className={`action-grid detail-actions ${type === 'movie' ? 'is-four' : ''}`}>
                    {type === 'movie' && (
                        notOutYet ? (
                            <button type="button" className="action-btn" disabled>
                                <Clock size={20} aria-hidden="true" />
                                <span>Not Released</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                className={`action-btn ${isWatched ? 'active' : ''}`}
                                aria-pressed={isWatched}
                                onClick={() => withUser(() => isWatched ? removeFromWatched(item) : markAsWatched(item))}
                            >
                                <Check size={20} strokeWidth={2.5} aria-hidden="true" />
                                <span>{isWatched ? 'Watched' : 'Mark Watched'}</span>
                            </button>
                        )
                    )}

                    <button
                        type="button"
                        className={`action-btn ${isInWatchlist ? 'active' : ''}`}
                        aria-pressed={isInWatchlist}
                        onClick={() => withUser(() => isInWatchlist ? removeFromWatchlist(item.id, type) : addToWatchlist(item))}
                    >
                        {isInWatchlist
                            ? <Check size={20} strokeWidth={2.5} aria-hidden="true" />
                            : <Plus size={20} strokeWidth={2.5} aria-hidden="true" />}
                        <span>{isInWatchlist ? 'In my list' : 'My List'}</span>
                    </button>

                    <button
                        type="button"
                        className="action-btn"
                        disabled={!item.trailerKey}
                        onClick={() => item.trailerKey && setShowTrailer(true)}
                    >
                        <Play size={20} fill="currentColor" aria-hidden="true" />
                        <span>Trailer</span>
                    </button>

                    <button type="button" className="action-btn" onClick={handleShare}>
                        {copied
                            ? <Check size={20} strokeWidth={2.5} aria-hidden="true" />
                            : <Share size={20} aria-hidden="true" />}
                        <span aria-live="polite">{copied ? 'Copied!' : 'Share'}</span>
                    </button>
                </div>

                {/* Two columns on wide screens: what the title is on the left,
                    what the viewer is tracking on the right. On phones both
                    wrappers dissolve (display: contents) and the blocks fall
                    back into one column in their detail-o* order. */}
                <div className="detail-cols">
                <div className="detail-main">
                {/* Overview + genres */}
                <section className="detail-o2">
                    <p className="detail-overview">{item.plot || "No overview available."}</p>
                    {item.genres?.length > 0 && (
                        <div className="detail-genres">
                            {item.genres.map(g => (
                                <span key={g} className="meta-tag">{g}</span>
                            ))}
                        </div>
                    )}
                </section>

                {/* Episodes — TV shows only */}
                {type === 'tv' && item.seasons > 0 && (
                    <section className="detail-section detail-o6">
                        <div className="episodes-header">
                            <h2 className="section-title">Episodes</h2>
                            <div className="detail-season">
                                <select
                                    value={selectedSeason}
                                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                    className="input-field season-select"
                                    aria-label="Select season"
                                >
                                    {Array.from({ length: item.seasons }, (_, i) => i + 1).map(seasonNum => (
                                        <option key={seasonNum} value={seasonNum}>Season {seasonNum}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
                            </div>
                        </div>

                        {episodeList && episodeList.length > 0 && (() => {
                            // Only episodes that have actually aired — marking
                            // a season seen shouldn't tick off next month's.
                            const episodeNumbers = episodeList
                                .filter((ep) => {
                                    const air = resolveReleaseTime({
                                        dateStr: ep.air_date,
                                        rule: airRule || viewerDayRule(timeZone),
                                        viewerZone: timeZone,
                                    });
                                    return air ? air.hasAired : true;
                                })
                                .map(ep => ep.episode_number);
                            if (episodeNumbers.length === 0) return null;
                            const seasonSeen = isSeasonWatched(item.id, selectedSeason, episodeNumbers);
                            return (
                                <button
                                    type="button"
                                    onClick={() => withUser(() => setSeasonWatched(item.id, selectedSeason, episodeNumbers, !seasonSeen))}
                                    className={`season-mark-btn detail-season-mark ${seasonSeen ? 'seen' : ''}`}
                                    aria-pressed={seasonSeen}
                                    title={seasonSeen ? 'Mark this season as not seen' : 'Mark every episode this season as seen'}
                                >
                                    {seasonSeen && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
                                    <span>{seasonSeen ? 'Season seen' : 'Mark season seen'}</span>
                                </button>
                            );
                        })()}

                        {loadingEpisodes ? (
                            <div className="tile">
                                <p className="detail-empty" role="status">Loading episodes...</p>
                            </div>
                        ) : episodeList && episodeList.length > 0 ? (
                            <ul className="tile detail-episodes">
                                {episodeList.map((episode) => {
                                    const isWatchedEp = isEpisodeWatched(item.id, selectedSeason, episode.episode_number);
                                    // The real moment this episode airs, in the
                                    // viewer's clock. Episodes with no date at all
                                    // stay markable — TMDB omits dates for some
                                    // long-aired specials.
                                    const air = resolveReleaseTime({
                                        dateStr: episode.air_date,
                                        rule: airRule || viewerDayRule(timeZone),
                                        viewerZone: timeZone,
                                    });
                                    const aired = air ? air.hasAired : true;
                                    const meta = [
                                        air
                                            ? `${describeRelease(air, { verb: 'air', zone: timeZone })}${air.precision === PRECISION.ESTIMATED && air.timeLabel ? ' (est.)' : ''}`
                                            : null,
                                        episode.runtime ? `${episode.runtime} min` : null,
                                        aired ? null : 'Not aired yet',
                                    ].filter(Boolean).join(' · ');
                                    const tickLabel = !aired ? 'Not aired yet' : isWatchedEp ? 'Watched' : 'Mark watched';
                                    return (
                                        <li
                                            key={episode.id}
                                            className={`detail-episode ${isWatchedEp ? 'is-watched' : ''}`}
                                        >
                                            {/* Nothing to mark watched before it airs. */}
                                            <button
                                                type="button"
                                                className="detail-tick"
                                                disabled={!aired}
                                                aria-pressed={aired ? isWatchedEp : undefined}
                                                aria-label={`Episode ${episode.episode_number}: ${tickLabel}`}
                                                onClick={() => {
                                                    if (!aired) return;
                                                    withUser(() => toggleEpisodeWatched(item.id, selectedSeason, episode.episode_number));
                                                }}
                                            >
                                                <Check size={16} strokeWidth={3} aria-hidden="true" />
                                            </button>
                                            <div className="detail-episode-body">
                                                <div className="detail-episode-title">
                                                    {episode.episode_number}. {episode.name}
                                                </div>
                                                {meta && (
                                                    <div className={`detail-episode-meta ${aired ? '' : 'is-upcoming'}`}>
                                                        {meta}
                                                    </div>
                                                )}
                                                {episode.overview && (
                                                    <div className="detail-episode-overview">{episode.overview}</div>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="tile">
                                <p className="detail-empty">No episodes found for this season</p>
                            </div>
                        )}
                    </section>
                )}
                {/* Cast */}
                {item.credits && item.credits.length > 0 && (
                    <section className="detail-section detail-o5">
                        <h2 className="section-title">Cast</h2>
                        <div className="detail-cast hide-scrollbar">
                            {item.credits.map((actor) => (
                                <Link
                                    key={actor.id}
                                    to={`/person/${actor.id}`}
                                    className="detail-cast-item"
                                >
                                    <img
                                        src={actor.profile_path
                                            ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
                                            : '/poster-placeholder.svg'}
                                        alt=""
                                        loading="lazy"
                                    />
                                    <span className="detail-cast-name">{actor.name}</span>
                                    {actor.character && (
                                        <span className="detail-cast-role">{actor.character}</span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                </div>
                <aside className="detail-rail">
                {/* Countdown to the next episode / the local opening day */}
                {timeLeft && (
                    <section className="tile detail-o1" aria-label="Countdown">
                        <h2 className="tile-label detail-countdown-label">
                            {item.type === 'tv'
                                ? `Season ${item.nextEpisode?.season_number} Episode ${item.nextEpisode?.episode_number} airs in`
                                : 'Movie premiere in'}
                        </h2>
                        <div className="detail-countdown-nums">
                            <div>
                                <div className="detail-countdown-num">{pad2(timeLeft.days)}</div>
                                <div className="detail-countdown-unit">DAYS</div>
                            </div>
                            <div>
                                <div className="detail-countdown-num">{pad2(timeLeft.hours)}</div>
                                <div className="detail-countdown-unit">HOURS</div>
                            </div>
                            <div>
                                <div className="detail-countdown-num">{pad2(timeLeft.minutes)}</div>
                                <div className="detail-countdown-unit">MINS</div>
                            </div>
                        </div>

                        <div className="detail-countdown-foot">
                            {/* The actual moment, in the viewer's own clock */}
                            <p className="detail-countdown-when">
                                {describeRelease(release, { verb: item.type === 'tv' ? 'air' : 'release', zone: timeZone })}
                                {release.timeLabel ? ` ${zoneAbbreviation(release.instant, timeZone)}` : ''}
                                <span className="detail-countdown-note">
                                    {release.precision === PRECISION.ESTIMATED
                                        ? `Estimated from ${release.sourceLabel || 'the channel'}'s usual slot — local broadcasters don't publish an exact time`
                                        : release.precision === PRECISION.DAY
                                            ? 'Exact time not announced yet'
                                            : release.global
                                                ? `${release.sourceLabel} drops worldwide at this moment`
                                                : movieRelease?.isFallback
                                                    ? `${movieRelease.typeLabel} — ${movieRelease.country} date (no date listed for your country yet)`
                                                    : `${release.sourceLabel || 'Release'}${type === 'movie' ? ` in ${movieRelease?.country || user?.country || 'your country'}` : ''}`}
                                </span>
                            </p>
                            <button
                                type="button"
                                className={`pill-btn ${reminderSet ? 'tint' : 'inverse'}`}
                                aria-pressed={reminderSet}
                                onClick={() => withUser(() => toggleReminder(item))}
                            >
                                {reminderSet ? (
                                    <><Check size={16} strokeWidth={2.5} aria-hidden="true" /> Reminder set</>
                                ) : (
                                    <><Bell size={16} strokeWidth={2.5} aria-hidden="true" /> Notify me</>
                                )}
                            </button>
                        </div>
                    </section>
                )}

                {/* A series between episodes is still streamable, so it gets both
                    the countdown and this; an unreleased movie gets neither. */}
                {(!timeLeft || type === 'tv') && (
                    <section className="detail-section detail-o3">
                        <h2 className="section-title">Where to watch</h2>
                        {item.streaming && item.streaming.length > 0 ? (
                            <div className="detail-providers">
                                {item.streaming.map((service) => (
                                    <div key={service.id || service.name} className="detail-provider">
                                        <img src={service.logo} alt="" loading="lazy" />
                                        <span>{service.name}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="tile-dashed">
                                <p className="detail-empty">Not currently available for streaming.</p>
                            </div>
                        )}
                    </section>
                )}

                {/* Franchise / collection tracking — movies only */}
                {type === 'movie' && franchiseParts.length > 1 && (
                    <section className="tile detail-o4">
                        <div className="detail-franchise-head">
                            <h2 className="section-title truncate">{collection.name}</h2>
                            <span className="pill-tag">
                                {franchiseWatchedCount}/{franchiseTotal} watched
                            </span>
                        </div>

                        <div
                            className="detail-progress"
                            role="progressbar"
                            aria-label={`${collection.name} watched`}
                            aria-valuemin={0}
                            aria-valuemax={franchiseTotal}
                            aria-valuenow={franchiseWatchedCount}
                        >
                            <motion.div
                                className="detail-progress-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${franchiseTotal ? (franchiseWatchedCount / franchiseTotal) * 100 : 0}%` }}
                                transition={{ duration: 0.6 }}
                            />
                        </div>

                        <ul className="detail-franchise-list">
                            {franchiseParts.map((part) => {
                                const seen = watched.some((w) => w.id === part.id && w.type === 'movie');
                                const isCurrent = part.id === item.id;
                                const out = isFilmReleased(part);
                                const row = (
                                    <>
                                        <span className={`detail-mark ${seen ? 'is-seen' : ''} ${out ? '' : 'is-unreleased'}`} aria-hidden="true">
                                            <Check size={12} strokeWidth={3.5} />
                                        </span>
                                        <span className="detail-franchise-title truncate">{part.title}</span>
                                        <span className="detail-franchise-note">
                                            {isCurrent ? 'Now viewing' : out ? part.year : `${part.year || 'TBA'} · not out`}
                                        </span>
                                        <span className="detail-sr-only">{!out ? ', not out yet' : seen ? ', watched' : ', not watched'}</span>
                                    </>
                                );
                                return (
                                    <li key={part.id}>
                                        {isCurrent ? (
                                            <div className="detail-franchise-row" aria-current="page">{row}</div>
                                        ) : (
                                            <Link className="detail-franchise-row" to={`/movie/${part.id}`}>{row}</Link>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>

                        {franchiseWatchedCount < franchiseParts.length && (
                            <button
                                type="button"
                                onClick={addFranchiseToWatchlist}
                                className="pill-btn inverse block detail-franchise-add"
                            >
                                Add remaining to watchlist
                            </button>
                        )}
                    </section>
                )}

                </aside>
                </div>
            </motion.div>

            {/* Trailer Modal */}
            <AnimatePresence>
                {showTrailer && item.trailerKey && (
                    <TrailerModal
                        trailerKey={item.trailerKey}
                        title={item.title}
                        onClose={() => setShowTrailer(false)}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default MediaDetail;
