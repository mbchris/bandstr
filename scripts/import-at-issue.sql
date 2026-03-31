BEGIN;

-- Re-import support: remove previous at issue band and all band-scoped data first.
DELETE FROM bands WHERE slug = 'at-issue';

INSERT INTO bands (name, slug, plan, created_at)
VALUES ('at issue', 'at-issue', 'free', now())
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name
RETURNING id;

CREATE TEMP TABLE at_issue_users (
  old_id integer PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  created_at bigint NOT NULL,
  sort_order integer NOT NULL,
  is_hidden boolean NOT NULL,
  beer_count integer NOT NULL
) ON COMMIT DROP;

INSERT INTO at_issue_users (old_id, name, email, role, created_at, sort_order, is_hidden, beer_count) VALUES
  (1, 'Chris Admin', 'schneider.chris@gmx.de', 'admin', 1774085091233, 1, true, 0),
  (2, 'Andre', 'andrehoyer.ah@googlemail.com', 'user', 1774085091233, 2, false, 0),
  (3, 'Stefan', 'streu79@googlemail.com', 'user', 1774085091233, 3, false, 0),
  (4, 'Andreas', 'aschulzebw@googlemail.com', 'user', 1774085091233, 4, false, 0),
  (5, 'Daniel', 'd.vollkommer@gmail.com', 'user', 1774085091233, 0, false, 0),
  (6, 'Chris', 'christian.familie.schneider@gmail.com', 'user', 1774087137000, 5, false, 0);

-- Upsert users by email to reuse existing accounts when available.
INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
SELECT
  'atissue-user-' || old_id,
  name,
  email,
  true,
  NULL,
  CASE WHEN created_at < 100000000000 THEN to_timestamp(created_at) ELSE to_timestamp(created_at / 1000.0) END,
  CASE WHEN created_at < 100000000000 THEN to_timestamp(created_at) ELSE to_timestamp(created_at / 1000.0) END
FROM at_issue_users
ON CONFLICT (email) DO UPDATE
SET
  name = EXCLUDED.name,
  updated_at = now();

CREATE TEMP TABLE at_issue_user_map (
  old_id integer PRIMARY KEY,
  user_id text NOT NULL
) ON COMMIT DROP;

INSERT INTO at_issue_user_map (old_id, user_id)
SELECT a.old_id, u.id
FROM at_issue_users a
JOIN "user" u ON u.email = a.email;

WITH target_band AS (
  SELECT id FROM bands WHERE slug = 'at-issue' LIMIT 1
)
INSERT INTO band_members (band_id, user_id, role, sort_order, is_hidden, beer_count, joined_at)
SELECT
  tb.id,
  um.user_id,
  CASE WHEN a.role = 'admin' THEN 'owner' ELSE 'member' END,
  a.sort_order,
  a.is_hidden,
  a.beer_count,
  CASE WHEN a.created_at < 100000000000 THEN to_timestamp(a.created_at) ELSE to_timestamp(a.created_at / 1000.0) END
FROM at_issue_users a
JOIN at_issue_user_map um ON um.old_id = a.old_id
CROSS JOIN target_band tb
ON CONFLICT (band_id, user_id) DO UPDATE
SET
  role = EXCLUDED.role,
  sort_order = EXCLUDED.sort_order,
  is_hidden = EXCLUDED.is_hidden,
  beer_count = EXCLUDED.beer_count;

CREATE TEMP TABLE at_issue_songs (
  old_id integer PRIMARY KEY,
  title text NOT NULL,
  artist text NOT NULL,
  spotify_url text,
  youtube_url text,
  thumbnail_url text,
  notes text,
  type text NOT NULL,
  pitch integer NOT NULL,
  is_setlist boolean NOT NULL,
  position integer NOT NULL,
  is_pinned boolean NOT NULL,
  added_by_old integer,
  created_at bigint NOT NULL
) ON COMMIT DROP;

