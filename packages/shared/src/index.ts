// Shared types between API and frontend

export type PlanId = 'free' | 'band' | 'pro'

export type BandRole = 'owner' | 'admin' | 'member'

export type SongType = 'song' | 'pause' | 'tuning'

export type CalendarEventType = 'rehearsal' | 'gig' | 'event' | 'unavailability'

export interface Plan {
  id: PlanId
  name: string
  price: number
  currency: string
  limits: {
    bands: number | null
    songs: number | null
    members: number | null
  }
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'EUR',
    limits: { bands: 1, songs: 20, members: 5 },
  },
  band: {
    id: 'band',
    name: 'Band',
    price: 5,
    currency: 'EUR',
    limits: { bands: 1, songs: null, members: 10 },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 12,
    currency: 'EUR',
    limits: { bands: 3, songs: null, members: null },
  },
}
