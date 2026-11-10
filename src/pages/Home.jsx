import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Check, RefreshCw } from 'lucide-react';
import { getTrendingMovies, getTrendingTV, getRecommendationsFromSeeds, mapMediaData, clearTmdbCache, PLACEHOLDER_POSTER } from '../services/tmdb';
import { formatZonedDate, releaseInstant, todayKey, viewerDayRule } from '../services/releaseTime';
import { PosterRow, PosterRowSkeleton } from '../components/PosterRow';
import { WhatsNextSpotlight } from '../components/WhatsNextSpotlight';
import { useUser } from '../context/UserContext';
import { useUpNext } from '../hooks/useUpNext';
import { useReleases, countdownText } from '../hooks/useReleases';
import { useFranchiseProgress } from '../hooks/useFranchiseProgress';
import '../styles/home.css';

const MEDIA_TABS = [
    { id: 'tv', label: 'TV' },
    { id: 'movie', label: 'Movies' },
];

const DEFAULT_AVATAR = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';

// The seven calendar days starting today, as the viewer's zone counts them.
// Keys are plain y-m-d strings, so stepping a day is UTC arithmetic on noon —
// no DST edge can skip or repeat a date.
const weekFrom = (startKey) => Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${startKey}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    return {
        key: date.toISOString().slice(0, 10),
        day: date.getUTCDate(),
        name: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    };
});

const releaseTitle = (release) => (release.isEpisode ? release.showTitle : release.title);

const PosterButton = ({ item, onOpen }) => (
    <button type="button" className="tile-poster" onClick={() => onOpen(item)} aria-label={item.title}>
        <img
            src={item.poster || PLACEHOLDER_POSTER}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(e) => {
                if (!e.currentTarget.src.endsWith(PLACEHOLDER_POSTER)) e.currentTarget.src = PLACEHOLDER_POSTER;
            }}
        />
    </button>
);

// ---- Up next -------------------------------------------------------------
// The one thing to press play on tonight. On the TV tab that is the next
// unwatched episode of the show watched most recently; on the Movies tab, the
// most recently saved movie that is already out.

const UpNextMedia = ({ to, image, alt }) => (
    <Link to={to} className="upnext-tile-media" aria-label={alt}>
        {image && <img src={image} alt="" />}
        <span className="upnext-tile-chip">Up next</span>
    </Link>
);

const EmptyUpNext = ({ heading, body, cta }) => (
    <section className="tile span-2 home-empty-tile">
        <div className="tile-label">Up next</div>
        <h2>{heading}</h2>
        <p>{body}</p>
        {cta}
    </section>
);

