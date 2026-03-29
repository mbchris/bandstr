import { db } from './server/database/index.js';
import { songs } from './server/database/schema.js';
import { isNotNull } from 'drizzle-orm';

async function main() {
    const allSongs = await db.select().from(songs).where(isNotNull(songs.spotifyUrl));
    console.log("ALL SONGS:");
    for (const song of allSongs) {
        console.log(`- ID ${song.id}: ${song.spotifyUrl}`);
        const match = song.spotifyUrl?.match(/track\/([a-zA-Z0-9]+)/);
        console.log("  Match:", match ? match[1] : null);
    }
}
main();
