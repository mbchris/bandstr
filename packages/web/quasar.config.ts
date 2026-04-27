import { configure } from 'quasar/wrappers'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '../..')
const androidGradleFile = path.resolve(__dirname, 'src-capacitor/android/app/build.gradle')

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function readEnvValueFromFile(filePath: string, key: string): string | undefined {
  if (!existsSync(filePath)) return undefined

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const lineKey = trimmed.slice(0, idx).trim()
    if (lineKey !== key) continue
    const value = trimmed.slice(idx + 1).trim()
    return stripWrappingQuotes(value)
  }

  return undefined
}

function getEnvValue(key: string): string {
  const direct = process.env[key]
  if (direct !== undefined && direct !== '') return direct

  const configuredEnvFile = process.env.ENV_FILE?.trim()
  const envFilePath = configuredEnvFile
    ? path.isAbsolute(configuredEnvFile)
      ? configuredEnvFile
      : path.resolve(repoRoot, configuredEnvFile)
    : undefined

  const candidates = [envFilePath, path.resolve(repoRoot, '.env.web'), path.resolve(repoRoot, '.env.local'), path.resolve(repoRoot, '.env')].filter(
    (v): v is string => Boolean(v),
  )

  for (const candidate of candidates) {
    const value = readEnvValueFromFile(candidate, key)
    if (value !== undefined && value !== '') return value
  }

  return ''
}

function readGitRev(): string {
  const configuredGitRev = getEnvValue('GIT_REV').trim()
  const normalizedGitRev = configuredGitRev.toLowerCase()
  if (configuredGitRev && normalizedGitRev !== 'unknown' && normalizedGitRev !== 'dev') {
    return configuredGitRev
  }

  const sourceCommit = getEnvValue('SOURCE_COMMIT').trim()
  const normalizedSourceCommit = sourceCommit.toLowerCase()
  if (sourceCommit && normalizedSourceCommit !== 'unknown' && normalizedSourceCommit !== 'dev') {
    return sourceCommit.slice(0, 8)
  }

  try {
    return execSync('git rev-parse --short=8 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

function readAndroidVersionName(): string {
  if (!existsSync(androidGradleFile)) return 'unknown'
  try {
    const content = readFileSync(androidGradleFile, 'utf8')
    const match = content.match(/versionName\s+"([^"]+)"/)
    return match?.[1]?.trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

export default configure(function (/* ctx */) {
  const rawApiUrl = getEnvValue('API_URL').trim()
  const debugMode = getEnvValue('DEBUG_MODE').trim().toLowerCase() === 'true'
  const gitRev = readGitRev()
  const appVersion = readAndroidVersionName()
  const mobileCallbackUrl = getEnvValue('MOBILE_CALLBACK_URL').trim() || 'org.capacitor.bandstr://localhost/login'
  const apiTarget =
    process.env.API_TARGET ||
    (rawApiUrl.startsWith('http://') || rawApiUrl.startsWith('https://')
      ? rawApiUrl
      : `http://localhost:${process.env.API_PORT || process.env.PORT || '3001'}`)
  const apiUrl = rawApiUrl.replace(/\/+$/, '').replace(/\/api$/, '')

  return {
    eslint: {
      fix: true,
    },

    boot: ['pinia', 'deeplink', 'auth', 'api', 'push', 'i18n'],

    css: ['app.scss'],

    extras: ['material-icons'],

    build: {
      target: {
        browser: ['es2022', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
        node: 'node20',
      },
      vueRouterMode: 'history',
      vitePlugins: [],
      env: {
        API_URL: apiUrl,
        DEBUG_MODE: String(debugMode),
        GIT_REV: gitRev,
        SOURCE_COMMIT: gitRev,
        APP_VERSION: appVersion,
        MOBILE_CALLBACK_URL: mobileCallbackUrl,
      },
    },

    devServer: {
      port: 9000,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },

    framework: {
      config: {
        dark: 'auto',
        notify: {
          position: 'top',
          timeout: 3200,
          classes: 'bandstr-notify',
        },
      },
      plugins: ['Notify', 'Dialog', 'Loading', 'LocalStorage'],
    },

    animations: [],

    ssr: {
      pwa: false,
    },

    capacitor: {
      hideSplashscreen: true,
    },

    pwa: {
      workboxMode: 'GenerateSW',
      injectPwaMetaTags: true,
      swFilename: 'sw.js',
      manifestFilename: 'manifest.json',
    },
  }
})
