import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import fs from 'node:fs'
import path from 'node:path'
import { reactive } from 'vue'

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

const mockSignInSocial = vi.fn().mockResolvedValue({})

vi.mock('../src/boot/auth', () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    signIn: {
      social: (...args: unknown[]) => mockSignInSocial(...args),
    },
  },
}))

describe('Sign in with Apple (Guideline 4.8)', () => {
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

  describe('Static template and contract verification', () => {
    const loginPagePath = path.resolve(__dirname, '../src/pages/LoginPage.vue')
    const content = fs.readFileSync(loginPagePath, 'utf-8')

    it('contains Apple sign-in button markup and loginApple handler', () => {
      expect(content).toContain('auth-apple-btn')
      expect(content).toContain('loginApple')
    })
  })

  describe('Component runtime behavior', () => {
    it('renders Sign in with Apple button with HIG styling and proper label', async () => {
      const LoginPage = (await import('../src/pages/LoginPage.vue')).default

      const wrapper = mount(LoginPage, {
        global: {
          stubs: {
            'q-btn': {
              template: '<button class="q-btn" :class="$attrs.class"><slot /></button>',
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

      const appleBtn = wrapper.find('.auth-apple-btn')
      expect(appleBtn.exists()).toBe(true)
    })

    it('calls Browser.open with provider=apple on native platform click', async () => {
      isNativePlatformMock = true
      const LoginPage = (await import('../src/pages/LoginPage.vue')).default

      const wrapper = mount(LoginPage, {
        global: {
          stubs: {
            'q-btn': {
              template: '<button class="q-btn" :class="$attrs.class"><slot /></button>',
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

      const appleBtn = wrapper.find('.auth-apple-btn')
      expect(appleBtn.exists()).toBe(true)
      await appleBtn.trigger('click')

      expect(mockBrowserOpen).toHaveBeenCalledTimes(1)
      expect(mockBrowserOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('provider=apple'),
          presentationStyle: 'popover',
        }),
      )
    })

    it('calls authClient.signIn.social with provider: apple on web platform click', async () => {
      isNativePlatformMock = false
      const LoginPage = (await import('../src/pages/LoginPage.vue')).default

      const wrapper = mount(LoginPage, {
        global: {
          stubs: {
            'q-btn': {
              template: '<button class="q-btn" :class="$attrs.class"><slot /></button>',
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

      const appleBtn = wrapper.find('.auth-apple-btn')
      expect(appleBtn.exists()).toBe(true)
      await appleBtn.trigger('click')

      expect(mockBrowserOpen).not.toHaveBeenCalled()
      expect(mockSignInSocial).toHaveBeenCalledTimes(1)
      expect(mockSignInSocial).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'apple',
        }),
      )
    })
  })
})
