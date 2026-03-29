import { db } from './server/database';
import { calendarEvents } from './server/database/schema';

async function run() {
    const all = await db.select().from(calendarEvents).limit(5);
    console.log(JSON.stringify(all, null, 2));
    console.log('Now:', new Date().getTime());
}

run();
