import { db } from './server/database/index';
import { calendarEvents } from './server/database/schema';

async function run() {
    try {
        const all = await db.select().from(calendarEvents).limit(5);
        console.log('--- DB DATA ---');
        console.log(JSON.stringify(all, null, 2));
        console.log('--- CURRENT TIME ---');
        console.log(new Date().toString());
    } catch (e) {
        console.error(e);
    }
}

run().then(() => process.exit(0));
