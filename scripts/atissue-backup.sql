-- atissue Database Backup
-- Created: 2026-03-31T10:45:15.715Z

PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS users;
CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at INTEGER NOT NULL
    , sort_order INTEGER NOT NULL DEFAULT 0, is_hidden INTEGER NOT NULL DEFAULT 0, beer_count INTEGER NOT NULL DEFAULT 0);
INSERT INTO users (id, name, email, role, created_at, sort_order, is_hidden, beer_count) VALUES (1, 'Chris Admin', 'schneider.chris@gmx.de', 'admin', 1774085091233, 1, 1, 0);
INSERT INTO users (id, name, email, role, created_at, sort_order, is_hidden, beer_count) VALUES (2, 'Andre', 'andrehoyer.ah@googlemail.com', 'user', 1774085091233, 2, 0, 0);
INSERT INTO users (id, name, email, role, created_at, sort_order, is_hidden, beer_count) VALUES (3, 'Stefan', 'streu79@googlemail.com', 'user', 1774085091233, 3, 0, 0);
INSERT INTO users (id, name, email, role, created_at, sort_order, is_hidden, beer_count) VALUES (4, 'Andreas', 'aschulzebw@googlemail.com', 'user', 1774085091233, 4, 0, 0);
INSERT INTO users (id, name, email, role, created_at, sort_order, is_hidden, beer_count) VALUES (5, 'Daniel', 'd.vollkommer@gmail.com', 'user', 1774085091233, 0, 0, 0);
INSERT INTO users (id, name, email, role, created_at, sort_order, is_hidden, beer_count) VALUES (6, 'Chris', 'christian.familie.schneider@gmail.com', 'user', 1774087137000, 5, 0, 0);

