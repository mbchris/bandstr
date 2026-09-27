import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import fs from 'node:fs'
import path from 'node:path'
import { reactive } from 'vue'

// Set environment variables before module imports
process.env.API_URL = 'https://api.bandstr.com'
process.env.MOBILE_CALLBACK_URL = 'org.capacitor.bandstr://localhost/#/login'

const mockBrowserOpen = vi.fn().mockResolvedValue(undefined)
const mockBrowserClose = vi.fn().mockResolvedValue(undefined)
let isNativePlatformMock = true

vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: (...args: unknown[]) => mockBrowserOpen(...args),
    close: (...args: unknown[]) => mockBrowserClose(...args),
  },
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatformMock,
    getPlatform: () => (isNativePlatformMock ? 'ios' : 'web'),
  },
}))

const mockRoute = reactive<{
  path: string
  query: Record<string, string | undefined>
}>({
  path: '/login',
  query: {},
})

const mockRouterReplace = vi.fn().mockResolvedValue(undefined)

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({
    replace: mockRouterReplace,
    push: vi.fn(),
  }),
}))

const mockLoadSession = vi.fn().mockResolvedValue(undefined)
const mockSetToken = vi.fn()

vi.mock('../src/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'u1', name: 'Test User' },
    isAuthenticated: true,
    loadSession: mockLoadSession,
    setToken: mockSetToken,
  }),
}))

vi.mock('../src/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../src/boot/auth', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    signIn: {
      social: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('Mobile OAuth In-App Safari View Controller (Apple Guideline 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    isNativePlatformMock = true
    mockRoute.path = '/login'
    mockRoute.query = {}
    window.open = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Static contract verification', () => {
    const loginPagePath = path.resolve(__dirname, '../src/pages/LoginPage.vue')
    const content = fs.readFileSync(loginPagePath, 'utf-8')

    it('imports Browser from @capacitor/browser', () => {
      expect(content).toMatch(/import\s+\{[^}]*Browser[^}]*\}\s+from\s+['"]@capacitor\/browser['"]/)
    })

    it('invokes Browser.open with presentationStyle popover in startNativeSocialLogin', () => {
      expect(content).toContain('Browser.open(')
      expect(content).toContain("presentationStyle: 'popover'")
    })

    it('invokes Browser.close().catch() in onMounted and token watch handler', () => {
      expect(content).toContain('Browser.close()')
      expect(content).toMatch(/Browser\.close\(\)\.catch\(/)
    })
  })

  describe('Component runtime behavior', () => {
    it('calls Browser.open with popover presentationStyle and does not call window.open on native Google login', async () => {
      const LoginPage = (await import('../src/pages/LoginPage.vue')).default

      const wrapper = mount(LoginPage, {
        global: {
          stubs: {
            'q-btn': {
              template: '<button class="q-btn"><slot /></button>',
            },
            'q-btn-toggle': true,
            'q-form': true,
            'q-input': true,
            'q-separator': true,
            'q-dialog': true,
            'q-card': true,
            'q-card-section': true,
            'q-space': true,
            'q-spinner-orbit': true,
          },
        },
      })

      // Find the Google button (.auth-google-btn) and trigger click
      const googleBtn = wrapper.find('.auth-google-btn')
      expect(googleBtn.exists()).toBe(true)
      await googleBtn.trigger('click')

      expect(mockBrowserOpen).toHaveBeenCalledTimes(1)
      expect(mockBrowserOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('provider=google'),
          presentationStyle: 'popover',
        }),
      )
      expect(window.open).not.toHaveBeenCalled()
    })

    it('calls Browser.open with popover presentationStyle on native GitHub login', async () => {
      const LoginPage = (await import('../src/pages/LoginPage.vue')).default

      const wrapper = mount(LoginPage, {
        global: {
          stubs: {
            'q-btn': {
              template: '<button class="q-btn"><slot /></button>',
            },
            'q-btn-toggle': true,
            'q-form': true,
            'q-input': true,
            'q-separator': true,
            'q-dialog': true,
            'q-card': true,
            'q-card-section': true,
            'q-space': true,
            'q-spinner-orbit': true,
          },
        },
      })

      const githubBtn = wrapper.find('.q-btn-github')
      expect(githubBtn.exists()).toBe(true)
      await githubBtn.trigger('click')

      expect(mockBrowserOpen).toHaveBeenCalledTimes(1)
      expect(mockBrowserOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('provider=github'),
          presentationStyle: 'popover',
        }),
      )
      expect(window.open).not.toHaveBeenCalled()
    })

    it('calls Browser.close() when mounted with a deep-link token query', async () => {
      mockRoute.query = { token: 'sample-jwt-token' }
      const LoginPage = (await import('../src/pages/LoginPage.vue')).default

      mount(LoginPage, {
        global: {
          stubs: {
            'q-btn': true,
            'q-btn-toggle': true,
            'q-form': true,
            'q-input': true,
            'q-separator': true,
            'q-dialog': true,
            'q-card': true,
            'q-card-section': true,
            'q-space': true,
            'q-spinner-orbit': true,
          },
        },
      })

      await vi.waitFor(() => {
        expect(mockBrowserClose).toHaveBeenCalled()
      })
    })

    it('calls Browser.close() when token deep-link query parameter arrives via route watch', async () => {
      mockRoute.query = {}
      const LoginPage = (await import('../src/pages/LoginPage.vue')).default

      mount(LoginPage, {
        global: {
          stubs: {
            'q-btn': true,
            'q-btn-toggle': true,
            'q-form': true,
            'q-input': true,
            'q-separator': true,
            'q-dialog': true,
            'q-card': true,
            'q-card-section': true,
            'q-space': true,
            'q-spinner-orbit': true,
          },
        },
      })

      mockBrowserClose.mockClear()
      mockRoute.query.token = 'newly-arrived-oauth-token'

      await vi.waitFor(() => {
        expect(mockBrowserClose).toHaveBeenCalled()
      })
    })
  })
})