const TvUpNextTile = ({ series }) => {
    const { loading, items, busyId, markWatched } = useUpNext(series, 1);

    if (series.length === 0) {
        return (
            <EmptyUpNext
                heading="No TV shows in your list yet."
                body="Add a show and its next episode appears here."
                cta={<Link to="/search" className="pill-btn primary">Find shows to watch</Link>}
            />
        );
    }

    if (loading) {
        return <section className="tile span-2 home-empty-tile skeleton" aria-busy="true" aria-label="Finding your next episodes" />;
    }

    if (items.length === 0) {
        return (
            <EmptyUpNext
                heading="You're all caught up!"
                body="Every aired episode from the shows in your list has been watched."
                cta={<Link to="/calendar" className="pill-btn">See what's coming</Link>}
            />
        );
    }

    const { show, ep } = items[0];
    return (
        <section className="tile span-2 upnext-tile">
            <UpNextMedia to={`/tv/${show.id}`} image={ep.still || show.backdrop} alt={`Open ${show.title}`} />
            <div className="upnext-tile-body">
                <div className="upnext-tile-text">
                    <Link to={`/tv/${show.id}`} className="tile-title">{ep.title}</Link>
                    <div className="tile-sub">S{ep.seasonNumber} · E{ep.episodeNumber} · {ep.episodeName}</div>
                </div>
                <button
                    type="button"
                    className="pill-btn primary"
                    onClick={() => markWatched(show, ep)}
                    disabled={busyId === show.id}
                    aria-label={`Mark ${show.title} S${ep.seasonNumber}E${ep.episodeNumber} watched`}
                >
                    <Check size={16} strokeWidth={2.5} aria-hidden="true" /> Watched
                </button>
            </div>
            {series.length > 1 && (
                <div className="upnext-tile-more">
                    <span className="mono-label">{series.length} shows in your list</span>
                    <Link to="/library" className="link-accent">See all</Link>
                </div>
            )}
        </section>
    );
};

const MovieUpNextTile = ({ movies, timeZone, onWatched }) => {
    // Saved order is oldest first; the latest save that is already out wins.
    const released = useMemo(() => {
        const now = new Date();
        return [...movies].reverse().filter((m) =>
            !m.releaseDate || releaseInstant(m.releaseDate, viewerDayRule(timeZone)) <= now
        );
    }, [movies, timeZone]);

    if (movies.length === 0) {
        return (
            <EmptyUpNext
                heading="No movies in your list yet."
                body="Save a movie and it is waiting for you here."
                cta={<Link to="/search" className="pill-btn primary">Find movies to watch</Link>}
            />
        );
    }

    if (released.length === 0) {
        return (
            <EmptyUpNext
                heading="Nothing out yet."
                body="Every movie in your list is still to be released."
                cta={<Link to="/calendar" className="pill-btn">See what's coming</Link>}
            />
        );
    }

    const movie = released[0];
    const facts = [movie.year && movie.year !== 'N/A' ? movie.year : null, movie.runtime, movie.genres?.[0]]
        .filter(Boolean)
        .join(' · ');

    return (
        <section className="tile span-2 upnext-tile">
            <UpNextMedia to={`/movie/${movie.id}`} image={movie.backdrop} alt={`Open ${movie.title}`} />
            <div className="upnext-tile-body">
                <div className="upnext-tile-text">
                    <Link to={`/movie/${movie.id}`} className="tile-title">{movie.title}</Link>
                    {facts && <div className="tile-sub">{facts}</div>}
                </div>
                <button
                    type="button"
                    className="pill-btn primary"
                    onClick={() => onWatched(movie)}
                    aria-label={`Mark ${movie.title} watched`}
                >
                    <Check size={16} strokeWidth={2.5} aria-hidden="true" /> Watched
                </button>
            </div>
            {movies.length > 1 && (
                <div className="upnext-tile-more">
                    <span className="mono-label">{movies.length} movies in your list</span>
                    <Link to="/library" className="link-accent">See all</Link>
                </div>
            )}
        </section>
    );
};

// ---- Release tiles ---------------------------------------------------------

const NextReleaseTile = ({ release, timeZone, reminderOn, mediaType }) => {
    if (!release) {
        return (
            <section className="tile-dashed mini-tile">
                <div className="tile-label">{mediaType === 'tv' ? 'Next episode' : 'Next release'}</div>
                <div className="mini-tile-hint">
                    {mediaType === 'tv'
                        ? 'Save a show that is still airing to start a countdown.'
                        : 'Save an upcoming movie to start a countdown.'}
                </div>
            </section>
        );
    }

    const { days, hours, minutes } = release.air.countdown;
    const [value, unit] = days > 0
        ? [days, days === 1 ? 'day' : 'days']
        : hours > 0
            ? [hours, hours === 1 ? 'hour' : 'hours']
            : [minutes, minutes === 1 ? 'minute' : 'minutes'];
    const when = formatZonedDate(release.air.instant, timeZone, { weekday: 'short', day: 'numeric', month: 'short' });

    return (
        <Link to={`/${release.type}/${release.id}`} className="tile mini-tile">
            <div className="tile-label">{mediaType === 'tv' ? 'Next episode' : 'Next release'}</div>
            <div className="countdown-num">
                <strong>{value}</strong>
                <span>{unit}</span>
            </div>
            <div className="mini-tile-foot">
                <div className="tile-title">{releaseTitle(release)}</div>
                <div className="tile-sub">
                    {when}
                    {release.isEpisode ? ` · S${release.seasonNumber}E${release.episodeNumber}` : ''}
                    {reminderOn ? ' · Reminder on' : ''}
                </div>
            </div>
        </Link>
    );
};

const ThisWeekTile = ({ releases, weekKeys, timeZone, mediaType }) => {
    const inWeek = releases.filter((r) => weekKeys.has(r.air.dateKey));

    if (inWeek.length === 0) {
        return (
            <section className="tile-dashed mini-tile">
                <div className="tile-label">This week</div>
                <div className="mini-tile-hint">
                    {mediaType === 'tv'
                        ? 'No episodes of your shows air in the next seven days.'
                        : 'None of your saved movies come out in the next seven days.'}
                </div>
            </section>
        );
    }

    const shown = inWeek.slice(0, 3);
    const extra = inWeek.length - shown.length;

    return (
        <section className="tile mini-tile">
            <div className="tile-label">This week</div>
            <ul className="week-list">
                {shown.map((r) => (
                    <li key={`${r.type}-${r.id}-${r.seasonNumber || 0}-${r.episodeNumber || 0}`} title={countdownText(r.air)}>
                        <span className="mono-label">
                            {new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone }).format(r.air.instant)}
                        </span>
                        <span className="truncate">
                            {releaseTitle(r)}{r.isEpisode ? ` · E${r.episodeNumber}` : ''}
                        </span>
                    </li>
                ))}
            </ul>
            <Link to="/calendar" className="link-accent mini-tile-foot">
                {extra > 0 ? `+${extra} more · Open calendar` : 'Open calendar'}
            </Link>
        </section>
    );
};

