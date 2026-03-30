import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { bearer, organization } from 'better-auth/plugins'
import { db } from '../db/index.js'
import * as schema from '../db/schema.js'

function normalizeAuthBaseUrl(apiUrl: string): string {
  try {
    const parsed = new URL(apiUrl)
    // API_URL often points to ".../api". Better Auth baseURL should stay at app origin/path prefix,
    // while auth routes are configured via basePath.
    parsed.pathname = parsed.pathname.replace(/\/+$/, '').replace(/\/api$/, '') || '/'
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return apiUrl.replace(/\/+$/, '').replace(/\/api$/, '')
  }
}

const configuredApiUrl = process.env.API_URL ?? 'http://localhost:3001'
export const authBaseUrl = normalizeAuthBaseUrl(configuredApiUrl)
export const AUTH_BASE_PATH = '/api/auth'
const isProduction = (process.env.NODE_ENV ?? '').toLowerCase() === 'production'
const DEFAULT_SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 365 * 1 // 1 year

function getSessionExpiresInSeconds(): number {
  const fromEnv = Number.parseInt(process.env.AUTH_SESSION_EXPIRES_IN_SECONDS ?? '', 10)
  if (Number.isInteger(fromEnv) && fromEnv > 0) {
    return fromEnv
  }
  return DEFAULT_SESSION_EXPIRES_IN_SECONDS
}

const sessionExpiresInSeconds = getSessionExpiresInSeconds()
const MOBILE_LOCAL_ORIGINS = [
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'org.capacitor.bandstr://localhost',
]

function getTrustedOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS ?? 'http://localhost:9000')
    .split(/[;,]/)
    .map((o) => o.trim())
    .filter(Boolean)

  return Array.from(new Set([...configured, ...MOBILE_LOCAL_ORIGINS]))
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      organization: schema.organizations,
      member: schema.members,
      invitation: schema.invitations,
    },
  }),

  secret: process.env.AUTH_SECRET,
  baseURL: authBaseUrl,
  basePath: AUTH_BASE_PATH,

  trustedOrigins: getTrustedOrigins(),

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    github: {
      clientId: process.env.GHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GHUB_CLIENT_SECRET ?? '',
    },
  },

  plugins: [
    bearer(),
    organization({
      // Organizations = Bands in our domain
      // Better Auth manages org membership; we sync to band_members for app-level data
      allowUserToCreateOrganization: true,
    }),
  ],

  user: {
    additionalFields: {},
  },

  session: {
    // Default to effectively non-expiring sessions (100y) unless overridden by env.
    // Session/token invalidation is handled explicitly via logout/revocation.
    expiresIn: sessionExpiresInSeconds,
    disableSessionRefresh: true,
    // Support both cookie (web) and bearer token (mobile/Capacitor)
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 1 week
    },
  },

  advanced: {
    // Native app origin (https://localhost) talks to remote API origin, so
    // session cookies must be allowed in cross-site requests in production.
    defaultCookieAttributes: isProduction ? { sameSite: 'none' } : undefined,
    useSecureCookies: isProduction,
    crossSubDomainCookies: {
      enabled: isProduction,
    },
  },
})

export type Auth = typeof auth
