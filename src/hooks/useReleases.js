import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { getTVShowWithEpisodes, getTVSeasonDetails, getMovieReleaseForCountry } from '../services/tmdb';
import {
    getShowReleaseRule,
    movieReleaseRule,
    resolveReleaseTime,
    viewerDayRule,
} from '../services/releaseTime';

// How far back the list keeps already-aired entries, so browsing the current or
// previous month shows what has happened rather than an empty page.
const PAST_WINDOW_DAYS = 60;

// The gap until a release, at whatever granularity still says something useful.
export const countdownText = (air) => {
    const { days, hours, minutes, passed } = air.countdown;
    if (passed) return '';
    if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`;
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
};

/**
 * Every dated release in the viewer's watchlist — episodes of the shows they
 * follow and the movies they've saved — resolved to a real moment in their own
 * clock and sorted soonest first. Shared by the Calendar and the Home tiles so
 * both agree on what is coming and when.
 *
 * Each entry is the watchlist item plus `air` (see resolveReleaseTime); episode
 * entries also carry showTitle / episodeTitle / seasonNumber / episodeNumber.
 */
export const useReleases = () => {
    const { watchlist, user, timeZone } = useUser();
    const country = user?.country || 'US';
    const [state, setState] = useState({ releases: [], loading: true });

    useEffect(() => {
        let active = true;

        const load = async () => {
            setState((s) => ({ ...s, loading: true }));
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
                        .filter((s) => s.season_number !== 0 && s.episode_count)
                        .slice(0, 2);

                    const seasonResults = await Promise.all(
                        relevantSeasons.map((season) =>
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
                                episodeNumber: episode.episode_number,
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
            setState({ releases: all, loading: false });
        };

        load();
        return () => { active = false; };
    }, [watchlist, timeZone, country]);

    return state;
};
