import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Tv } from 'lucide-react';
import { useUpNext } from '../hooks/useUpNext';
import { PRECISION, describeRelease } from '../services/releaseTime';

// "Aired today at 9:00 PM" — the resolved moment in the viewer's own clock, with
// a ~ when the hour is a prime-time estimate rather than a published drop time.
// eslint-disable-next-line react-refresh/only-export-components
export const formatAired = (ep) => {
    if (!ep.air) return ep.airDate || '';
    const text = describeRelease(ep.air, { verb: 'air' });
    return ep.air.precision === PRECISION.ESTIMATED ? text.replace(' at ', ' at ~') : text;
};

// The next unwatched, already-aired episode for each series in the user's list —
// one card per show, most recently watched first (see useUpNext). Marking an
// episode here advances that show to its following episode in place. `limit`
// trims the list to its first N entries.
const UpNext = ({ series, limit }) => {
    const navigate = useNavigate();
    const { loading, items, busyId, markWatched } = useUpNext(series, limit);

    if (series.length === 0) {
        return (
            <div className="empty-state">
                <Tv size={40} aria-hidden="true" style={{ opacity: 0.4, marginBottom: '12px' }} />
                <p>No TV shows in your list yet.</p>
                <button className="btn" style={{ marginTop: '10px' }} onClick={() => navigate('/search')}>
                    Find shows to watch
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="empty-state">
                Finding your next episodes…
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="empty-state">
                <Check size={40} aria-hidden="true" style={{ opacity: 0.4, marginBottom: '12px' }} />
                <p>You're all caught up!</p>
                <p style={{ fontSize: '0.875rem', marginBottom: 0 }}>
                    Every aired episode from the shows in your list has been watched.
                </p>
            </div>
        );
    }

    return (
        <div className="upnext-list">
            {items.map(({ show, ep }) => (
                <motion.div
                    key={show.id}
                    layout
                    className="upnext-card"
                    onClick={() => navigate(`/tv/${show.id}`)}
                >
                    <img
                        src={ep.still || ep.poster}
                        alt={show.title}
                        loading="lazy"
                        className={`upnext-still ${ep.still ? '' : 'is-poster'}`}
                    />

                    <div className="upnext-body">
                        <div className="upnext-show">{ep.title}</div>
                        <div className="upnext-code">S{ep.seasonNumber} · E{ep.episodeNumber}</div>
                        <div className="upnext-episode">{ep.episodeName}</div>
                        {ep.airDate && <div className="upnext-aired">{formatAired(ep)}</div>}
                    </div>

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            markWatched(show, ep);
                        }}
                        disabled={busyId === show.id}
                        title="Mark this episode watched"
                        aria-label={`Mark ${show.title} S${ep.seasonNumber}E${ep.episodeNumber} watched`}
                        className="upnext-btn"
                    >
                        <Check size={18} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                </motion.div>
            ))}
        </div>
    );
};

export default UpNext;
