-- Fictional demo data for App Store / Play Store marketing screenshots.
--
-- Everything in here is invented: the band, its members, the songs and the
-- gigs. No real person, e-mail address or copyrighted recording appears, so
-- captures made against this data can be published as store artwork.
--
-- Usage: ./scripts/seed-demo.sh
BEGIN;

INSERT INTO bands (name, slug, plan, created_at)
VALUES ('Neon Kompass', 'neon-kompass', 'pro', now())
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, plan = EXCLUDED.plan;

-- Members ------------------------------------------------------------------
INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at) VALUES
  ('demo-user-1', 'Mira Falk',     'mira@example.com',   true, NULL, now(), now()),
  ('demo-user-2', 'Jonas Weber',   'jonas@example.com',  true, NULL, now(), now()),
  ('demo-user-3', 'Lena Hoffmann', 'lena@example.com',   true, NULL, now(), now()),
  ('demo-user-4', 'Tobias Reiter', 'tobias@example.com', true, NULL, now(), now()),
  ('demo-user-5', 'Sami Okonkwo',  'sami@example.com',   true, NULL, now(), now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;

INSERT INTO band_members (band_id, user_id, role, sort_order, is_hidden, beer_count, joined_at) VALUES
  ((SELECT id FROM bands WHERE slug='neon-kompass'), 'demo-user-1', 'owner',  1, false, 3, now() - interval '400 days'),
  ((SELECT id FROM bands WHERE slug='neon-kompass'), 'demo-user-2', 'admin',  2, false, 5, now() - interval '380 days'),
  ((SELECT id FROM bands WHERE slug='neon-kompass'), 'demo-user-3', 'member', 3, false, 2, now() - interval '360 days'),
  ((SELECT id FROM bands WHERE slug='neon-kompass'), 'demo-user-4', 'member', 4, false, 7, now() - interval '210 days'),
  ((SELECT id FROM bands WHERE slug='neon-kompass'), 'demo-user-5', 'member', 5, false, 1, now() - interval '90 days')
ON CONFLICT (band_id, user_id) DO UPDATE SET role = EXCLUDED.role, sort_order = EXCLUDED.sort_order, beer_count = EXCLUDED.beer_count;

-- Songs: fictional titles by fictional artists ------------------------------
INSERT INTO songs (id, band_id, title, artist, notes, type, pitch, is_setlist, position, is_pinned, added_by, created_at, length_ms, bpm) VALUES
  (9001, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Nordwind',              'Aurora Kollektiv', 'Intro 8 Takte, Einzähler von Jonas', 'song',  0, true,  1, true,  'demo-user-1', now() - interval '300 days', 212000, 128),
  (9002, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Glasfassade',           'Stadtlichter',     'Halber Ton runter',                  'song', -1, true,  2, false, 'demo-user-2', now() - interval '295 days', 238000, 112),
  (9003, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Wenn der Hafen schläft','Elin Marsh',       NULL,                                 'song',  0, true,  3, false, 'demo-user-1', now() - interval '280 days', 196000,  96),
  (9004, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Kurzschluss',           'Neon Kompass',     'Eigener Song',                       'song',  0, true,  4, false, 'demo-user-3', now() - interval '260 days', 254000, 140),
  (9005, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Pause',                 '',                 '15 Minuten',                         'break', 0, true,  5, false, 'demo-user-1', now() - interval '260 days', 900000, NULL),
  (9006, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Silberpapier',          'Marlow Trio',      NULL,                                 'song',  0, true,  6, false, 'demo-user-4', now() - interval '250 days', 225000, 104),
  (9007, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Zwischen zwei Zügen',   'Aurora Kollektiv', 'Ende offen, Blickkontakt!',          'song',  2, true,  7, false, 'demo-user-2', now() - interval '240 days', 281000, 120),
  (9008, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Tagesanbruch',          'Stadtlichter',     NULL,                                 'song',  0, true,  8, false, 'demo-user-5', now() - interval '120 days', 203000, 132),
  (9009, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Rückenwind',            'Elin Marsh',       'Kandidat fürs nächste Set',          'song',  0, false, 0, false, 'demo-user-3', now() - interval  '60 days', 247000, 118),
  (9010, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Kalte Sonne',           'Marlow Trio',      NULL,                                 'song',  0, false, 0, false, 'demo-user-4', now() - interval  '45 days', 219000, 100),
  (9011, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Hochhaus',              'Neon Kompass',     'Text noch nicht fertig',             'song',  0, false, 0, false, 'demo-user-1', now() - interval  '30 days', 188000, 126),
  (9012, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Letzte Bahn',           'Elin Marsh',       NULL,                                 'song',  0, false, 0, false, 'demo-user-5', now() - interval  '14 days', 262000, 108)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, artist = EXCLUDED.artist, notes = EXCLUDED.notes,
  is_setlist = EXCLUDED.is_setlist, position = EXCLUDED.position, is_pinned = EXCLUDED.is_pinned,
  pitch = EXCLUDED.pitch, length_ms = EXCLUDED.length_ms, bpm = EXCLUDED.bpm;

-- Calendar: rehearsals and gigs in the coming weeks -------------------------
INSERT INTO calendar_events (id, band_id, title, description, start_time, end_time, type, user_id, bierwart_override_id, is_tentative, created_at) VALUES
  (9001, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Bandprobe',             'Neue Songs durchgehen',   date_trunc('day', now()) + interval  '3 days 19 hours', date_trunc('day', now()) + interval  '3 days 22 hours', 'rehearsal', NULL, 'demo-user-4', false, now()),
  (9002, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Sommerfest Stadtpark',  'Open Air, 45 Minuten Set',date_trunc('day', now()) + interval '11 days 20 hours', date_trunc('day', now()) + interval '11 days 22 hours', 'gig',       NULL, NULL,          false, now()),
  (9003, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Bandprobe',             NULL,                      date_trunc('day', now()) + interval '17 days 19 hours', date_trunc('day', now()) + interval '17 days 22 hours', 'rehearsal', NULL, 'demo-user-2', false, now()),
  (9004, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Clubkonzert Ankerwerk', 'Soundcheck 18:00',        date_trunc('day', now()) + interval '25 days 20 hours', date_trunc('day', now()) + interval '25 days 23 hours', 'gig',       NULL, NULL,          true,  now()),
  (9005, (SELECT id FROM bands WHERE slug='neon-kompass'), 'Bandprobe',             'Setlist final festlegen', date_trunc('day', now()) + interval '31 days 19 hours', date_trunc('day', now()) + interval '31 days 22 hours', 'rehearsal', NULL, 'demo-user-5', false, now())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
  start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, type = EXCLUDED.type,
  bierwart_override_id = EXCLUDED.bierwart_override_id, is_tentative = EXCLUDED.is_tentative;

-- Votes on the songs that are not yet in the setlist ------------------------
INSERT INTO votes (id, band_id, song_id, user_id, score, comment, created_at) VALUES
  (9001, (SELECT id FROM bands WHERE slug='neon-kompass'), 9009, 'demo-user-1', 3, 'Passt gut als Opener',    now() - interval '9 days'),
  (9002, (SELECT id FROM bands WHERE slug='neon-kompass'), 9009, 'demo-user-2', 3, NULL,                      now() - interval '9 days'),
  (9003, (SELECT id FROM bands WHERE slug='neon-kompass'), 9009, 'demo-user-3', 2, NULL,                      now() - interval '8 days'),
  (9004, (SELECT id FROM bands WHERE slug='neon-kompass'), 9009, 'demo-user-4', 3, NULL,                      now() - interval '8 days'),
  (9005, (SELECT id FROM bands WHERE slug='neon-kompass'), 9010, 'demo-user-1', 2, NULL,                      now() - interval '7 days'),
  (9006, (SELECT id FROM bands WHERE slug='neon-kompass'), 9010, 'demo-user-2', 1, 'Refrain ist mir zu lang', now() - interval '7 days'),
  (9007, (SELECT id FROM bands WHERE slug='neon-kompass'), 9010, 'demo-user-5', 2, NULL,                      now() - interval '6 days'),
  (9008, (SELECT id FROM bands WHERE slug='neon-kompass'), 9011, 'demo-user-3', 3, NULL,                      now() - interval '5 days'),
  (9009, (SELECT id FROM bands WHERE slug='neon-kompass'), 9011, 'demo-user-4', 2, NULL,                      now() - interval '5 days'),
  (9010, (SELECT id FROM bands WHERE slug='neon-kompass'), 9012, 'demo-user-1', 3, 'Starker Rausschmeißer',   now() - interval '3 days'),
  (9011, (SELECT id FROM bands WHERE slug='neon-kompass'), 9012, 'demo-user-2', 2, NULL,                      now() - interval '3 days'),
  (9012, (SELECT id FROM bands WHERE slug='neon-kompass'), 9012, 'demo-user-3', 3, NULL,                      now() - interval '2 days')
ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment;

-- Keep sequences ahead of the hard-coded demo ids ---------------------------
SELECT setval(pg_get_serial_sequence('songs', 'id'),           GREATEST((SELECT MAX(id) FROM songs), 9012));
SELECT setval(pg_get_serial_sequence('calendar_events', 'id'), GREATEST((SELECT MAX(id) FROM calendar_events), 9005));
SELECT setval(pg_get_serial_sequence('votes', 'id'),           GREATEST((SELECT MAX(id) FROM votes), 9012));

COMMIT;
