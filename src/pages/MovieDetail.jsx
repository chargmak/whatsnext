import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Plus, Check, Share2, Bell, Star, X, Film, Copy, Users } from 'lucide-react';
import { getDetails, mapMediaData, getTVSeasonDetails } from '../services/tmdb';
import { TRENDING_MOVIES } from '../data/mockData';
import { useUser } from '../context/UserContext';


// Mock Friends Data
const MOCK_FRIENDS = [
    { id: 1, name: "Sarah", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah", status: "online" },
    { id: 2, name: "Mike", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike", status: "offline" },
    { id: 3, name: "Jessica", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica", status: "online" }
];

// Reusable Detail Component (handles both Movie and TV)
const MediaDetail = ({ type }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [item, setItem] = useState(null);
    const [showPartyModal, setShowPartyModal] = useState(false);
    const [showTrailer, setShowTrailer] = useState(false);
    const [loading, setLoading] = useState(true);
    const [partyLink, setPartyLink] = useState('');
    const [invitedFriends, setInvitedFriends] = useState([]);
    const [copied, setCopied] = useState(false);
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);

    useEffect(() => {
        if (showPartyModal && !partyLink) {
            // Generate unique party link
            const uniqueId = Math.random().toString(36).substring(7);
            setPartyLink(`https://whatsnext.app/party/${uniqueId}`);
        }
    }, [showPartyModal]);

    const handleCopy = () => {
        navigator.clipboard.writeText(partyLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const toggleInvite = (friendId) => {
        if (invitedFriends.includes(friendId)) {
            setInvitedFriends(invitedFriends.filter(id => id !== friendId));
        } else {
            setInvitedFriends([...invitedFriends, friendId]);
        }
    };

    const { addToWatchlist, watchlist, markAsWatched, watched, removeFromWatched, toggleEpisodeWatched, isEpisodeWatched, getWatchedEpisodeCount } = useUser();

    // Fetch episodes for TV series
    useEffect(() => {
        if (type === 'tv' && item && item.seasons > 0) {
            const fetchEpisodes = async () => {
                setLoadingEpisodes(true);
                const seasonData = await getTVSeasonDetails(id, selectedSeason);
                if (seasonData && seasonData.episodes) {
                    setSeasons(prev => ({
                        ...prev,
                        [selectedSeason]: seasonData.episodes
                    }));
                }
                setLoadingEpisodes(false);
            };
            fetchEpisodes();
        }
    }, [type, item, selectedSeason, id]);

    useEffect(() => {
        const fetchDetail = async () => {
            // Get user's country from profile
            const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
            const userCountry = userProfile.country || 'US'; // Default to US if not set

            const tmdbData = await getDetails(id, type, userCountry);

            if (tmdbData) {
                const mapped = mapMediaData({ ...tmdbData, media_type: type });
                setItem({
                    ...mapped,
                    trailerKey: tmdbData.trailerKey,
                    credits: tmdbData.credits,
                    streaming: tmdbData.providers?.flatrate?.map(p => ({
                        name: p.provider_name,
                        logo: `https://image.tmdb.org/t/p/original${p.logo_path}`
                    })) || []
                });
            } else {
                // Fallback
                const mock = TRENDING_MOVIES.find(m => m.id === parseInt(id));
                setItem(mock);
            }
            setLoading(false);
        };

        fetchDetail();
    }, [id, type]);

    if (loading) return <div className="container flex-center" style={{ height: '100vh' }}>Loading...</div>;
    if (!item) return <div className="container flex-center" style={{ height: '100vh' }}>Media not found</div>;

    const isInWatchlist = watchlist.some(m => m.id === item.id);
    const isWatched = watched.some(m => m.id === item.id);

    const calculateTimeLeft = () => {
        if (!item.upcoming || !item.releaseDate) return null;
        const difference = +new Date(item.releaseDate) - +new Date();
        if (difference > 0) {
            return {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
            };
        }
        return null;
    };

    const timeLeft = calculateTimeLeft();

    return (
        <div style={{ paddingBottom: '100px', background: 'var(--bg-primary)', minHeight: '100vh' }}>
            {/* Hero Header */}
            <div style={{ position: 'relative', height: '50vh' }}>
                <img
                    src={item.backdrop || item.poster}
                    alt={item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), var(--bg-primary))'
                }} />

                <button
                    onClick={() => navigate(-1)}
                    className="top-bar-btn"
                    style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 20 }}
                >
                    <ArrowLeft size={24} />
                </button>

                {/* Play Trailer Button (Hero Overlay) */}
                {item.trailerKey && (
                    <button
                        onClick={() => setShowTrailer(true)}
                        style={{
                            position: 'absolute',
                            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            background: 'rgba(239, 68, 68, 0.9)', // Brand red with transparency
                            border: 'none', borderRadius: '50%',
                            width: '64px', height: '64px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 0 20px rgba(220, 38, 38, 0.6)',
                            zIndex: 10
                        }}
                    >
                        <Play size={28} fill="white" color="white" style={{ marginLeft: '4px' }} />
                    </button>
                )}
            </div>

            <div className="container" style={{ marginTop: '-80px', position: 'relative', zIndex: 10 }}>
                {/* Title & Stats */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                >
                    <h1 style={{ fontSize: '2.5rem', lineHeight: 1.1, marginBottom: '10px', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                        {item.title}
                    </h1>

                    <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '16px', marginBottom: '20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Star size={16} fill="currentColor" /> {item.rating}
                        </span>
                        <span>{item.year}</span>
                        {item.type === 'tv' ? (
                            <span>{item.seasons} Seasons • {item.episodes} Eps</span>
                        ) : (
                            <span>{item.runtime}</span>
                        )}

                    </div>

                    {/* Action Grid */}
                    <div className="action-grid" style={{ gridTemplateColumns: type === 'tv' ? '1fr 1fr 1fr' : '2fr 1fr 1fr 1fr' }}>
                        {type === 'movie' && (
                            item.upcoming ? (
                                <button className="action-btn secondary" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                    Not Released
                                </button>
                            ) : (
                                <button
                                    className={`action-btn ${isWatched ? 'secondary' : 'primary'}`}
                                    onClick={() => isWatched ? removeFromWatched(item) : markAsWatched(item)}
                                >
                                    <Check size={24} />
                                    <span>{isWatched ? 'Watched' : 'Mark Watched'}</span>
                                </button>
                            )
                        )}

                        <button
                            className={`action-btn ${isInWatchlist ? 'active' : 'secondary'}`}
                            onClick={() => isInWatchlist ? removeFromWatchlist(item.id) : addToWatchlist(item)}
                        >
                            {isInWatchlist ? <Check size={24} /> : <Plus size={24} />}
                            <span>My List</span>
                        </button>

                        {/* Secondary Trailer Button */}
                        <button
                            className="action-btn secondary"
                            disabled={!item.trailerKey}
                            style={{ opacity: item.trailerKey ? 1 : 0.3 }}
                            onClick={() => item.trailerKey && setShowTrailer(true)}
                        >
                            <Film size={24} />
                            <span>Trailer</span>
                        </button>

                        <button
                            className="action-btn secondary"
                            onClick={() => setShowPartyModal(true)}
                        >
                            <Share2 size={24} />
                            <span>Share</span>
                        </button>
                    </div>

                    <p style={{ lineHeight: 1.6, fontSize: '1rem', color: '#ccc' }}>{item.plot || "No overview available."}</p>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '20px 0' }}>
                        {item.genres?.map(g => (
                            <span key={g} className="meta-tag">
                                {g}
                            </span>
                        ))}
                    </div>


                    {/* Cast Section */}
                    {item.credits && item.credits.length > 0 && (
                        <div style={{ marginTop: '30px', marginBottom: '30px' }}>
                            <h3 style={{ marginBottom: '16px' }}>Cast</h3>
                            <div style={{
                                display: 'flex',
                                gap: '16px',
                                overflowX: 'auto',
                                paddingBottom: '16px',
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none'
                            }}>
                                {item.credits.map((actor) => (
                                    <div key={actor.id} style={{ minWidth: '100px', textAlign: 'center' }}>
                                        <img
                                            src={actor.profile_path
                                                ? `https://image.tmdb.org/t/p/w200${actor.profile_path}`
                                                : 'https://via.placeholder.com/200x300?text=No+Img'}
                                            alt={actor.name}
                                            style={{
                                                width: '100px',
                                                height: '100px',
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                border: '2px solid var(--bg-tertiary)',
                                                marginBottom: '8px'
                                            }}
                                        />
                                        <p style={{ fontSize: '0.85rem', fontWeight: '600', margin: 0 }}>{actor.name}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{actor.character}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Episodes Section - TV Series Only */}
                    {type === 'tv' && item.seasons > 0 && (
                        <div style={{ marginTop: '30px', marginBottom: '30px' }}>
                            <div className="flex-between" style={{ marginBottom: '16px' }}>
                                <h3>Episodes</h3>
                                <select
                                    value={selectedSeason}
                                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                    className="input-field"
                                    style={{ width: 'auto', padding: '8px 12px' }}
                                >
                                    {Array.from({ length: item.seasons }, (_, i) => i + 1).map(seasonNum => (
                                        <option key={seasonNum} value={seasonNum}>Season {seasonNum}</option>
                                    ))}
                                </select>
                            </div>

                            {loadingEpisodes ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                                    Loading episodes...
                                </div>
                            ) : seasons[selectedSeason] ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {seasons[selectedSeason].map((episode) => {
                                        const isWatchedEp = isEpisodeWatched(item.id, selectedSeason, episode.episode_number);
                                        return (
                                            <div
                                                key={episode.id}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    console.log('Toggling episode:', item.id, selectedSeason, episode.episode_number);
                                                    toggleEpisodeWatched(item.id, selectedSeason, episode.episode_number);
                                                }}
                                                className="glass-panel"
                                                style={{
                                                    padding: '12px 16px',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '12px',
                                                    transition: 'all 0.2s',
                                                    border: `1px solid ${isWatchedEp ? 'var(--brand-600)' : 'rgba(255,255,255,0.05)'}`,
                                                    opacity: isWatchedEp ? 0.7 : 1
                                                }}
                                            >
                                                <div style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '50%',
                                                    border: `2px solid ${isWatchedEp ? 'var(--brand-600)' : 'var(--text-secondary)'}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: isWatchedEp ? 'var(--brand-600)' : 'transparent',
                                                    flexShrink: 0,
                                                    marginTop: '2px'
                                                }}>
                                                    {isWatchedEp && <Check size={14} color="white" strokeWidth={3} />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        fontWeight: '600',
                                                        marginBottom: '4px',
                                                        wordWrap: 'break-word',
                                                        overflowWrap: 'break-word'
                                                    }}>
                                                        {episode.episode_number}. {episode.name}
                                                    </div>
                                                    {episode.overview && (
                                                        <div style={{
                                                            fontSize: '0.85rem',
                                                            color: 'var(--text-secondary)',
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden',
                                                            wordWrap: 'break-word',
                                                            overflowWrap: 'break-word',
                                                            lineHeight: '1.4'
                                                        }}>
                                                            {episode.overview}
                                                        </div>
                                                    )}
                                                </div>
                                                {episode.runtime && (
                                                    <span style={{
                                                        color: 'var(--text-secondary)',
                                                        fontSize: '0.85rem',
                                                        flexShrink: 0,
                                                        marginTop: '2px'
                                                    }}>
                                                        {episode.runtime}min
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                                    No episodes found for this season
                                </div>
                            )}
                        </div>
                    )}

                    {/* Streaming & Countdown */}
                    {item.upcoming && timeLeft ? (
                        <div className="glass-panel" style={{
                            padding: '24px', borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--brand-600)', marginTop: '20px', textAlign: 'center',
                            boxShadow: '0 4px 20px rgba(220, 38, 38, 0.2)'
                        }}>
                            <h3 style={{ color: 'var(--brand-600)' }}>
                                {item.type === 'tv' ? 'New Episode Airs In' : 'Movie Premiere In'}
                            </h3>
                            <div className="flex-center" style={{ gap: '24px', marginTop: '16px', marginBottom: '16px' }}>
                                <div>
                                    <span style={{ fontSize: '2.5rem', fontWeight: '800', lineHeight: 1 }}>{timeLeft.days}</span>
                                    <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>DAYS</p>
                                </div>
                                <div style={{ width: '1px', height: '40px', background: 'var(--bg-tertiary)' }}></div>
                                <div>
                                    <span style={{ fontSize: '2.5rem', fontWeight: '800', lineHeight: 1 }}>{timeLeft.hours}</span>
                                    <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>HOURS</p>
                                </div>
                            </div>
                            <button className="btn" style={{ width: '100%' }}>
                                <Bell size={18} style={{ marginRight: '8px' }} /> Notify Me
                            </button>
                        </div>
                    ) : (
                        <div style={{ marginTop: '0px' }}>
                            <h3 style={{ marginBottom: '16px' }}>Where to Watch</h3>

                            {item.streaming && item.streaming.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                                    {item.streaming.map((service, idx) => (
                                        <div key={idx} className="glass-panel" style={{
                                            display: 'flex', alignItems: 'center', gap: '16px',
                                            padding: '16px',
                                            borderRadius: '16px'
                                        }}>
                                            <img
                                                src={service.logo}
                                                alt={service.name}
                                                style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }}
                                            />
                                            <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>{service.name}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="glass-panel" style={{
                                    padding: '24px',
                                    borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)',
                                    textAlign: 'center', color: 'var(--text-secondary)'
                                }}>
                                    <p style={{ margin: 0 }}>Not currently available for streaming.</p>
                                </div>
                            )}
                        </div>
                    )}

                </motion.div>
            </div>

            {/* Trailer Modal */}
            <AnimatePresence>
                {showTrailer && item.trailerKey && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 3000,
                            background: 'rgba(0,0,0,0.95)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '20px'
                        }}
                    >
                        <button
                            onClick={() => setShowTrailer(false)}
                            style={{
                                position: 'absolute', top: '20px', right: '20px',
                                background: 'white', border: 'none', borderRadius: '50%',
                                width: '40px', height: '40px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <X size={24} color="black" />
                        </button>

                        <div style={{ width: '100%', maxWidth: '900px', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 0 30px rgba(255,255,255,0.1)' }}>
                            <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${item.trailerKey}?autoplay=1`}
                                title="Trailer"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Watch Party Modal */}
            <AnimatePresence>
                {showPartyModal && (
                    <div className="modal-overlay" onClick={() => setShowPartyModal(false)}>
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            onClick={(e) => e.stopPropagation()}
                            className="modal-content"
                        >
                            <div className="modal-handle" />
                            <h3 style={{ marginBottom: '8px' }}>Start a Watch Party</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                                Watch <strong>{item.title}</strong> with your friends in sync.
                            </p>

                            {/* Link Copy Section */}
                            <div style={{
                                background: 'rgba(255,255,255,0.05)',
                                padding: '12px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '24px',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <div style={{
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontSize: '0.9rem',
                                    color: 'var(--text-primary)'
                                }}>
                                    {partyLink}
                                </div>
                                <button
                                    onClick={handleCopy}
                                    style={{
                                        background: copied ? 'var(--brand-600)' : 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        color: 'white'
                                    }}
                                >
                                    {copied ? <Check size={18} /> : <Copy size={18} />}
                                </button>
                            </div>

                            <h4 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>Invite Friends</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                                {MOCK_FRIENDS.map(friend => (
                                    <div key={friend.id} className="flex-between" style={{
                                        padding: '12px',
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <div className="flex-center" style={{ gap: '12px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <img src={friend.avatar} alt={friend.name} style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                                                <div style={{
                                                    position: 'absolute', bottom: 0, right: 0,
                                                    width: '10px', height: '10px', borderRadius: '50%',
                                                    background: friend.status === 'online' ? '#10b981' : '#6b7280',
                                                    border: '2px solid var(--bg-secondary)'
                                                }} />
                                            </div>
                                            <span style={{ fontWeight: '500' }}>{friend.name}</span>
                                        </div>
                                        <button
                                            onClick={() => toggleInvite(friend.id)}
                                            style={{
                                                background: invitedFriends.includes(friend.id) ? 'rgba(255,255,255,0.1)' : 'var(--brand-600)',
                                                color: invitedFriends.includes(friend.id) ? 'var(--text-secondary)' : 'white',
                                                border: 'none',
                                                padding: '6px 16px',
                                                borderRadius: '20px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                                fontWeight: '600',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {invitedFriends.includes(friend.id) ? 'Sent' : 'Invite'}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                className="btn"
                                style={{ width: '100%', gap: '8px' }}
                                onClick={() => {
                                    setShowPartyModal(false);
                                    // Could navigate to a party room or show a success toast here
                                }}
                            >
                                <Users size={20} /> Start Party ({invitedFriends.length + 1})
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MediaDetail;
