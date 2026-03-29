const Database = require('better-sqlite3');
const { join } = require('path');

async function run() {
    try {
        const sqlite = new Database(join(process.cwd(), '.data', 'sqlite.db'));
        
        console.log('--- BEFORE MIGRATION ---');
        const first = sqlite.prepare('SELECT id, start_time FROM calendar_events ORDER BY id LIMIT 1').get();
        console.log(JSON.stringify(first));

        console.log('Manual Migrating...');
        sqlite.exec("UPDATE calendar_events SET start_time = start_time * 1000 WHERE start_time < 2000000000");
        sqlite.exec("UPDATE calendar_events SET end_time = end_time * 1000 WHERE end_time < 2000000000");
        sqlite.exec("UPDATE calendar_events SET created_at = created_at * 1000 WHERE created_at < 2000000000");
        sqlite.exec("UPDATE users SET created_at = created_at * 1000 WHERE created_at < 2000000000");
        sqlite.exec("UPDATE songs SET created_at = created_at * 1000 WHERE created_at < 2000000000");
        sqlite.exec("UPDATE votes SET created_at = created_at * 1000 WHERE created_at < 2000000000");

        console.log('--- AFTER MIGRATION ---');
        const after = sqlite.prepare('SELECT id, start_time FROM calendar_events ORDER BY id LIMIT 1').get();
        console.log(JSON.stringify(after));
        
        console.log('Migration done.');
    } catch (e) {
        console.error(e);
    }
}

run();
