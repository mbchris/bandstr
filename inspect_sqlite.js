const Database = require('better-sqlite3');
const { join } = require('path');

async function run() {
    try {
        const sqlite = new Database(join(process.cwd(), '.data', 'sqlite.db'), { readonly: true });
        const all = sqlite.prepare('SELECT id, title, start_time, type FROM calendar_events LIMIT 10').all();
        console.log('--- RAW DB DATA ---');
        console.log(JSON.stringify(all, null, 2));
        console.log('--- CURRENT TIME ---');
        console.log(Date.now());
    } catch (e) {
        console.error(e);
    }
}

run();
