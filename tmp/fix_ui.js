const fs = require('fs');

let setlist = fs.readFileSync('c:/dev/bandstr/pages/setlist.vue', 'utf8');

// 1. Fix Header
setlist = setlist.replace(
    /<h2 class="text-2xl font-bold">\{\{ t\('setlist\.heading'\) \}\}<\/h2>\s*<div class="flex gap-2">/,
    `<div class="flex items-center gap-2">
                <h2 class="text-2xl font-bold">{{ t('setlist.heading') }}</h2>
                <USelect v-model="selectedGigId" :options="[{label: 'Master Setlist', value: null}, ...gigOptions]" class="w-48 ml-4 lg:ml-8" />
            </div>
            <div class="flex gap-2">`
);

setlist = setlist.replace(
    /<UButton icon="i-heroicons-arrow-down-tray" color="gray" variant="ghost" :label="t\('setlist\.exportExcel'\)" @click="handleExport" \/>/,
    `<UTooltip :text="t('setlist.exportExcel')"><UButton icon="i-heroicons-arrow-down-tray" color="gray" variant="ghost" @click="handleExport" /></UTooltip>`
);
setlist = setlist.replace(
    /<UButton icon="i-heroicons-clock" color="gray" variant="soft" :label="t\('setlist\.addPause'\)" @click="openSpecialModal\('pause'\)" \/>/,
    `<UTooltip :text="t('setlist.addPause')"><UButton icon="i-heroicons-clock" color="gray" variant="soft" @click="openSpecialModal('pause')" /></UTooltip>`
);
setlist = setlist.replace(
    /<UButton icon="i-heroicons-swatch" color="gray" variant="soft" :label="t\('setlist\.changeTuning'\)" @click="openSpecialModal\('tuning'\)" \/>/,
    `<UTooltip :text="t('setlist.changeTuning')"><UButton icon="i-heroicons-swatch" color="gray" variant="soft" @click="openSpecialModal('tuning')" /></UTooltip>
                <UTooltip :text="t('voting.suggestSong')"><UButton icon="i-heroicons-plus" color="primary" @click="openAddSongModal" /></UTooltip>`
);

// 2. Fix Tooltips in setlist
setlist = setlist.replace(
    /<UTooltip v-if="item\.notes" :text="item\.notes">\s*<UIcon name="i-heroicons-information-circle-solid" class="text-gray-400 w-4 h-4 cursor-help" \/>\s*<\/UTooltip>/g,
    `<UPopover v-if="item.notes" mode="hover" :popper="{ placement: 'top' }">
                                        <UButton icon="i-heroicons-information-circle-solid" color="gray" variant="ghost" class="p-1 hover:bg-transparent" ui="{ icon: { size: { sm: 'w-6 h-6' } } }" />
                                        <template #panel>
                                            <div class="p-4 max-w-sm text-sm whitespace-pre-wrap">{{ item.notes }}</div>
                                        </template>
                                    </UPopover>`
);

// 3. Add modals for gig setlists
if (!setlist.includes('isAddGigSongModalOpen')) {
setlist = setlist.replace(
    /<!-- Edit Song Modal -->/,
    `<!-- Add Modals -->
    <UModal v-model="isAddSongModalOpen" v-if="!selectedGigId">
      <UCard>
        <template #header>
           <h3 class="font-bold text-lg">Add New Song to Master Setlist</h3>
        </template>
        <div class="space-y-4">
           <UFormGroup :label="t('voting.songTitle')" required>
               <UInput v-model="addSongForm.title" autofocus />
           </UFormGroup>
           <UFormGroup :label="t('voting.artist')" required>
               <UInput v-model="addSongForm.artist" />
           </UFormGroup>
           <div class="flex justify-end gap-3 mt-8">
               <UButton color="gray" variant="ghost" @click="isAddSongModalOpen = false">{{ t('common.cancel') }}</UButton>
               <UButton color="primary" @click="submitAddSong" :loading="isSaving">Add Song</UButton>
           </div>
        </div>
      </UCard>
    </UModal>
    
    <UModal v-model="isAddGigSongModalOpen" v-if="selectedGigId">
      <UCard>
        <template #header>
           <h3 class="font-bold text-lg">Add Master Song to Gig Setlist</h3>
        </template>
        <div class="space-y-4">
           <UFormGroup label="Select Song from Master Setlist" required>
               <USelectMenu v-model="selectedMasterSongId" :options="masterSongOptions" value-attribute="value" option-attribute="label" searchable />
           </UFormGroup>
           <div class="flex justify-end gap-3 mt-8">
               <UButton color="gray" variant="ghost" @click="isAddGigSongModalOpen = false">{{ t('common.cancel') }}</UButton>
               <UButton color="primary" @click="submitAddGigSong" :loading="isSaving" :disabled="!selectedMasterSongId">Add to Gig</UButton>
           </div>
        </div>
      </UCard>
    </UModal>

    <!-- Edit Song Modal -->`
);
}

fs.writeFileSync('c:/dev/bandstr/pages/setlist.vue', setlist);

let voting = fs.readFileSync('c:/dev/bandstr/pages/voting.vue', 'utf8');

voting = voting.replace(
    /<UButton icon="i-heroicons-arrow-down-tray" color="gray" variant="ghost" :label="t\('voting\.exportExcel'\)" @click="handleExport" \/>/,
    `<UTooltip :text="t('voting.exportExcel')"><UButton icon="i-heroicons-arrow-down-tray" color="gray" variant="ghost" @click="handleExport" /></UTooltip>`
);
voting = voting.replace(
    /<UButton icon="i-heroicons-plus" color="primary" :label="t\('voting\.suggestSong'\)" @click="openAddModal" \/>/,
    `<UTooltip :text="t('voting.suggestSong')"><UButton icon="i-heroicons-plus" color="primary" @click="openAddModal" /></UTooltip>`
);

fs.writeFileSync('c:/dev/bandstr/pages/voting.vue', voting);

console.log("Files properly patched.");
