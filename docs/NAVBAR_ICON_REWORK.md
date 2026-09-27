# Navigation Bar & Icon Redesign Specification — bandstr

This document outlines the UI/UX overhaul of the primary navigation bar and icons for **bandstr** across iOS and Android. It replaces cluttered, low-contrast, skeuomorphic graphics with modern, legible vector glyphs aligned with Apple Human Interface Guidelines (SF Symbols) and Google Material 3 (Material Symbols).

---

## 1. Problem Audit (Current Design)

1. **Micro-details and Clutter:**
   * **Voting:** A hand dropping a card into a ballot box with a tiny checkmark badge is unreadable at standard mobile sizes (20–24px).
   * **Setlist & Calendar:** Faux document text lines and hardcoded numbers (`"24"`) degrade into blurry pixel clusters on lower-DPI displays.
   * **Admin:** A human silhouette squeezed inside a gear wheel creates noisy geometry and ruins the iconic silhouette of both symbols.
2. **Inconsistent Art Style & Stroke Weights:**
   * Current icons combine fills, multi-tone gradients, and varying outline thicknesses, lacking a unified optical weight.
3. **Heavy Button/Tile Containers:**
   * Enclosing each tab item in an opaque, rounded rectangular box creates unnecessary visual borders and consumes vertical screen space, mimicking a 2012-era desktop toolbar rather than a modern native mobile bottom/top navigation bar.

---

## 2. Icon Replacement Proposals

For cross-platform Quasar apps, **Lucide Icons**, **Phosphor Icons**, or **Material Symbols** are recommended. They offer identical stroke weights and map directly to native iOS SF Symbols.

| Tab | Current Issue | Recommended Metaphor | Icon Name (Lucide / Material / SF Symbols) | Rationale for a Band Management App |
| :--- | :--- | :--- | :--- | :--- |
| **Home** | 3D beveled house with shadows. | **Minimal House Outline** | `house` / `home` / `house.fill` | Universally recognized landmark for the dashboard/overview. Single stroke with door cutout. |
| **Voting** | Election-style ballot box with hand. | **Thumbs Up** or **Vote Check** | `thumbs-up` or `vote` / `hand.thumbsup` | Song voting in a band context is about quick consensus ("Do we want this song in the repertoire?"), not an electoral ballot. |
| **Setlist** | Generic text document with notes. | **Music List / Playlist** | `list-music` or `queue_music` / `music.note.list` | Combines 3 horizontal track lines with a musical note, immediately communicating an *ordered sequence of songs to perform*. |
| **Calendar** | Desk calendar with tiny "24" & dots. | **Clean Calendar Grid** | `calendar` or `event` / `calendar` | Removed arbitrary numbers. Standard 2-ring binder outline with 4 clean grid cells scales crisply. |
| **Admin** | Crowded gear containing an avatar. | **Clean 6-Tooth Gear** | `settings` / `settings` / `gearshape` | Standardized gear silhouette. If admin functionality is purely role/permission-based, a `shield-check` is a viable alternative. |

---

## 3. Active vs. Inactive State Design

Modern mobile guidelines dictate that tab states should be differentiated via **stroke vs. solid fill** and **color contrast**, not by wrapping the tab inside a heavy, dark background tile.

* **Inactive State:** Stroke/linear icon (1.75px–2px stroke weight). Muted text/icon color.
* **Active State:** Solid filled icon (or bolder stroke) tinted in the brand primary color, accompanied by a 1px upward optical lift.

### Color Mapping to `bandstr` Theme Tokens

| Element | Bright (Light) Mode | Dark Mode | Source Variable |
| :--- | :--- | :--- | :--- |
| **Bar Background** | `rgba(250, 251, 253, 0.92)` | `rgba(24, 24, 27, 0.92)` | MainLayout nav bg (`backdrop-filter: blur(16px)`) |
| **Bar Border** | `rgba(148, 163, 184, 0.2)` | `rgba(255, 255, 255, 0.08)` | `$secondary` (20%) / `--border` |
| **Inactive Icon & Label** | `#6b7280` | `#a1a1aa` | `--text-muted` |
| **Active Icon & Label** | `#6366f1` | `#818cf8` / `#6366f1` | `$primary` (slightly lightened for dark contrast) |
| **Active Tab Pill (Optional)**| `rgba(99, 102, 241, 0.10)` | `rgba(99, 102, 241, 0.20)` | `$primary` with 10–20% opacity |

---

## 4. Implementation Reference

### Component Template (`MainLayout.vue` navigation segment)

```vue
<template>
  <nav class="bandstr-bottom-nav">
    <button
      v-for="tab in navigationTabs"
      :key="tab.id"
      :class="['nav-item', { active: currentTab === tab.id }]"
      @click="currentTab = tab.id"
      type="button"
      :aria-label="tab.label"
    >
      <div class="icon-container">
        <!-- Renders filled variant when active, outline variant when inactive -->
        <component
          :is="currentTab === tab.id ? tab.activeIcon : tab.icon"
          class="tab-icon"
        />
      </div>
      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script setup>
import { ref } from 'vue';
import {
  Home,
  ThumbsUp,
  ListMusic,
  Calendar,
  Settings
} from 'lucide-vue-next';

const currentTab = ref('home');

const navigationTabs = [
  { id: 'home', label: 'Home', icon: Home, activeIcon: Home },
  { id: 'voting', label: 'Voting', icon: ThumbsUp, activeIcon: ThumbsUp },
  { id: 'setlist', label: 'Setlist', icon: ListMusic, activeIcon: ListMusic },
  { id: 'calendar', label: 'Calendar', icon: Calendar, activeIcon: Calendar },
  { id: 'admin', label: 'Admin', icon: Settings, activeIcon: Settings }
];
</script>