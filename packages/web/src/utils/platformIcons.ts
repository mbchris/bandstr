export type SupportedPlatform = 'ios' | 'android' | 'web'

export interface IconDefinition {
  android: string
  ios: string
}

/**
 * Mapping of semantic icon keys to platform-appropriate icon identifiers.
 * Android and Web use Google Material Icons.
 * iOS uses Ionicons v4 (ion-ios-* / ion-*).
 */
export const ICON_MAP: Record<string, IconDefinition> = {
  // Primary actions & Navigation
  add: { android: 'add', ios: 'ion-ios-add' },
  add_circle: { android: 'add_circle', ios: 'ion-ios-add-circle' },
  close: { android: 'close', ios: 'ion-ios-close' },
  cancel: { android: 'cancel', ios: 'ion-ios-close-circle' },
  arrow_back: { android: 'arrow_back', ios: 'ion-ios-arrow-back' },
  chevron_left: { android: 'chevron_left', ios: 'ion-ios-arrow-back' },
  chevron_right: { android: 'chevron_right', ios: 'ion-ios-arrow-forward' },
  refresh: { android: 'refresh', ios: 'ion-ios-refresh' },
  replay: { android: 'replay', ios: 'ion-ios-refresh' },
  restart_alt: { android: 'restart_alt', ios: 'ion-ios-refresh-circle' },
  search: { android: 'search', ios: 'ion-ios-search' },
  settings: { android: 'settings', ios: 'ion-ios-settings' },
  home: { android: 'home', ios: 'ion-ios-home' },
  save: { android: 'save', ios: 'ion-ios-checkmark-circle' },
  edit: { android: 'edit', ios: 'ion-ios-create' },
  delete: { android: 'delete', ios: 'ion-ios-trash' },
  delete_forever: { android: 'delete_forever', ios: 'ion-ios-trash' },
  share: { android: 'share', ios: 'ion-ios-share' },
  link: { android: 'link', ios: 'ion-ios-link' },
  content_copy: { android: 'content_copy', ios: 'ion-ios-copy' },
  open_in_new: { android: 'open_in_new', ios: 'ion-ios-open' },
  launch: { android: 'launch', ios: 'ion-ios-open' },
  login: { android: 'login', ios: 'ion-ios-log-in' },

  // Semantic Replacements (GitHub Issue #36 Question 2)
  push_pin: { android: 'push_pin', ios: 'ion-ios-pin' },
  push_pin_outline: { android: 'push_pin', ios: 'ion-ios-pin' },
  library_add: { android: 'library_add', ios: 'ion-ios-add-circle-outline' },
  library_add_check: { android: 'library_add_check', ios: 'ion-ios-checkmark-circle-outline' },
  thumb_up: { android: 'thumb_up', ios: 'ion-ios-thumbs-up' },
  thumb_down: { android: 'thumb_down', ios: 'ion-ios-thumbs-down' },
  done: { android: 'done', ios: 'ion-ios-checkmark' },
  done_all: { android: 'done_all', ios: 'ion-ios-done-all' },
  check: { android: 'check', ios: 'ion-ios-checkmark' },
  check_circle: { android: 'check_circle', ios: 'ion-ios-checkmark-circle' },
  inventory_2: { android: 'inventory_2', ios: 'ion-ios-archive' },
  archive: { android: 'inventory_2', ios: 'ion-ios-archive' },
  unarchive: { android: 'replay', ios: 'ion-ios-refresh' },
  drag_handle: { android: 'drag_handle', ios: 'ion-ios-menu' },
  drag_indicator: { android: 'drag_handle', ios: 'ion-ios-menu' },

  // Music, Setlist & Voting
  playlist_add: { android: 'library_add', ios: 'ion-ios-add-circle-outline' },
  playlist_add_check: { android: 'library_add_check', ios: 'ion-ios-checkmark-circle-outline' },
  playlist_remove: { android: 'playlist_remove', ios: 'ion-ios-remove-circle-outline' },
  queue_music: { android: 'queue_music', ios: 'ion-ios-musical-notes' },
  music_note: { android: 'music_note', ios: 'ion-ios-musical-note' },
  note_add: { android: 'note_add', ios: 'ion-ios-document' },
  description: { android: 'description', ios: 'ion-ios-paper' },
  picture_as_pdf: { android: 'picture_as_pdf', ios: 'ion-ios-document' },
  table_view: { android: 'table_view', ios: 'ion-ios-grid' },
  print: { android: 'print', ios: 'ion-ios-print' },
  download: { android: 'download', ios: 'ion-ios-download' },
  upload: { android: 'upload', ios: 'ion-ios-cloud-upload' },
  how_to_vote: { android: 'thumb_up', ios: 'ion-ios-thumbs-up' },
  star: { android: 'star', ios: 'ion-ios-star' },
  bookmark: { android: 'push_pin', ios: 'ion-ios-pin' },
  bookmark_border: { android: 'push_pin', ios: 'ion-ios-pin' },
  lock: { android: 'lock', ios: 'ion-ios-lock' },
  lock_open: { android: 'lock_open', ios: 'ion-ios-unlock' },
  tune: { android: 'tune', ios: 'ion-ios-options' },
  layers: { android: 'layers', ios: 'ion-ios-albums' },
  celebration: { android: 'celebration', ios: 'ion-ios-gift' },
  pause_circle: { android: 'pause_circle', ios: 'ion-ios-pause' },
  sticky_note_2: { android: 'sticky_note_2', ios: 'ion-ios-paper' },

  // Calendar, Events & Time
  event: { android: 'event', ios: 'ion-ios-calendar' },
  calendar_today: { android: 'calendar_today', ios: 'ion-ios-calendar' },
  schedule: { android: 'schedule', ios: 'ion-ios-time' },
  event_busy: { android: 'event_busy', ios: 'ion-ios-calendar' },
  checklist: { android: 'checklist', ios: 'ion-ios-checkbox-outline' },

  // People & Accounts
  person: { android: 'person', ios: 'ion-ios-person' },
  person_add: { android: 'person_add', ios: 'ion-ios-person-add' },
  group: { android: 'group', ios: 'ion-ios-people' },
  groups: { android: 'groups', ios: 'ion-ios-people' },
  account_circle: { android: 'account_circle', ios: 'ion-ios-contact' },
  manage_accounts: { android: 'manage_accounts', ios: 'ion-ios-construct' },
  mail: { android: 'mail', ios: 'ion-ios-mail' },

  // UI status, alerts, themes
  notifications: { android: 'notifications', ios: 'ion-ios-notifications' },
  light_mode: { android: 'light_mode', ios: 'ion-ios-sunny' },
  dark_mode: { android: 'dark_mode', ios: 'ion-ios-moon' },
  help_outline: { android: 'help_outline', ios: 'ion-ios-help-circle-outline' },
  info: { android: 'info', ios: 'ion-ios-information-circle-outline' },
  warning: { android: 'warning', ios: 'ion-ios-warning' },
  bug_report: { android: 'bug_report', ios: 'ion-ios-bug' },
  privacy_tip: { android: 'privacy_tip', ios: 'ion-ios-shield' },
  credit_card: { android: 'credit_card', ios: 'ion-ios-card' },
  payments: { android: 'payments', ios: 'ion-ios-cash' },
  qr_code_2: { android: 'qr_code_2', ios: 'ion-ios-qr-scanner' },
  visibility: { android: 'visibility', ios: 'ion-ios-eye' },
  block: { android: 'block', ios: 'ion-ios-remove-circle' },
  remove_circle: { android: 'remove_circle', ios: 'ion-ios-remove-circle' },
  insights: { android: 'insights', ios: 'ion-ios-stats' },
  sports_bar: { android: 'sports_bar', ios: 'ion-ios-beer' },
  smartphone: { android: 'smartphone', ios: 'ion-ios-phone-portrait' },
  keyboard_arrow_down: { android: 'keyboard_arrow_down', ios: 'ion-ios-arrow-down' },
  keyboard_arrow_up: { android: 'keyboard_arrow_up', ios: 'ion-ios-arrow-up' },
}

/**
 * Resolves an icon name according to the target platform.
 * Returns the mapped icon, or the original icon name if unmapped.
 */
export function platformIcon(name: string, platform: SupportedPlatform = 'web'): string {
  if (!name) return ''
  // Pass through image / URL icons untouched
  if (name.startsWith('img:') || name.startsWith('http')) {
    return name
  }

  const mapping = ICON_MAP[name]
  if (!mapping) {
    return name
  }

  if (platform === 'ios') {
    return mapping.ios
  }

  return mapping.android
}