DROP TABLE IF EXISTS calendar_events;
CREATE TABLE calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'rehearsal',
        user_id INTEGER REFERENCES users(id),
        created_at INTEGER NOT NULL
    , bierwart_override_id INTEGER REFERENCES users(id), is_tentative INTEGER NOT NULL DEFAULT 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (1, 'Bandprobe #1', '**André und Daniel nicht da**.

* Vorbereitung des Probenwochenendes
* Song-Voting durchgehen

', 1774551600000, 1774562400000, 'rehearsal', NULL, 1774085091000, 5, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (2, 'Bandprobe #2', 'Probe und Bierverkostung', 1775152800000, 1775163600000, 'rehearsal', NULL, 1774085091000, 5, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (3, 'Bandprobe #3', 'Probe und Bierverkostung', 1775757600000, 1775768400000, 'rehearsal', NULL, 1774085091000, NULL, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (4, 'Bandprobe #4', 'Probe und Bierverkostung', 1776362400000, 1776373200000, 'rehearsal', NULL, 1774085091000, NULL, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (6, 'Bandprobe #6', 'Probe und Bierverkostung', 1777572000000, 1776718800000, 'rehearsal', NULL, 1774085091000, NULL, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (7, 'Bandprobe #7', 'Probe und Bierverkostung', 1778176800000, 1778187600000, 'rehearsal', NULL, 1774085091000, NULL, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (8, 'Bandprobe #8', 'Probe und Bierverkostung', 1778781600000, 1778792400000, 'rehearsal', NULL, 1774085091000, NULL, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (9, 'Bandprobe #9', 'Probe und Bierverkostung', 1779386400000, 1779397200000, 'rehearsal', NULL, 1774085091000, NULL, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (10, 'Bandprobe #10', 'Probe und Bierverkostung', 1779991200000, 1780002000000, 'rehearsal', NULL, 1774085091000, NULL, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (11, 'Gartenhallenbad', 'Party im Gartenhallenbad', 1785610800000, 1786485600000, 'gig', NULL, 1774085091000, NULL, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (12, 'The Barn', 'Aidlingen', 1781298000000, 1781229600000, 'gig', NULL, 1774085091000, NULL, 1);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (13, 'Daniel nicht da', NULL, 1774548000000, 1774555200000, 'unavailability', 5, 1774090038000, NULL, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (14, 'Andre nicht da', NULL, 1774548000000, 1774555200000, 'unavailability', 2, 1774090053000, NULL, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (15, 'Probenwochenende', '# Probenwochenende

## 2 neue Songs Auftrittsreif 
XX 
YY

## Bisheriges Set stabilisieren.

## Video Material erstellen', 1777021200000, 1777233600000, 'event', NULL, 1774110920000, NULL, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (16, 'Bandprobe ', NULL, 1776967200000, 1776978000000, 'rehearsal', NULL, 1774209568000, NULL, 0);
INSERT INTO calendar_events (id, title, description, start_time, end_time, type, user_id, created_at, bierwart_override_id, is_tentative) VALUES (18, 'Daniel nicht da', NULL, 1775145600000, 1775152800000, 'unavailability', 5, 1774212781000, NULL, 0);

DROP TABLE IF EXISTS songs;
CREATE TABLE songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        spotify_url TEXT,
        youtube_url TEXT,
        thumbnail_url TEXT,
        notes TEXT,
        type TEXT NOT NULL DEFAULT 'song',
        pitch INTEGER NOT NULL DEFAULT 0,
        is_setlist INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        added_by INTEGER REFERENCES users(id),
        created_at INTEGER NOT NULL
    );
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (1, 'Holiday', 'Green Day', 'https://open.spotify.com/intl-de/track/5vfjUAhefN7IjHbTvVCT4Z?si=4ab5dfb87a1d44cd', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021bb1db39abc18755d7ab2114', 'Schneller als original ...', 'song', 1, 1, 0, 0, NULL, 1774085091233);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (2, 'Schrei nach Liebe', 'Die Ärzte', 'https://open.spotify.com/intl-de/track/4P4PHxZQ1FcwQKKnfEPsAZ?si=68958f13905f4bca', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e029510c262f77afc125df888b8', NULL, 'song', 0, 1, 5, 0, NULL, 1774085091233);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (3, 'Bad Guy', 'The Interrupters', 'https://open.spotify.com/intl-de/track/0iM1Ioz4N4p7MU1DKyqsov?si=1982a2ec6d844df5', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a33fad32ad43b17010154e0a', 'Schneller, härter, lauter

und besser', 'song', -1, 1, 16, 0, NULL, 1774085091233);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (4, 'Countdown To Insanity', 'H-Blockx', 'https://open.spotify.com/intl-de/track/2XNaKS5wO5rPdgpPYVKria?si=f2c3a6dc0d144782', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02f5c00b94871fd0d1a588c720', NULL, 'song', 0, 1, 6, 0, NULL, 1774085091233);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (5, 'Down in the Past', 'Mando Diao', 'https://open.spotify.com/intl-de/track/2vx5Dc3Zxtd5yGDlh2pAAz?si=c19e003366684d9b', NULL, 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d77f5131e85a3164f9c3aeed', NULL, 'song', 0, 1, 1, 0, NULL, 1774085091233);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (6, 'Last Resort', 'Papa Roach', 'https://open.spotify.com/intl-de/track/5W8YXBz9MTIDyrpYaCg2Ky?si=3ae221d3b6234a7c', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02985bf5ede2fe4a048ee85f28', NULL, 'song', 0, 1, 13, 0, NULL, 1774085091233);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (7, 'Billie Jean', 'The Bates', 'https://open.spotify.com/intl-de/track/5RpBC0VsMMSRYJmSgUZqDu?si=6644d5bee27d45bb', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023ee17b646117e84b4c4a29b3', NULL, 'song', 0, 1, 7, 0, NULL, 1774085091233);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (8, 'Straight Up', 'Me first and the gimme gimmes', 'https://open.spotify.com/intl-de/track/73PzrTVxMl8kmoSvFYLpig?si=b50ba624beaa41d3', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0299cad47dcc59b21623f070e4', NULL, 'song', 0, 0, 8, 0, NULL, 1774085091233);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (10, 'Take Me Out', 'Franz Ferdinand', 'https://open.spotify.com/intl-de/track/20I8RduZC2PWMWTDCZuuAN?si=2ec0e818266942d2', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a5d1c06a8172d4861367953c', NULL, 'song', 0, 1, 17, 0, NULL, 1774085091233);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (12, 'Auf gute Freunde', 'Onkelz', 'https://open.spotify.com/intl-de/track/0oIVNEkOgvOU9yG9oW13xC?si=499a70e53db54846', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027634ec8f0599c66e26ef0456', NULL, 'song', 0, 0, 0, 0, NULL, 1774085091233);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (13, 'Punk Rock Song', 'Bad Religion', 'https://open.spotify.com/intl-de/track/5ACDC1gxAUXYDWherVKOiX?si=439480c519f24539', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0240b9a1ccf095a3456bf867c3', NULL, 'song', 0, 0, 0, 0, 1, 1774108732000);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (14, 'Rock & Roll Queen', 'The Subways', 'https://open.spotify.com/intl-de/track/1uNKzxSXBkPTngkASu10pl?si=97ef897778284a94', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e028e13e145ddb6ec23e30ad3be', NULL, 'song', 0, 1, 15, 0, 1, 1774109231000);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (15, 'Das geht ab - Rockversion', 'Die Atzen', 'https://open.spotify.com/intl-de/track/2P2kgRRvHflstcRHWC6v8n?si=ca0c541fa7474d6a', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023ff20a578e20595700ee76a5', NULL, 'song', 0, 0, 0, 0, 1, 1774109264000);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (16, 'Song 2', 'Blur', 'https://open.spotify.com/intl-de/track/3GfOAdcoc3X5GPiiXmpBjK?si=f4c76c9ad2c24277', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0234cbf7013afccc7df67fa43f', NULL, 'song', 0, 1, 14, 0, 1, 1774109305000);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (17, 'Word Up - Radio Mix', 'Gun', 'https://open.spotify.com/intl-de/track/17CWwbHJ2ThM5MXj90ObrS?si=d034ed1b5dbd44da', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0209294629757e5b8dad7fe4c4', NULL, 'song', 0, 1, 11, 0, 1, 1774109349000);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (18, 'She Hates Me', 'Puddle of mudd', 'https://open.spotify.com/intl-de/track/16DhvbuyvJob4Q9GHNYu2n?si=2c81fe4dbc3e427a', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0253cf4c30b11cf78c7bf6b793', NULL, 'song', 0, 1, 8, 0, 1, 1774109417000);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (19, 'Tage wie diese', 'Hosen', 'https://open.spotify.com/intl-de/track/2lYsCjTvXIHOqT8xSbK2jq?si=a711d36312754310', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02c48e81625cf3834bab6a9c39', 'Test', 'song', 0, 1, 9, 0, 1, 1774109455000);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (20, 'All The Small Things', 'Blink 182', 'https://open.spotify.com/intl-de/track/2m1hi0nfMR9vdGC8UcrnwU?si=a514a0148c3b4aad', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026da502e35a7a3e48de2b0f74', NULL, 'song', 0, 1, 10, 0, 1, 1774109486000);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (22, 'Wild World', 'Me first and the gimme gimmes', 'https://open.spotify.com/intl-de/track/4tRkMhIcM13KEVbfBfTpzx?si=40ea9e21f8dc499d', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0253841c42917c71bdb272a342', '', 'song', 0, 1, 12, 0, 1, 1774113030000);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (24, 'Change Tuning', 'Band', NULL, NULL, NULL, 'D', 'tuning', 0, 1, 19, 0, 1, 1774113069000);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (25, 'Pieces', 'Sum 41', 'https://open.spotify.com/track/1ibeKVCiXORhvUpMmtsQWq?si=qT61llyfS5GSkQZWGu7N4A', '', 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02cb38dd3dba8a0801bc1ee03a', '', 'song', 0, 1, 4, 0, 6, 1774125666000);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (26, 'Learn to Fly', 'Foo Fighters ', 'https://open.spotify.com/track/5OQsiBsky2k2kDKy2bX2eT?si=LWlpqaRlSjGkpgmGmVKMoA', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026c52084ed1f1748f213783b3', '', 'song', 0, 1, 2, 0, 6, 1774555979);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (27, 'Creep', 'Radiohead', 'https://open.spotify.com/track/70LcF31zb1H0PyJoS1Sx1r?si=W0MraeDTRCOkoeZrIpaF4Q', '', 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ec548c00d3ac2f10be73366d', '', 'song', 0, 1, 3, 0, 6, 1774556098);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (28, 'Bro Hymn - 2005 Remaster', 'Pennywise', 'https://open.spotify.com/track/2DgZjpyv2kEB8nIl6Xp0VJ?si=ynJLqtIERj6MqtdwyUPoeA', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a726951b88d883c7d8165cf4', '', 'song', 0, 1, 18, 0, 6, 1774556179);
INSERT INTO songs (id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at) VALUES (29, 'Sugar (Metal Version)', 'Umc', 'https://open.spotify.com/track/6PjEsKzAno74iCUu9wfGtO?si=VzWhcw-1SCaIcrwU7QrD8Q', '', 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e024947b1fa837f6b2f2756a006', '', 'song', 0, 0, 0, 0, 6, 1774602923);

DROP TABLE IF EXISTS votes;
CREATE TABLE votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id INTEGER NOT NULL REFERENCES songs(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        score INTEGER NOT NULL DEFAULT 0,
        comment TEXT,
        created_at INTEGER NOT NULL
    );
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (1, 1, 6, 3, NULL, 1774091304000);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (8, 25, 6, 3, NULL, 1774125670000);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (12, 8, 6, 2, NULL, 1774203297000);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (13, 10, 6, 3, NULL, 1774203401000);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (14, 12, 6, 3, NULL, 1774203404000);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (15, 13, 6, 3, NULL, 1774203406000);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (16, 15, 6, 3, NULL, 1774203407000);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (17, 13, 2, 2, NULL, 1774297419);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (18, 12, 2, 2, NULL, 1774297422);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (19, 10, 2, 3, NULL, 1774297432);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (20, 12, 3, 3, NULL, 1774459462);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (21, 13, 3, 3, NULL, 1774459464);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (22, 10, 3, 2, NULL, 1774459478);
INSERT INTO votes (id, song_id, user_id, score, comment, created_at) VALUES (23, 29, 6, 3, NULL, 1774602937);

DROP TABLE IF EXISTS rehearsal_songs;
CREATE TABLE rehearsal_songs (
        rehearsal_id INTEGER NOT NULL REFERENCES calendar_events(id),
        song_id INTEGER NOT NULL REFERENCES songs(id)
    );

PRAGMA foreign_keys=ON;
