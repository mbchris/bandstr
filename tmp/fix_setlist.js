const fs = require('fs');
let setlist = fs.readFileSync('c:/dev/bandstr/pages/setlist.vue', 'utf8');

// 1. Fix gigOptions formatting
setlist = setlist.replace(
    /const gigOptions = computed\(\(\) => Array\.isArray\(gigsData\.value\) \? gigsData\.value\.map\(g => \(\{ label: g\.title, value: g\.id \}\)\) : \[\]\);/,
    `const gigOptions = computed(() => Array.isArray(gigsData.value) ? gigsData.value.map(g => {
    let dateStr = '';
    if (g.startTime) {
        try {
            dateStr = new Date(g.startTime).toISOString().split('T')[0];
        } catch (e) {}
    }
    return { label: dateStr ? \`\${dateStr} \${g.title}\` : g.title, value: g.id };
}) : []);`
);

// 2. Fix songs fetching
setlist = setlist.replace(
    /const songsUrl = computed\(\(\) => selectedGigId\.value \? '\/api\/gigs\/' \+ selectedGigId\.value \+ '\/songs' : '\/api\/songs'\);\s*const \{ data: songs, refresh: refreshSongs \} = await useFetch<any\[\]>\(\(\) => songsUrl\.value\);\s*watch\(selectedGigId, \(\) => refreshSongs\(\)\);/,
    `const { data: songs, refresh: refreshSongs } = await useAsyncData('songsData', () => {
    const url = selectedGigId.value ? '/api/gigs/' + selectedGigId.value + '/songs' : '/api/songs';
    return $fetch(url);
}, { watch: [selectedGigId] });`
);

// 3. Fix filteredSongs
setlist = setlist.replace(
    /let list = Array\.isArray\(songs\.value\) \? songs\.value\.filter\(\(s:any\) => s\.isSetlist\) : \[\];/,
    `let list = Array.isArray(songs.value) ? songs.value.filter((s:any) => selectedGigId.value ? true : s.isSetlist) : [];`
);

fs.writeFileSync('c:/dev/bandstr/pages/setlist.vue', setlist);
console.log("pages/setlist.vue updated successfully.");
