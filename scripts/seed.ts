import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

// Database file path
const dbDir = join(process.cwd(), '.data');
try {
    mkdirSync(dbDir, { recursive: true });
} catch (e) {
    // Directory exists or permission error
}

const sqlite = new Database(join(dbDir, 'sqlite.db'));

// Ensure tables exist
sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'member',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'rehearsal',
        user_id INTEGER REFERENCES users(id),
        bierwart_override_id INTEGER REFERENCES users(id),
        created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        spotify_url TEXT,
        youtube_url TEXT,
        notes TEXT,
        type TEXT NOT NULL DEFAULT 'song',
        pitch INTEGER NOT NULL DEFAULT 0,
        is_setlist INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        added_by INTEGER REFERENCES users(id),
        created_at INTEGER NOT NULL
    );
`);

function seed() {
    console.log('Starting database seed...');
    const now = Date.now();

    // 1. Seed Band Members
    console.log('Seeding members...');
    const bandMembers = ['schneider.chris', 'Andre', 'Stefan', 'Andreas', 'Daniel'];
    for (let i = 0; i < bandMembers.length; i++) {
        sqlite.prepare('INSERT OR IGNORE INTO users (name, email, role, sort_order, created_at) VALUES (?, ?, ?, ?, ?)')
            .run(bandMembers[i], `${bandMembers[i].toLowerCase()}@gmx.de`, i === 0 ? 'admin' : 'member', i, now);
    }

    // 2. Seed Songs
    console.log('Seeding songs...');
    const setlistSongs = [
        ['Holiday', 'Green Day', 'https://open.spotify.com/intl-de/track/5vfjUAhefN7IjHbTvVCT4Z?si=4ab5dfb87a1d44cd'],
        ['Schrei nach Liebe', 'Die Ärzte', 'https://open.spotify.com/intl-de/track/4P4PHxZQ1FcwQKKnfEPsAZ?si=68958f13905f4bca'],
        ['Bad Guy', 'The Interrupters', 'https://open.spotify.com/intl-de/track/0iM1Ioz4N4p7MU1DKyqsov?si=1982a2ec6d844df5'],
        ['Countdown to Insanity', 'H-Blockx', 'https://open.spotify.com/intl-de/track/2XNaKS5wO5rPdgpPYVKria?si=f2c3a6dc0d144782'],
        ['Down in the past', 'Mando Diao', 'https://open.spotify.com/intl-de/track/2vx5Dc3Zxtd5yGDlh2pAAz?si=c19e003366684d9b'],
        ['Last resort', 'Papa Roach', 'https://open.spotify.com/intl-de/track/5W8YXBz9MTIDyrpYaCg2Ky?si=3ae221d3b6234a7c'],
        ['Billy Jean', 'The Bates', 'https://open.spotify.com/intl-de/track/5RpBC0VsMMSRYJmSgUZqDu?si=6644d5bee27d45bb'],
        ['Wild World', 'Me first and the gimme gimmes', 'https://open.spotify.com/intl-de/track/73PzrTVxMl8kmoSvFYLpig?si=b50ba624beaa41d3']
    ];

    const votingSongs = [
        ['Californication', 'Red Hot Chili Peppers', 'https://open.spotify.com/intl-de/track/48UPSzbZjgc449aqz8bxox?si=4ef0218567534539'],
        ['Take me out', 'Franz Ferdinand', 'https://open.spotify.com/intl-de/track/20I8RduZC2PWMWTDCZuuAN?si=2ec0e818266942d2'],
        ['Das geht ab', 'Die Atzen', 'https://open.spotify.com/intl-de/track/2P2kgRRvHflstcRHWC6v8n?si=2af35687dbf24627'],
        ['Auf gute Freunde', 'Onkelz', 'https://open.spotify.com/intl-de/track/0oIVNEkOgvOU9yG9oW13xC?si=499a70e53db54846']
    ];

    for (const [title, artist, url] of setlistSongs) {
        sqlite.prepare('INSERT OR IGNORE INTO songs (title, artist, spotify_url, type, is_setlist, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(title, artist, url, 'song', 1, now);
    }

    for (const [title, artist, url] of votingSongs) {
        sqlite.prepare('INSERT OR IGNORE INTO songs (title, artist, spotify_url, type, is_setlist, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(title, artist, url, 'song', 0, now);
    }

    // 3. Seed Rehearsals (Next 10 weeks, Thursdays 20:00 - 23:00)
    console.log('Seeding rehearsals...');
    // 2026-03-20 is a Friday. First Thursday is 2026-03-26.
    const firstThursday = new Date('2026-03-26T20:00:00');
    for (let i = 0; i < 10; i++) {
        const start = new Date(firstThursday);
        start.setDate(firstThursday.getDate() + (i * 7));
        const end = new Date(start);
        end.setHours(start.getHours() + 3);

        // We use title to avoid duplicates in this simple script
        const label = `Bandprobe #${i + 1}`;
        const existing = sqlite.prepare('SELECT id FROM calendar_events WHERE title = ? AND start_time = ?').get(label, Math.floor(start.getTime() / 1000));
        if (!existing) {
            sqlite.prepare('INSERT INTO calendar_events (title, description, start_time, end_time, type, created_at) VALUES (?, ?, ?, ?, ?, ?)')
                .run(label, 'Probe und Bierverkostung', Math.floor(start.getTime() / 1000), Math.floor(end.getTime() / 1000), 'rehearsal', Math.floor(now / 1000));
        }
    }

    // 4. Seed Gigs
    console.log('Seeding gigs...');
    const gig1Date = new Date(now + (3 * 7 * 24 * 60 * 60 * 1000)); // 3 weeks
    gig1Date.setHours(19, 0, 0, 0);
    const gig2Date = new Date(now + (5 * 7 * 24 * 60 * 60 * 1000)); // 5 weeks
    gig2Date.setHours(21, 0, 0, 0);

    const gigs = [
        ['Gartenhallenbad', 'Live Show', gig1Date],
        ['Wrench Crew Party', 'Rock Night', gig2Date]
    ];

    for (const [title, desc, date] of gigs) {
        const start = Math.floor((date as Date).getTime() / 1000);
        const existing = sqlite.prepare('SELECT id FROM calendar_events WHERE title = ? AND start_time = ?').get(title, start);
        if (!existing) {
            sqlite.prepare('INSERT INTO calendar_events (title, description, start_time, end_time, type, created_at) VALUES (?, ?, ?, ?, ?, ?)')
                .run(title, desc, start, start + 7200, 'gig', Math.floor(now / 1000));
        }
    }

    console.log('Database seeding complete!');
    sqlite.close();
}

seed();