// ---- Collection tiles ------------------------------------------------------

const WatchlistTile = ({ items, mediaType }) => (
    <Link to="/library" className="tile mini-tile short">
        <div className="tile-label">Watchlist</div>
        <div className="mini-row">
            <span className="big-num">{items.length}</span>
            <span className="poster-stack" aria-hidden="true">
                {items.slice(-3).reverse().map((item) => (
                    <img key={`${item.type}-${item.id}`} src={item.poster || PLACEHOLDER_POSTER} alt="" />
                ))}
            </span>
        </div>
        <div className="mini-tile-foot tile-sub">
            {mediaType === 'tv'
                ? (items.length === 1 ? 'show saved' : 'shows saved')
                : (items.length === 1 ? 'movie saved' : 'movies saved')}
        </div>
    </Link>
);

const RING_R = 23;
const RING_C = 2 * Math.PI * RING_R;

// Movies tab: the franchise the viewer is part-way through. Opens the page that
// lists every franchise.
const FranchiseTile = ({ progress }) => (
    <Link to="/franchises" className="tile mini-tile short">
        <div className="tile-label">Franchise progress</div>
        <div className="mini-row" style={{ justifyContent: 'flex-start' }}>
            <svg className="ring" width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`${progress.watched} of ${progress.total} films watched`}>
                <circle className="ring-track" cx="28" cy="28" r={RING_R} strokeWidth="6" />
                <circle
                    className="ring-value"
                    cx="28"
                    cy="28"
                    r={RING_R}
                    strokeWidth="6"
                    strokeDasharray={`${(progress.watched / progress.total) * RING_C} ${RING_C}`}
                />
            </svg>
            <span className="mono" style={{ fontSize: '1.375rem', fontWeight: 600 }}>
                {progress.watched}/{progress.total}
            </span>
        </div>
        <div className="mini-tile-foot tile-sub">
            {progress.newFilm ? `New: ${progress.newFilm} is out` : progress.name}
        </div>
    </Link>
);

// Movies tab, when no franchise is under way.
const MoviesWatchedTile = ({ stats }) => (
    <Link to="/franchises" className="tile mini-tile short">
        <div className="tile-label">Movies watched</div>
        <div className="mini-row">
            <span className="big-num">{stats?.moviesWatched ?? 0}</span>
        </div>
        <div className="mini-tile-foot tile-sub">See your franchises</div>
    </Link>
);

// TV tab: how much of their shows the viewer has got through.
const EpisodesWatchedTile = ({ stats }) => (
    <Link to="/library" className="tile mini-tile short">
        <div className="tile-label">Episodes watched</div>
        <div className="mini-row">
            <span className="big-num">{(stats?.episodesWatched ?? 0).toLocaleString()}</span>
        </div>
        <div className="mini-tile-foot tile-sub">
            {stats?.showsWatched ?? 0} {stats?.showsWatched === 1 ? 'show' : 'shows'} finished
        </div>
    </Link>
);

// ---- Page ------------------------------------------------------------------

