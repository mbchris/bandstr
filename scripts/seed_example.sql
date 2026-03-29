-- PostgreSQL-compatible seed converted from legacy SQLite dump
-- Source: scripts/seed_example.sql (legacy format)
BEGIN;

INSERT INTO bands (name, slug, plan, created_at)
VALUES ('Legacy Imported Band', 'legacy-imported-band', 'free', now())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
VALUES ('legacy-user-1', 'Chris Admin', 'schneider.chris@gmx.de', true, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END), (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
VALUES ('legacy-user-2', 'Andre', 'andrehoyer.ah@googlemail.com', true, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END), (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
VALUES ('legacy-user-3', 'Stefan', 'streu79@googlemail.com', true, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END), (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
VALUES ('legacy-user-4', 'Andreas', 'aschulzebw@googlemail.com', true, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END), (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
VALUES ('legacy-user-5', 'Daniel', 'd.vollkommer@gmail.com', true, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END), (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
VALUES ('legacy-user-6', 'Chris', 'christian.familie.schneider@gmail.com', true, NULL, (CASE WHEN 1774087137000 < 100000000000 THEN to_timestamp(1774087137000) ELSE to_timestamp(1774087137000 / 1000.0) END), (CASE WHEN 1774087137000 < 100000000000 THEN to_timestamp(1774087137000) ELSE to_timestamp(1774087137000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;

UPDATE "user"
SET dev_pro_plan = true, dev_pro_plan_assigned_at = now()
WHERE id = 'legacy-user-1';

INSERT INTO band_members (band_id, user_id, role, sort_order, is_hidden, beer_count, joined_at)
VALUES ((SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'legacy-user-1', 'owner', 1, true, 0, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (band_id, user_id) DO NOTHING;
INSERT INTO band_members (band_id, user_id, role, sort_order, is_hidden, beer_count, joined_at)
VALUES ((SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'legacy-user-2', 'member', 2, false, 0, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (band_id, user_id) DO NOTHING;
INSERT INTO band_members (band_id, user_id, role, sort_order, is_hidden, beer_count, joined_at)
VALUES ((SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'legacy-user-3', 'member', 3, false, 0, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (band_id, user_id) DO NOTHING;
INSERT INTO band_members (band_id, user_id, role, sort_order, is_hidden, beer_count, joined_at)
VALUES ((SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'legacy-user-4', 'member', 4, false, 0, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (band_id, user_id) DO NOTHING;
INSERT INTO band_members (band_id, user_id, role, sort_order, is_hidden, beer_count, joined_at)
VALUES ((SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'legacy-user-5', 'member', 0, false, 0, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (band_id, user_id) DO NOTHING;
INSERT INTO band_members (band_id, user_id, role, sort_order, is_hidden, beer_count, joined_at)
VALUES ((SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'legacy-user-6', 'member', 5, false, 0, (CASE WHEN 1774087137000 < 100000000000 THEN to_timestamp(1774087137000) ELSE to_timestamp(1774087137000 / 1000.0) END))
ON CONFLICT (band_id, user_id) DO NOTHING;

INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (1, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Holiday', 'Green Day', 'https://open.spotify.com/intl-de/track/5vfjUAhefN7IjHbTvVCT4Z?si=4ab5dfb87a1d44cd', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e021bb1db39abc18755d7ab2114', 'Schneller als original ...', 'song', 1, true, 0, false, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (2, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Schrei nach Liebe', 'Die Ärzte', 'https://open.spotify.com/intl-de/track/4P4PHxZQ1FcwQKKnfEPsAZ?si=68958f13905f4bca', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e029510c262f77afc125df888b8', NULL, 'song', 0, true, 5, false, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (3, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Bad Guy', 'The Interrupters', 'https://open.spotify.com/intl-de/track/0iM1Ioz4N4p7MU1DKyqsov?si=1982a2ec6d844df5', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a33fad32ad43b17010154e0a', 'Schneller, härter, lauter

und besser', 'song', -1, true, 16, false, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (4, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Countdown To Insanity', 'H-Blockx', 'https://open.spotify.com/intl-de/track/2XNaKS5wO5rPdgpPYVKria?si=f2c3a6dc0d144782', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02f5c00b94871fd0d1a588c720', NULL, 'song', 0, true, 6, false, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (5, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Down in the Past', 'Mando Diao', 'https://open.spotify.com/intl-de/track/2vx5Dc3Zxtd5yGDlh2pAAz?si=c19e003366684d9b', NULL, 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d77f5131e85a3164f9c3aeed', NULL, 'song', 0, true, 1, false, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (6, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Last Resort', 'Papa Roach', 'https://open.spotify.com/intl-de/track/5W8YXBz9MTIDyrpYaCg2Ky?si=3ae221d3b6234a7c', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02985bf5ede2fe4a048ee85f28', NULL, 'song', 0, true, 13, false, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (7, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Billie Jean', 'The Bates', 'https://open.spotify.com/intl-de/track/5RpBC0VsMMSRYJmSgUZqDu?si=6644d5bee27d45bb', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023ee17b646117e84b4c4a29b3', NULL, 'song', 0, true, 7, false, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (8, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Straight Up', 'Me first and the gimme gimmes', 'https://open.spotify.com/intl-de/track/73PzrTVxMl8kmoSvFYLpig?si=b50ba624beaa41d3', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0299cad47dcc59b21623f070e4', NULL, 'song', 0, false, 8, false, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (10, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Take Me Out', 'Franz Ferdinand', 'https://open.spotify.com/intl-de/track/20I8RduZC2PWMWTDCZuuAN?si=2ec0e818266942d2', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a5d1c06a8172d4861367953c', NULL, 'song', 0, true, 17, false, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (12, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Auf gute Freunde', 'Onkelz', 'https://open.spotify.com/intl-de/track/0oIVNEkOgvOU9yG9oW13xC?si=499a70e53db54846', NULL, 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e027634ec8f0599c66e26ef0456', NULL, 'song', 0, false, 0, false, NULL, (CASE WHEN 1774085091233 < 100000000000 THEN to_timestamp(1774085091233) ELSE to_timestamp(1774085091233 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (13, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Punk Rock Song', 'Bad Religion', 'https://open.spotify.com/intl-de/track/5ACDC1gxAUXYDWherVKOiX?si=439480c519f24539', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0240b9a1ccf095a3456bf867c3', NULL, 'song', 0, false, 0, false, 'legacy-user-1', (CASE WHEN 1774108732000 < 100000000000 THEN to_timestamp(1774108732000) ELSE to_timestamp(1774108732000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (14, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Rock & Roll Queen', 'The Subways', 'https://open.spotify.com/intl-de/track/1uNKzxSXBkPTngkASu10pl?si=97ef897778284a94', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e028e13e145ddb6ec23e30ad3be', NULL, 'song', 0, true, 15, false, 'legacy-user-1', (CASE WHEN 1774109231000 < 100000000000 THEN to_timestamp(1774109231000) ELSE to_timestamp(1774109231000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (15, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Das geht ab - Rockversion', 'Die Atzen', 'https://open.spotify.com/intl-de/track/2P2kgRRvHflstcRHWC6v8n?si=ca0c541fa7474d6a', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023ff20a578e20595700ee76a5', NULL, 'song', 0, false, 0, false, 'legacy-user-1', (CASE WHEN 1774109264000 < 100000000000 THEN to_timestamp(1774109264000) ELSE to_timestamp(1774109264000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (16, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Song 2', 'Blur', 'https://open.spotify.com/intl-de/track/3GfOAdcoc3X5GPiiXmpBjK?si=f4c76c9ad2c24277', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0234cbf7013afccc7df67fa43f', NULL, 'song', 0, true, 14, false, 'legacy-user-1', (CASE WHEN 1774109305000 < 100000000000 THEN to_timestamp(1774109305000) ELSE to_timestamp(1774109305000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (17, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Word Up - Radio Mix', 'Gun', 'https://open.spotify.com/intl-de/track/17CWwbHJ2ThM5MXj90ObrS?si=d034ed1b5dbd44da', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0209294629757e5b8dad7fe4c4', NULL, 'song', 0, true, 11, false, 'legacy-user-1', (CASE WHEN 1774109349000 < 100000000000 THEN to_timestamp(1774109349000) ELSE to_timestamp(1774109349000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (18, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'She Hates Me', 'Puddle of mudd', 'https://open.spotify.com/intl-de/track/16DhvbuyvJob4Q9GHNYu2n?si=2c81fe4dbc3e427a', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0253cf4c30b11cf78c7bf6b793', NULL, 'song', 0, true, 8, false, 'legacy-user-1', (CASE WHEN 1774109417000 < 100000000000 THEN to_timestamp(1774109417000) ELSE to_timestamp(1774109417000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (19, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Tage wie diese', 'Hosen', 'https://open.spotify.com/intl-de/track/2lYsCjTvXIHOqT8xSbK2jq?si=a711d36312754310', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02c48e81625cf3834bab6a9c39', 'Test', 'song', 0, true, 9, false, 'legacy-user-1', (CASE WHEN 1774109455000 < 100000000000 THEN to_timestamp(1774109455000) ELSE to_timestamp(1774109455000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (20, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'All The Small Things', 'Blink 182', 'https://open.spotify.com/intl-de/track/2m1hi0nfMR9vdGC8UcrnwU?si=a514a0148c3b4aad', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026da502e35a7a3e48de2b0f74', NULL, 'song', 0, true, 10, false, 'legacy-user-1', (CASE WHEN 1774109486000 < 100000000000 THEN to_timestamp(1774109486000) ELSE to_timestamp(1774109486000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (22, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Wild World', 'Me first and the gimme gimmes', 'https://open.spotify.com/intl-de/track/4tRkMhIcM13KEVbfBfTpzx?si=40ea9e21f8dc499d', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0253841c42917c71bdb272a342', '', 'song', 0, true, 12, false, 'legacy-user-1', (CASE WHEN 1774113030000 < 100000000000 THEN to_timestamp(1774113030000) ELSE to_timestamp(1774113030000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (24, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Change Tuning', 'Band', NULL, NULL, NULL, 'D', 'tuning', 0, true, 19, false, 'legacy-user-1', (CASE WHEN 1774113069000 < 100000000000 THEN to_timestamp(1774113069000) ELSE to_timestamp(1774113069000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (25, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Pieces', 'Sum 41', 'https://open.spotify.com/track/1ibeKVCiXORhvUpMmtsQWq?si=qT61llyfS5GSkQZWGu7N4A', '', 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02cb38dd3dba8a0801bc1ee03a', '', 'song', 0, true, 4, false, 'legacy-user-6', (CASE WHEN 1774125666000 < 100000000000 THEN to_timestamp(1774125666000) ELSE to_timestamp(1774125666000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (26, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Learn to Fly', 'Foo Fighters ', 'https://open.spotify.com/track/5OQsiBsky2k2kDKy2bX2eT?si=LWlpqaRlSjGkpgmGmVKMoA', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e026c52084ed1f1748f213783b3', '', 'song', 0, true, 2, false, 'legacy-user-6', (CASE WHEN 1774555979 < 100000000000 THEN to_timestamp(1774555979) ELSE to_timestamp(1774555979 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (27, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Creep', 'Radiohead', 'https://open.spotify.com/track/70LcF31zb1H0PyJoS1Sx1r?si=W0MraeDTRCOkoeZrIpaF4Q', '', 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ec548c00d3ac2f10be73366d', '', 'song', 0, true, 3, false, 'legacy-user-6', (CASE WHEN 1774556098 < 100000000000 THEN to_timestamp(1774556098) ELSE to_timestamp(1774556098 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (28, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Bro Hymn - 2005 Remaster', 'Pennywise', 'https://open.spotify.com/track/2DgZjpyv2kEB8nIl6Xp0VJ?si=ynJLqtIERj6MqtdwyUPoeA', '', 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a726951b88d883c7d8165cf4', '', 'song', 0, true, 18, false, 'legacy-user-6', (CASE WHEN 1774556179 < 100000000000 THEN to_timestamp(1774556179) ELSE to_timestamp(1774556179 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO songs (id, band_id, title, artist, spotify_url, youtube_url, thumbnail_url, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at)
VALUES (29, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Sugar (Metal Version)', 'Umc', 'https://open.spotify.com/track/6PjEsKzAno74iCUu9wfGtO?si=VzWhcw-1SCaIcrwU7QrD8Q', '', 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e024947b1fa837f6b2f2756a006', '', 'song', 0, false, 0, false, 'legacy-user-6', (CASE WHEN 1774602923 < 100000000000 THEN to_timestamp(1774602923) ELSE to_timestamp(1774602923 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;

INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (1, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Bandprobe #1', '**André und Daniel nicht da**.

* Vorbereitung des Probenwochenendes
* Song-Voting durchgehen

', (CASE WHEN 1774551600000 < 100000000000 THEN to_timestamp(1774551600000) ELSE to_timestamp(1774551600000 / 1000.0) END), (CASE WHEN 1774562400000 < 100000000000 THEN to_timestamp(1774562400000) ELSE to_timestamp(1774562400000 / 1000.0) END), 'rehearsal', NULL, 'legacy-user-5', false, (CASE WHEN 1774085091000 < 100000000000 THEN to_timestamp(1774085091000) ELSE to_timestamp(1774085091000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (2, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Bandprobe #2', 'Probe und Bierverkostung', (CASE WHEN 1775152800000 < 100000000000 THEN to_timestamp(1775152800000) ELSE to_timestamp(1775152800000 / 1000.0) END), (CASE WHEN 1775163600000 < 100000000000 THEN to_timestamp(1775163600000) ELSE to_timestamp(1775163600000 / 1000.0) END), 'rehearsal', NULL, 'legacy-user-5', false, (CASE WHEN 1774085091000 < 100000000000 THEN to_timestamp(1774085091000) ELSE to_timestamp(1774085091000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (3, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Bandprobe #3', 'Probe und Bierverkostung', (CASE WHEN 1775757600000 < 100000000000 THEN to_timestamp(1775757600000) ELSE to_timestamp(1775757600000 / 1000.0) END), (CASE WHEN 1775768400000 < 100000000000 THEN to_timestamp(1775768400000) ELSE to_timestamp(1775768400000 / 1000.0) END), 'rehearsal', NULL, NULL, false, (CASE WHEN 1774085091000 < 100000000000 THEN to_timestamp(1774085091000) ELSE to_timestamp(1774085091000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (4, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Bandprobe #4', 'Probe und Bierverkostung', (CASE WHEN 1776362400000 < 100000000000 THEN to_timestamp(1776362400000) ELSE to_timestamp(1776362400000 / 1000.0) END), (CASE WHEN 1776373200000 < 100000000000 THEN to_timestamp(1776373200000) ELSE to_timestamp(1776373200000 / 1000.0) END), 'rehearsal', NULL, NULL, false, (CASE WHEN 1774085091000 < 100000000000 THEN to_timestamp(1774085091000) ELSE to_timestamp(1774085091000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (6, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Bandprobe #6', 'Probe und Bierverkostung', (CASE WHEN 1777572000000 < 100000000000 THEN to_timestamp(1777572000000) ELSE to_timestamp(1777572000000 / 1000.0) END), (CASE WHEN 1776718800000 < 100000000000 THEN to_timestamp(1776718800000) ELSE to_timestamp(1776718800000 / 1000.0) END), 'rehearsal', NULL, NULL, false, (CASE WHEN 1774085091000 < 100000000000 THEN to_timestamp(1774085091000) ELSE to_timestamp(1774085091000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (7, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Bandprobe #7', 'Probe und Bierverkostung', (CASE WHEN 1778176800000 < 100000000000 THEN to_timestamp(1778176800000) ELSE to_timestamp(1778176800000 / 1000.0) END), (CASE WHEN 1778187600000 < 100000000000 THEN to_timestamp(1778187600000) ELSE to_timestamp(1778187600000 / 1000.0) END), 'rehearsal', NULL, NULL, false, (CASE WHEN 1774085091000 < 100000000000 THEN to_timestamp(1774085091000) ELSE to_timestamp(1774085091000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (8, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Bandprobe #8', 'Probe und Bierverkostung', (CASE WHEN 1778781600000 < 100000000000 THEN to_timestamp(1778781600000) ELSE to_timestamp(1778781600000 / 1000.0) END), (CASE WHEN 1778792400000 < 100000000000 THEN to_timestamp(1778792400000) ELSE to_timestamp(1778792400000 / 1000.0) END), 'rehearsal', NULL, NULL, false, (CASE WHEN 1774085091000 < 100000000000 THEN to_timestamp(1774085091000) ELSE to_timestamp(1774085091000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (9, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Bandprobe #9', 'Probe und Bierverkostung', (CASE WHEN 1779386400000 < 100000000000 THEN to_timestamp(1779386400000) ELSE to_timestamp(1779386400000 / 1000.0) END), (CASE WHEN 1779397200000 < 100000000000 THEN to_timestamp(1779397200000) ELSE to_timestamp(1779397200000 / 1000.0) END), 'rehearsal', NULL, NULL, false, (CASE WHEN 1774085091000 < 100000000000 THEN to_timestamp(1774085091000) ELSE to_timestamp(1774085091000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (10, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Bandprobe #10', 'Probe und Bierverkostung', (CASE WHEN 1779991200000 < 100000000000 THEN to_timestamp(1779991200000) ELSE to_timestamp(1779991200000 / 1000.0) END), (CASE WHEN 1780002000000 < 100000000000 THEN to_timestamp(1780002000000) ELSE to_timestamp(1780002000000 / 1000.0) END), 'rehearsal', NULL, NULL, false, (CASE WHEN 1774085091000 < 100000000000 THEN to_timestamp(1774085091000) ELSE to_timestamp(1774085091000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (11, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Gartenhallenbad', 'Party im Gartenhallenbad', (CASE WHEN 1785610800000 < 100000000000 THEN to_timestamp(1785610800000) ELSE to_timestamp(1785610800000 / 1000.0) END), (CASE WHEN 1786485600000 < 100000000000 THEN to_timestamp(1786485600000) ELSE to_timestamp(1786485600000 / 1000.0) END), 'gig', NULL, NULL, false, (CASE WHEN 1774085091000 < 100000000000 THEN to_timestamp(1774085091000) ELSE to_timestamp(1774085091000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (12, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'The Barn', 'Aidlingen', (CASE WHEN 1781298000000 < 100000000000 THEN to_timestamp(1781298000000) ELSE to_timestamp(1781298000000 / 1000.0) END), (CASE WHEN 1781229600000 < 100000000000 THEN to_timestamp(1781229600000) ELSE to_timestamp(1781229600000 / 1000.0) END), 'gig', NULL, NULL, true, (CASE WHEN 1774085091000 < 100000000000 THEN to_timestamp(1774085091000) ELSE to_timestamp(1774085091000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (13, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Daniel nicht da', NULL, (CASE WHEN 1774548000000 < 100000000000 THEN to_timestamp(1774548000000) ELSE to_timestamp(1774548000000 / 1000.0) END), (CASE WHEN 1774555200000 < 100000000000 THEN to_timestamp(1774555200000) ELSE to_timestamp(1774555200000 / 1000.0) END), 'unavailability', 'legacy-user-5', NULL, false, (CASE WHEN 1774090038000 < 100000000000 THEN to_timestamp(1774090038000) ELSE to_timestamp(1774090038000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (14, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Andre nicht da', NULL, (CASE WHEN 1774548000000 < 100000000000 THEN to_timestamp(1774548000000) ELSE to_timestamp(1774548000000 / 1000.0) END), (CASE WHEN 1774555200000 < 100000000000 THEN to_timestamp(1774555200000) ELSE to_timestamp(1774555200000 / 1000.0) END), 'unavailability', 'legacy-user-2', NULL, false, (CASE WHEN 1774090053000 < 100000000000 THEN to_timestamp(1774090053000) ELSE to_timestamp(1774090053000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (15, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Probenwochenende', '# Probenwochenende

## 2 neue Songs Auftrittsreif 
XX 
YY

## Bisheriges Set stabilisieren.

## Video Material erstellen', (CASE WHEN 1777021200000 < 100000000000 THEN to_timestamp(1777021200000) ELSE to_timestamp(1777021200000 / 1000.0) END), (CASE WHEN 1777233600000 < 100000000000 THEN to_timestamp(1777233600000) ELSE to_timestamp(1777233600000 / 1000.0) END), 'event', NULL, NULL, false, (CASE WHEN 1774110920000 < 100000000000 THEN to_timestamp(1774110920000) ELSE to_timestamp(1774110920000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (16, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Bandprobe ', NULL, (CASE WHEN 1776967200000 < 100000000000 THEN to_timestamp(1776967200000) ELSE to_timestamp(1776967200000 / 1000.0) END), (CASE WHEN 1776978000000 < 100000000000 THEN to_timestamp(1776978000000) ELSE to_timestamp(1776978000000 / 1000.0) END), 'rehearsal', NULL, NULL, false, (CASE WHEN 1774209568000 < 100000000000 THEN to_timestamp(1774209568000) ELSE to_timestamp(1774209568000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at)
VALUES (18, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 'Daniel nicht da', NULL, (CASE WHEN 1775145600000 < 100000000000 THEN to_timestamp(1775145600000) ELSE to_timestamp(1775145600000 / 1000.0) END), (CASE WHEN 1775152800000 < 100000000000 THEN to_timestamp(1775152800000) ELSE to_timestamp(1775152800000 / 1000.0) END), 'unavailability', 'legacy-user-5', NULL, false, (CASE WHEN 1774212781000 < 100000000000 THEN to_timestamp(1774212781000) ELSE to_timestamp(1774212781000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;

INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (1, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 1, 'legacy-user-6', 3, NULL, (CASE WHEN 1774091304000 < 100000000000 THEN to_timestamp(1774091304000) ELSE to_timestamp(1774091304000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (8, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 25, 'legacy-user-6', 3, NULL, (CASE WHEN 1774125670000 < 100000000000 THEN to_timestamp(1774125670000) ELSE to_timestamp(1774125670000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (12, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 8, 'legacy-user-6', 2, NULL, (CASE WHEN 1774203297000 < 100000000000 THEN to_timestamp(1774203297000) ELSE to_timestamp(1774203297000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (13, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 10, 'legacy-user-6', 3, NULL, (CASE WHEN 1774203401000 < 100000000000 THEN to_timestamp(1774203401000) ELSE to_timestamp(1774203401000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (14, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 12, 'legacy-user-6', 3, NULL, (CASE WHEN 1774203404000 < 100000000000 THEN to_timestamp(1774203404000) ELSE to_timestamp(1774203404000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (15, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 13, 'legacy-user-6', 3, NULL, (CASE WHEN 1774203406000 < 100000000000 THEN to_timestamp(1774203406000) ELSE to_timestamp(1774203406000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (16, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 15, 'legacy-user-6', 3, NULL, (CASE WHEN 1774203407000 < 100000000000 THEN to_timestamp(1774203407000) ELSE to_timestamp(1774203407000 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (17, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 13, 'legacy-user-2', 2, NULL, (CASE WHEN 1774297419 < 100000000000 THEN to_timestamp(1774297419) ELSE to_timestamp(1774297419 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (18, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 12, 'legacy-user-2', 2, NULL, (CASE WHEN 1774297422 < 100000000000 THEN to_timestamp(1774297422) ELSE to_timestamp(1774297422 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (19, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 10, 'legacy-user-2', 3, NULL, (CASE WHEN 1774297432 < 100000000000 THEN to_timestamp(1774297432) ELSE to_timestamp(1774297432 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (20, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 12, 'legacy-user-3', 3, NULL, (CASE WHEN 1774459462 < 100000000000 THEN to_timestamp(1774459462) ELSE to_timestamp(1774459462 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (21, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 13, 'legacy-user-3', 3, NULL, (CASE WHEN 1774459464 < 100000000000 THEN to_timestamp(1774459464) ELSE to_timestamp(1774459464 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (22, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 10, 'legacy-user-3', 2, NULL, (CASE WHEN 1774459478 < 100000000000 THEN to_timestamp(1774459478) ELSE to_timestamp(1774459478 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at)
VALUES (23, (SELECT id FROM bands WHERE slug = 'legacy-imported-band'), 29, 'legacy-user-6', 3, NULL, (CASE WHEN 1774602937 < 100000000000 THEN to_timestamp(1774602937) ELSE to_timestamp(1774602937 / 1000.0) END))
ON CONFLICT (id) DO NOTHING;


SELECT setval(pg_get_serial_sequence('songs','id'), COALESCE((SELECT MAX(id) FROM songs), 1), true);
SELECT setval(pg_get_serial_sequence('calendar_events','id'), COALESCE((SELECT MAX(id) FROM calendar_events), 1), true);
SELECT setval(pg_get_serial_sequence('votes','id'), COALESCE((SELECT MAX(id) FROM votes), 1), true);
COMMIT;