INSERT INTO at_issue_songs (old_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by_old, created_at) VALUES
  (1, 'Holiday', 'Green Day', 'https://open.spotify.com/intl-de/track/5vfjUAhefN7IjHbTvVCT4Z?si=4ab5dfb87a1d44cd', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021bb1db39abc18755d7ab2114', 'Schneller als original ...', 'song', 1, true, 0, false, NULL, 1774085091233),
  (2, 'Schrei nach Liebe', 'Die Ärzte', 'https://open.spotify.com/intl-de/track/4P4PHxZQ1FcwQKKnfEPsAZ?si=68958f13905f4bca', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e029510c262f77afc125df888b8', NULL, 'song', 0, true, 5, false, NULL, 1774085091233),
  (3, 'Bad Guy', 'The Interrupters', 'https://open.spotify.com/intl-de/track/0iM1Ioz4N4p7MU1DKyqsov?si=1982a2ec6d844df5', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a33fad32ad43b17010154e0a', E'Schneller, härter, lauter\n\nund besser', 'song', -1, true, 16, false, NULL, 1774085091233),
  (4, 'Countdown To Insanity', 'H-Blockx', 'https://open.spotify.com/intl-de/track/2XNaKS5wO5rPdgpPYVKria?si=f2c3a6dc0d144782', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02f5c00b94871fd0d1a588c720', NULL, 'song', 0, true, 6, false, NULL, 1774085091233),
  (5, 'Down in the Past', 'Mando Diao', 'https://open.spotify.com/intl-de/track/2vx5Dc3Zxtd5yGDlh2pAAz?si=c19e003366684d9b', NULL, 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d77f5131e85a3164f9c3aeed', NULL, 'song', 0, true, 1, false, NULL, 1774085091233),
  (6, 'Last Resort', 'Papa Roach', 'https://open.spotify.com/intl-de/track/5W8YXBz9MTIDyrpYaCg2Ky?si=3ae221d3b6234a7c', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02985bf5ede2fe4a048ee85f28', NULL, 'song', 0, true, 13, false, NULL, 1774085091233),
  (7, 'Billie Jean', 'The Bates', 'https://open.spotify.com/intl-de/track/5RpBC0VsMMSRYJmSgUZqDu?si=6644d5bee27d45bb', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023ee17b646117e84b4c4a29b3', NULL, 'song', 0, true, 7, false, NULL, 1774085091233),
  (8, 'Straight Up', 'Me first and the gimme gimmes', 'https://open.spotify.com/intl-de/track/73PzrTVxMl8kmoSvFYLpig?si=b50ba624beaa41d3', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0299cad47dcc59b21623f070e4', NULL, 'song', 0, false, 8, false, NULL, 1774085091233),
  (10, 'Take Me Out', 'Franz Ferdinand', 'https://open.spotify.com/intl-de/track/20I8RduZC2PWMWTDCZuuAN?si=2ec0e818266942d2', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a5d1c06a8172d4861367953c', NULL, 'song', 0, true, 17, false, NULL, 1774085091233),
  (12, 'Auf gute Freunde', 'Onkelz', 'https://open.spotify.com/intl-de/track/0oIVNEkOgvOU9yG9oW13xC?si=499a70e53db54846', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027634ec8f0599c66e26ef0456', NULL, 'song', 0, false, 0, false, NULL, 1774085091233),
  (13, 'Punk Rock Song', 'Bad Religion', 'https://open.spotify.com/intl-de/track/5ACDC1gxAUXYDWherVKOiX?si=439480c519f24539', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0240b9a1ccf095a3456bf867c3', NULL, 'song', 0, false, 0, false, 1, 1774108732000),
  (14, 'Rock & Roll Queen', 'The Subways', 'https://open.spotify.com/intl-de/track/1uNKzxSXBkPTngkASu10pl?si=97ef897778284a94', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e028e13e145ddb6ec23e30ad3be', NULL, 'song', 0, true, 15, false, 1, 1774109231000),
  (15, 'Das geht ab - Rockversion', 'Die Atzen', 'https://open.spotify.com/intl-de/track/2P2kgRRvHflstcRHWC6v8n?si=ca0c541fa7474d6a', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023ff20a578e20595700ee76a5', NULL, 'song', 0, false, 0, false, 1, 1774109264000),
  (16, 'Song 2', 'Blur', 'https://open.spotify.com/intl-de/track/3GfOAdcoc3X5GPiiXmpBjK?si=f4c76c9ad2c24277', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0234cbf7013afccc7df67fa43f', NULL, 'song', 0, true, 14, false, 1, 1774109305000),
  (17, 'Word Up - Radio Mix', 'Gun', 'https://open.spotify.com/intl-de/track/17CWwbHJ2ThM5MXj90ObrS?si=d034ed1b5dbd44da', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0209294629757e5b8dad7fe4c4', NULL, 'song', 0, true, 11, false, 1, 1774109349000),
  (18, 'She Hates Me', 'Puddle of mudd', 'https://open.spotify.com/intl-de/track/16DhvbuyvJob4Q9GHNYu2n?si=2c81fe4dbc3e427a', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0253cf4c30b11cf78c7bf6b793', NULL, 'song', 0, true, 8, false, 1, 1774109417000),
  (19, 'Tage wie diese', 'Hosen', 'https://open.spotify.com/intl-de/track/2lYsCjTvXIHOqT8xSbK2jq?si=a711d36312754310', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02c48e81625cf3834bab6a9c39', 'Test', 'song', 0, true, 9, false, 1, 1774109455000),
  (20, 'All The Small Things', 'Blink 182', 'https://open.spotify.com/intl-de/track/2m1hi0nfMR9vdGC8UcrnwU?si=a514a0148c3b4aad', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026da502e35a7a3e48de2b0f74', NULL, 'song', 0, true, 10, false, 1, 1774109486000),
  (22, 'Wild World', 'Me first and the gimme gimmes', 'https://open.spotify.com/intl-de/track/4tRkMhIcM13KEVbfBfTpzx?si=40ea9e21f8dc499d', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0253841c42917c71bdb272a342', '', 'song', 0, true, 12, false, 1, 1774113030000),
  (24, 'Change Tuning', 'Band', NULL, NULL, NULL, 'D', 'tuning', 0, true, 19, false, 1, 1774113069000),
  (25, 'Pieces', 'Sum 41', 'https://open.spotify.com/track/1ibeKVCiXORhvUpMmtsQWq?si=qT61llyfS5GSkQZWGu7N4A', '', 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02cb38dd3dba8a0801bc1ee03a', '', 'song', 0, true, 4, false, 6, 1774125666000),
  (26, 'Learn to Fly', 'Foo Fighters ', 'https://open.spotify.com/track/5OQsiBsky2k2kDKy2bX2eT?si=LWlpqaRlSjGkpgmGmVKMoA', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026c52084ed1f1748f213783b3', '', 'song', 0, true, 2, false, 6, 1774555979),
  (27, 'Creep', 'Radiohead', 'https://open.spotify.com/track/70LcF31zb1H0PyJoS1Sx1r?si=W0MraeDTRCOkoeZrIpaF4Q', '', 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ec548c00d3ac2f10be73366d', '', 'song', 0, true, 3, false, 6, 1774556098),
  (28, 'Bro Hymn - 2005 Remaster', 'Pennywise', 'https://open.spotify.com/track/2DgZjpyv2kEB8nIl6Xp0VJ?si=ynJLqtIERj6MqtdwyUPoeA', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a726951b88d883c7d8165cf4', '', 'song', 0, true, 18, false, 6, 1774556179),
  (29, 'Sugar (Metal Version)', 'Umc', 'https://open.spotify.com/track/6PjEsKzAno74iCUu9wfGtO?si=VzWhcw-1SCaIcrwU7QrD8Q', '', 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e024947b1fa837f6b2f2756a006', '', 'song', 0, false, 0, false, 6, 1774602923);

CREATE TEMP TABLE at_issue_events (
  old_id integer PRIMARY KEY,
  title text NOT NULL,
  description text,
  start_time bigint NOT NULL,
  end_time bigint NOT NULL,
  type text NOT NULL,
  user_id_old integer,
  created_at bigint NOT NULL,
  bierwart_override_id_old integer,
  is_tentative boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO at_issue_events (old_id, title, description, start_time, end_time, type, user_id_old, created_at, bierwart_override_id_old, is_tentative) VALUES
  (1, 'Bandprobe #1', E'**André und Daniel nicht da**.\n\n* Vorbereitung des Probenwochenendes\n* Song-Voting durchgehen\n\n', 1774551600000, 1774562400000, 'rehearsal', NULL, 1774085091000, 5, false),
  (2, 'Bandprobe #2', 'Probe und Bierverkostung', 1775152800000, 1775163600000, 'rehearsal', NULL, 1774085091000, 5, false),
  (3, 'Bandprobe #3', 'Probe und Bierverkostung', 1775757600000, 1775768400000, 'rehearsal', NULL, 1774085091000, NULL, false),
  (4, 'Bandprobe #4', 'Probe und Bierverkostung', 1776362400000, 1776373200000, 'rehearsal', NULL, 1774085091000, NULL, false),
  (6, 'Bandprobe #6', 'Probe und Bierverkostung', 1777572000000, 1776718800000, 'rehearsal', NULL, 1774085091000, NULL, false),
  (7, 'Bandprobe #7', 'Probe und Bierverkostung', 1778176800000, 1778187600000, 'rehearsal', NULL, 1774085091000, NULL, false),
  (8, 'Bandprobe #8', 'Probe und Bierverkostung', 1778781600000, 1778792400000, 'rehearsal', NULL, 1774085091000, NULL, false),
  (9, 'Bandprobe #9', 'Probe und Bierverkostung', 1779386400000, 1779397200000, 'rehearsal', NULL, 1774085091000, NULL, false),
  (10, 'Bandprobe #10', 'Probe und Bierverkostung', 1779991200000, 1780002000000, 'rehearsal', NULL, 1774085091000, NULL, false),
  (11, 'Gartenhallenbad', 'Party im Gartenhallenbad', 1785610800000, 1786485600000, 'gig', NULL, 1774085091000, NULL, false),
  (12, 'The Barn', 'Aidlingen', 1781298000000, 1781229600000, 'gig', NULL, 1774085091000, NULL, true),
  (13, 'Daniel nicht da', NULL, 1774548000000, 1774555200000, 'unavailability', 5, 1774090038000, NULL, false),
  (14, 'Andre nicht da', NULL, 1774548000000, 1774555200000, 'unavailability', 2, 1774090053000, NULL, false),
  (15, 'Probenwochenende', E'# Probenwochenende\n\n## 2 neue Songs Auftrittsreif \nXX \nYY\n\n## Bisheriges Set stabilisieren.\n\n## Video Material erstellen', 1777021200000, 1777233600000, 'event', NULL, 1774110920000, NULL, false),
  (16, 'Bandprobe ', NULL, 1776967200000, 1776978000000, 'rehearsal', NULL, 1774209568000, NULL, false),
  (18, 'Daniel nicht da', NULL, 1775145600000, 1775152800000, 'unavailability', 5, 1774212781000, NULL, false);

CREATE TEMP TABLE at_issue_votes (
  old_id integer PRIMARY KEY,
  song_id_old integer NOT NULL,
  user_id_old integer NOT NULL,
  score integer NOT NULL,
  comment text,
  created_at bigint NOT NULL
) ON COMMIT DROP;

INSERT INTO at_issue_votes (old_id, song_id_old, user_id_old, score, comment, created_at) VALUES
  (1, 1, 6, 3, NULL, 1774091304000),
  (8, 25, 6, 3, NULL, 1774125670000),
  (12, 8, 6, 2, NULL, 1774203297000),
  (13, 10, 6, 3, NULL, 1774203401000),
  (14, 12, 6, 3, NULL, 1774203404000),
  (15, 13, 6, 3, NULL, 1774203406000),
  (16, 15, 6, 3, NULL, 1774203407000),
  (17, 13, 2, 2, NULL, 1774297419),
  (18, 12, 2, 2, NULL, 1774297422),
  (19, 10, 2, 3, NULL, 1774297432),
  (20, 12, 3, 3, NULL, 1774459462),
  (21, 13, 3, 3, NULL, 1774459464),
  (22, 10, 3, 2, NULL, 1774459478),
  (23, 29, 6, 3, NULL, 1774602937);

CREATE TEMP TABLE at_issue_rehearsal_songs (
  rehearsal_id_old integer NOT NULL,
  song_id_old integer NOT NULL
) ON COMMIT DROP;
-- No rehearsal_songs rows in scripts/atissue-backup.sql export.

DO $$
DECLARE
  v_band_id integer;
  v_song_offset integer;
  v_event_offset integer;
  v_vote_offset integer;
BEGIN
  SELECT id INTO v_band_id FROM bands WHERE slug = 'at-issue' LIMIT 1;

  SELECT COALESCE(MAX(id), 0) INTO v_song_offset FROM songs;
  INSERT INTO songs (
    id,
    band_id,
    title,
    artist,
    spotify_url,
    youtube_url,
    thumbnail_url,
    notes,
    type,
    pitch,
    is_setlist,
    position,
    is_pinned,
    added_by,
    created_at
  )
  SELECT
    s.old_id + v_song_offset,
    v_band_id,
    s.title,
    s.artist,
    s.spotify_url,
    s.youtube_url,
    s.thumbnail_url,
    s.notes,
    s.type,
    s.pitch,
    s.is_setlist,
    s.position,
    s.is_pinned,
    um.user_id,
    CASE WHEN s.created_at < 100000000000 THEN to_timestamp(s.created_at) ELSE to_timestamp(s.created_at / 1000.0) END
  FROM at_issue_songs s
  LEFT JOIN at_issue_user_map um ON um.old_id = s.added_by_old
  ORDER BY s.old_id;

  SELECT COALESCE(MAX(id), 0) INTO v_event_offset FROM calendar_events;
  INSERT INTO calendar_events (
    id,
    band_id,
    title,
    description,
    start_time,
    end_time,
    type,
    user_id,
    bierwart_override_id,
    is_tentative,
    created_at
  )
  SELECT
    e.old_id + v_event_offset,
    v_band_id,
    e.title,
    e.description,
    CASE WHEN e.start_time < 100000000000 THEN to_timestamp(e.start_time) ELSE to_timestamp(e.start_time / 1000.0) END,
    CASE WHEN e.end_time < 100000000000 THEN to_timestamp(e.end_time) ELSE to_timestamp(e.end_time / 1000.0) END,
    e.type,
    u.user_id,
    bo.user_id,
    e.is_tentative,
    CASE WHEN e.created_at < 100000000000 THEN to_timestamp(e.created_at) ELSE to_timestamp(e.created_at / 1000.0) END
  FROM at_issue_events e
  LEFT JOIN at_issue_user_map u ON u.old_id = e.user_id_old
  LEFT JOIN at_issue_user_map bo ON bo.old_id = e.bierwart_override_id_old
  ORDER BY e.old_id;

  SELECT COALESCE(MAX(id), 0) INTO v_vote_offset FROM votes;
  INSERT INTO votes (
    id,
    band_id,
    song_id,
    user_id,
    score,
    comment,
    created_at
  )
  SELECT
    v.old_id + v_vote_offset,
    v_band_id,
    v.song_id_old + v_song_offset,
    um.user_id,
    v.score,
    v.comment,
    CASE WHEN v.created_at < 100000000000 THEN to_timestamp(v.created_at) ELSE to_timestamp(v.created_at / 1000.0) END
  FROM at_issue_votes v
  JOIN at_issue_user_map um ON um.old_id = v.user_id_old
  ORDER BY v.old_id;

  INSERT INTO rehearsal_songs (band_id, rehearsal_id, song_id)
  SELECT
    v_band_id,
    rs.rehearsal_id_old + v_event_offset,
    rs.song_id_old + v_song_offset
  FROM at_issue_rehearsal_songs rs
  ON CONFLICT (rehearsal_id, song_id) DO NOTHING;
END $$;

SELECT setval(pg_get_serial_sequence('songs','id'), COALESCE((SELECT MAX(id) FROM songs), 1), true);
SELECT setval(pg_get_serial_sequence('calendar_events','id'), COALESCE((SELECT MAX(id) FROM calendar_events), 1), true);
SELECT setval(pg_get_serial_sequence('votes','id'), COALESCE((SELECT MAX(id) FROM votes), 1), true);

COMMIT;