const Home = () => {
    const { user, stats, watchlist, watched, watchedTvIds, timeZone, markTitleWatched, isReminderSet } = useUser();
    const navigate = useNavigate();
    // Initialize from session storage if available, otherwise default to 'tv'
    // so a fresh visit lands on the first tab, TV.
    const [mediaType, setMediaType] = useState(() => sessionStorage.getItem('homeMediaType') || 'tv');
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    // Set when the trending request came back empty-handed, so the row can say
    // so and offer a retry instead of showing stand-in titles.
    const [trendingFailed, setTrendingFailed] = useState(false);
    const [retryKey, setRetryKey] = useState(0);
    const [recommendations, setRecommendations] = useState([]);
    const [recsLoading, setRecsLoading] = useState(false);

    const { releases } = useReleases();
    const franchise = useFranchiseProgress();

    // Persist mediaType to session storage whenever it changes
    useEffect(() => {
        sessionStorage.setItem('homeMediaType', mediaType);
    }, [mediaType]);

    // Seeds for personalized recommendations: the titles the user has saved for
    // the active tab. Titles already saved or watched are excluded from results.
    // Match media type the way the rest of the app does — legacy items saved
    // before `type` was stored default to 'movie' — so a watched movie or series
    // is reliably skipped from the recommendations instead of slipping through.
    // A series counts as watched from its episode ticks too, not just an explicit
    // "mark watched": someone who has worked through every season of a show has
    // clearly seen it, and proposing it back to them is noise.
    const recInputs = useMemo(() => {
        const seeds = watchlist.filter((item) => (item.type || 'movie') === mediaType);
        const excludeIds = new Set([
            ...seeds.map((item) => item.id),
            ...watched.filter((item) => (item.type || 'movie') === mediaType).map((item) => item.id),
            ...(mediaType === 'tv' ? watchedTvIds : []),
        ]);
        return { seeds, excludeIds };
    }, [watchlist, watched, watchedTvIds, mediaType]);

    const tvWatchlist = useMemo(() => watchlist.filter((item) => item.type === 'tv'), [watchlist]);
    const movieWatchlist = useMemo(
        () => watchlist.filter((item) => (item.type || 'movie') === 'movie'),
        [watchlist]
    );

    useEffect(() => {
        let active = true;
        const loadRecs = async () => {
            const { seeds, excludeIds } = recInputs;
            // Drop any stale picks (possibly from the other tab) before fetching.
            setRecommendations([]);
            if (seeds.length === 0) {
                setRecsLoading(false);
                return;
            }
            setRecsLoading(true);
            const recs = await getRecommendationsFromSeeds(seeds, mediaType, excludeIds);
            if (!active) return;
            setRecommendations(recs);
            setRecsLoading(false);
        };
        loadRecs();
        return () => { active = false; };
    }, [recInputs, mediaType]);

    useEffect(() => {
        let active = true;
        const loadMedia = async () => {
            setLoading(true);
            setTrendingFailed(false);
            // Whatever happens in here, the loading flag has to come back down:
            // an error that leaves it up strands the row on a skeleton forever.
            try {
                const data = mediaType === 'tv' ? await getTrendingTV() : await getTrendingMovies();
                // A quick tab switch can land the previous tab's response after
                // this one's — never let the stale list overwrite the fresh one.
                if (!active) return;

                if (data?.results?.length) {
                    // Ensure we tag them correctly before mapping
                    const taggedResults = data.results.map((item) => ({ ...item, media_type: mediaType }));
                    setMediaItems(taggedResults.map((item) => mapMediaData(item, timeZone)));
                } else {
                    setMediaItems([]);
                    setTrendingFailed(true);
                }
            } catch (error) {
                console.error('Error loading trending titles:', error);
                if (!active) return;
                setMediaItems([]);
                setTrendingFailed(true);
            } finally {
                if (active) setLoading(false);
            }
        };
        loadMedia();
        return () => { active = false; };
    }, [mediaType, timeZone, retryKey]);

    const retryTrending = () => {
        clearTmdbCache();
        setRetryKey((k) => k + 1);
    };

    // No full-page loading gate: the header and the tiles don't depend on the
    // trending request, so only the trending row itself waits, as a skeleton.
    const trendingPending = loading && mediaItems.length === 0;

    // ---- The week ahead, in the viewer's zone ----
    const today = todayKey(timeZone);
    const week = useMemo(() => weekFrom(today), [today]);
    const weekKeys = useMemo(() => new Set(week.map((d) => d.key)), [week]);
    // Everything on this page follows the TV / Movies toggle, releases included:
    // the TV tab counts down to episodes, the Movies tab to films.
    const upcoming = useMemo(
        () => releases.filter((r) => !r.air.hasAired && (r.type || 'movie') === mediaType),
        [releases, mediaType]
    );
    const typedWatchlist = mediaType === 'tv' ? tvWatchlist : movieWatchlist;
    const releaseDays = useMemo(() => new Set(upcoming.map((r) => r.air.dateKey)), [upcoming]);
    const nextRelease = upcoming[0] || null;

    // The two progress tiles appear once there is something of this kind to
    // count: a saved title, or history.
    const showProgressRow = typedWatchlist.length > 0
        || (mediaType === 'tv' ? (stats?.episodesWatched ?? 0) > 0 : (stats?.moviesWatched ?? 0) > 0);

    const dateLine = formatZonedDate(new Date(), timeZone, { weekday: 'long', day: 'numeric', month: 'long' });
    const noun = mediaType === 'movie' ? 'movies' : 'shows';
    const open = (item) => navigate(`/${item.type}/${item.id}`);

    return (
        <div className="container page">
            <header className="home-header">
                <div>
                    <p className="page-sub">{dateLine}</p>
                    <h1 className="page-title">Tonight</h1>
                </div>

                <div className="home-header-actions">
                    {/* Every tile below follows this toggle */}
                    <div className="seg compact" role="group" aria-label="Show TV or movies">
                        {MEDIA_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setMediaType(tab.id)}
                                className={`seg-btn ${mediaType === tab.id ? 'active' : ''}`}
                                aria-pressed={mediaType === tab.id}
                            >
                                {tab.label}
                                {mediaType === tab.id && (
                                    <motion.span
                                        layoutId="homeMediaTab"
                                        className="seg-thumb"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                    <Link to="/profile" className="top-bar-btn home-avatar" aria-label="Profile">
                        <img src={user?.avatar || DEFAULT_AVATAR} alt="" />
                    </Link>
                </div>
            </header>

            <nav className="week-strip" aria-label="The next seven days">
                {week.map((d) => {
                    const hasRelease = releaseDays.has(d.key);
                    return (
                        <Link
                            key={d.key}
                            to="/calendar"
                            className={`week-day ${d.key === today ? 'today' : ''} ${hasRelease ? 'has-release' : ''}`}
                            aria-label={`${d.name} ${d.day}${hasRelease ? (mediaType === 'tv' ? ', episodes airing' : ', movies out') : ''}`}
                        >
                            <span className="week-day-name">{d.name}</span>
                            <span className="week-day-num">{d.day}</span>
                            <span className="week-day-dot" />
                        </Link>
                    );
                })}
            </nav>

            <div className="bento">
                {mediaType === 'tv'
                    ? <TvUpNextTile series={tvWatchlist} />
                    : <MovieUpNextTile movies={movieWatchlist} timeZone={timeZone} onWatched={markTitleWatched} />}

                <NextReleaseTile
                    release={nextRelease}
                    timeZone={timeZone}
                    reminderOn={Boolean(nextRelease) && isReminderSet(nextRelease.id, nextRelease.type)}
                    mediaType={mediaType}
                />
                <ThisWeekTile releases={upcoming} weekKeys={weekKeys} timeZone={timeZone} mediaType={mediaType} />

                {/* "What's Next?" — answers the app's namesake question */}
                <WhatsNextSpotlight mediaType={mediaType} />

                {showProgressRow && <WatchlistTile items={typedWatchlist} mediaType={mediaType} />}
                {showProgressRow && (mediaType === 'tv'
                    ? <EpisodesWatchedTile stats={stats} />
                    : franchise
                        ? <FranchiseTile progress={franchise} />
                        : <MoviesWatchedTile stats={stats} />)}

                <section className="tile span-2 row-tile">
                    <div className="row-tile-head">
                        <h2 className="section-title">Trending {noun}</h2>
                        <Link to="/search" className="link-accent">See all</Link>
                    </div>

                    {trendingPending ? (
                        <PosterRowSkeleton />
                    ) : trendingFailed ? (
                        <div className="row-error">
                            <p>Couldn't load trending titles right now.</p>
                            <button type="button" className="pill-btn" onClick={retryTrending}>
                                <RefreshCw size={16} aria-hidden="true" /> Try again
                            </button>
                        </div>
                    ) : (
                        <PosterRow>
                            {mediaItems.map((item) => (
                                <PosterButton key={item.id} item={item} onOpen={open} />
                            ))}
                        </PosterRow>
                    )}
                </section>

                {/* Recommended For You - built from the user's saved list for this tab */}
                {recInputs.seeds.length > 0 && (recsLoading || recommendations.length > 0) && (
                    <section className="tile span-2 row-tile">
                        <div className="row-tile-head">
                            <h2 className="section-title">Recommended for you</h2>
                        </div>
                        <p className="row-tile-sub">Based on the {noun} in your list</p>

                        {recsLoading && recommendations.length === 0 ? (
                            <PosterRowSkeleton />
                        ) : (
                            <PosterRow>
                                {recommendations.map((item) => (
                                    <PosterButton key={item.id} item={item} onOpen={open} />
                                ))}
                            </PosterRow>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
};

export default Home;
