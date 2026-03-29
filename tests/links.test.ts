// @ts-ignore
import { describe, it, expect } from 'vitest';

describe('Link Validation Tests', () => {

    it('validates Spotify links correctly', () => {
        // We want to extract the track ID correctly from common Spotify URLs.
        const extractSpotifyTrackId = (url: string) => {
            const match = url.match(/track[\/:]([a-zA-Z0-9_-]+)/);
            return match ? match[1] : null;
        };

        const stdUrl = 'https://open.spotify.com/track/1G391cbiT3v3Cywg8T7DM1?si=abc';
        const intlUrl = 'https://open.spotify.com/intl-de/track/1G391cbiT3v3Cywg8T7DM1?si=e1d91c6c490540c5';
        const uriUrl = 'spotify:track:1G391cbiT3v3Cywg8T7DM1';

        expect(extractSpotifyTrackId(stdUrl)).toBe('1G391cbiT3v3Cywg8T7DM1');
        expect(extractSpotifyTrackId(intlUrl)).toBe('1G391cbiT3v3Cywg8T7DM1');
        expect(extractSpotifyTrackId(uriUrl)).toBe('1G391cbiT3v3Cywg8T7DM1');
    });

    it('validates YouTube links correctly', () => {
        const extractYouTubeId = (url: string) => {
            let match = url.match(/v=([a-zA-Z0-9_-]+)/);
            if (match) return match[1];

            match = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
            if (match) return match[1];

            return null;
        };

        const longUrl = 'https://www.youtube.com/watch?v=mLWP84ktoN4&list=abc';
        const shortUrl = 'https://youtu.be/mLWP84ktoN4?t=12';

        expect(extractYouTubeId(longUrl)).toBe('mLWP84ktoN4');
        expect(extractYouTubeId(shortUrl)).toBe('mLWP84ktoN4');
    });
});
