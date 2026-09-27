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

let isNativePlatformMock = false

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
    user: null,
    isAuthenticated: false,
    loadSession: mockLoadSession,
    setToken: mockSetToken,
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

describe('Email Verification Delivery & Resend Flow (Guideline 2.1(a))', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    isNativePlatformMock = false
    mockRoute.path = '/login'
    mockRoute.query = {}
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('Static template, i18n, and contract verification', () => {
    const loginPagePath = path.resolve(__dirname, '../src/pages/LoginPage.vue')
    const content = fs.readFileSync(loginPagePath, 'utf-8')
    const enPath = path.resolve(__dirname, '../src/i18n/en.ts')
    const dePath = path.resolve(__dirname, '../src/i18n/de.ts')
    const enContent = fs.readFileSync(enPath, 'utf-8')
    const deContent = fs.readFileSync(dePath, 'utf-8')

    it('contains lastRegisteredEmail ref and resendVerificationEmail handler in LoginPage.vue', () => {
      expect(content).toContain('lastRegisteredEmail')
      expect(content).toContain('resendVerificationEmail')
      expect(content).toContain('/send-verification-email')
      expect(content).toContain('auth-resend-verification-btn')
    })

    it('contains verificationCallbackUrl resolving native and web callback appropriately in LoginPage.vue', () => {
      expect(content).toContain('verificationCallbackUrl')
      expect(content).toContain('nativeCallbackUrl')
    })

    it('contains resend verification translation keys in en.ts and de.ts', () => {
      expect(enContent).toContain('resendVerification:')
      expect(enContent).toContain('verificationResent:')
      expect(enContent).toContain('resendFailed:')

      expect(deContent).toContain('resendVerification:')
      expect(deContent).toContain('verificationResent:')
      expect(deContent).toContain('resendFailed:')
    })
  })

  describe('Component runtime behavior', () => {
    const mountLoginPage = async () => {
      const LoginPage = (await import('../src/pages/LoginPage.vue')).default
      return mount(LoginPage, {
        global: {
          stubs: {
            'q-btn': {
              template: '<button class="q-btn" :class="[$attrs.class, { loading }]" :disabled="loading || disable" @click="$emit(\'click\', $event)">{{ label }}<slot /></button>',
              props: ['label', 'loading', 'disable'],
            },
            'q-btn-toggle': {
              template: '<div class="q-btn-toggle"><button v-for="opt in options" :key="opt.value" :class="`toggle-${opt.value}`" @click="$emit(\'update:modelValue\', opt.value)">{{ opt.label }}</button></div>',
              props: ['options', 'modelValue'],
            },
            'q-form': {
              template: '<form @submit="$emit(\'submit\', $event)"><slot /></form>',
            },
            'q-input': {
              template: '<div class="q-input"><input :type="type || \'text\'" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /></div>',
              props: ['modelValue', 'type', 'label'],
            },
            'q-separator': true,
            'q-dialog': true,
            'q-card': true,
            'q-card-section': true,
            'q-space': true,
            'q-spinner-orbit': true,
          },
        },
      })
    }

    it('displays resend verification button after email sign up and triggers /send-verification-email on click', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const urlStr = String(url)
        if (urlStr.includes('/sign-up/email')) {
          return {
            ok: true,
            json: async () => ({ status: true }),
          }
        }
        if (urlStr.includes('/send-verification-email')) {
          const body = JSON.parse(String(init?.body || '{}'))
          return {
            ok: true,
            json: async () => ({ status: true, email: body.email }),
          }
        }
        return {
          ok: true,
          json: async () => ({}),
        }
      })
      global.fetch = mockFetch as unknown as typeof fetch

      const wrapper = mountLoginPage()
      const vm = (await wrapper)

      // Switch to signup mode
      const signupToggle = vm.find('.toggle-signup')
      if (signupToggle.exists()) {
        await signupToggle.trigger('click')
      }

      // Fill in signup form inputs: name, email, password
      const inputs = vm.findAll('input')
      expect(inputs.length).toBeGreaterThanOrEqual(3)
      await inputs[0].setValue('Apple Reviewer')
      await inputs[1].setValue('reviewer@apple.com')
      await inputs[2].setValue('SecretPass123!')

      // Submit signup form
      const form = vm.find('form')
      expect(form.exists()).toBe(true)
      await form.trigger('submit')

      // Wait for async signup
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/sign-up/email'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('reviewer@apple.com'),
          }),
        )
      })

      // The resend verification button should now be visible
      await vi.waitFor(() => {
        const resendBtn = vm.find('.auth-resend-verification-btn')
        expect(resendBtn.exists()).toBe(true)
      })

      const resendBtn = vm.find('.auth-resend-verification-btn')
      await resendBtn.trigger('click')

      // Verify /send-verification-email was called with the registered email
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/send-verification-email'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"email":"reviewer@apple.com"'),
          }),
        )
      })
    })

    it('shows error state when resend verification fails', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        const urlStr = String(url)
        if (urlStr.includes('/sign-up/email')) {
          return {
            ok: true,
            json: async () => ({ status: true }),
          }
        }
        if (urlStr.includes('/send-verification-email')) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ message: 'SMTP connection timeout' }),
          }
        }
        return {
          ok: true,
          json: async () => ({}),
        }
      })
      global.fetch = mockFetch as unknown as typeof fetch

      const vm = await mountLoginPage()

      // Switch to signup mode
      const signupToggle = vm.find('.toggle-signup')
      if (signupToggle.exists()) {
        await signupToggle.trigger('click')
      }

      const inputs = vm.findAll('input')
      await inputs[0].setValue('Apple Reviewer')
      await inputs[1].setValue('reviewer-fail@apple.com')
      await inputs[2].setValue('SecretPass123!')

      const form = vm.find('form')
      await form.trigger('submit')

      await vi.waitFor(() => {
        const resendBtn = vm.find('.auth-resend-verification-btn')
        expect(resendBtn.exists()).toBe(true)
      })

      const resendBtn = vm.find('.auth-resend-verification-btn')
      await resendBtn.trigger('click')

      await vi.waitFor(() => {
        expect(vm.text()).toContain('SMTP connection timeout')
      })
    })

    it('uses native verification callback URL on native platforms for sign-up and resend', async () => {
      isNativePlatformMock = true

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const urlStr = String(url)
        if (urlStr.includes('/sign-up/email')) {
          return {
            ok: true,
            json: async () => ({ status: true }),
          }
        }
        if (urlStr.includes('/send-verification-email')) {
          const body = JSON.parse(String(init?.body || '{}'))
          return {
            ok: true,
            json: async () => ({ status: true, email: body.email }),
          }
        }
        return {
          ok: true,
          json: async () => ({}),
        }
      })
      global.fetch = mockFetch as unknown as typeof fetch

      const vm = await mountLoginPage()

      // Switch to signup mode
      const signupToggle = vm.find('.toggle-signup')
      if (signupToggle.exists()) {
        await signupToggle.trigger('click')
      }

      const inputs = vm.findAll('input')
      await inputs[0].setValue('Native User')
      await inputs[1].setValue('native@apple.com')
      await inputs[2].setValue('SecretPass123!')

      const form = vm.find('form')
      await form.trigger('submit')

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/sign-up/email'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"callbackURL":"org.capacitor.bandstr://localhost/#/login?verified=1"'),
          }),
        )
      })

      await vi.waitFor(() => {
        const resendBtn = vm.find('.auth-resend-verification-btn')
        expect(resendBtn.exists()).toBe(true)
      })

      const resendBtn = vm.find('.auth-resend-verification-btn')
      await resendBtn.trigger('click')

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/send-verification-email'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"callbackURL":"org.capacitor.bandstr://localhost/#/login?verified=1"'),
          }),
        )
      })
    })

    it('displays resend verification button when signInWithEmail fails for pre-existing unverified users', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const urlStr = String(url)
        if (urlStr.includes('/sign-in/email')) {
          return {
            ok: false,
            status: 403,
            json: async () => ({ message: 'Email not verified' }),
          }
        }
        if (urlStr.includes('/send-verification-email')) {
          const body = JSON.parse(String(init?.body || '{}'))
          return {
            ok: true,
            json: async () => ({ status: true, email: body.email }),
          }
        }
        return {
          ok: true,
          json: async () => ({}),
        }
      })
      global.fetch = mockFetch as unknown as typeof fetch

      const vm = await mountLoginPage()

      // Default authMode is signin
      const inputs = vm.findAll('input')
      expect(inputs.length).toBeGreaterThanOrEqual(2)
      await inputs[0].setValue('unverified@apple.com')
      await inputs[1].setValue('SecretPass123!')

      const form = vm.find('form')
      await form.trigger('submit')

      // Error message should be visible and resend button should appear
      await vi.waitFor(() => {
        expect(vm.text()).toContain('Email not verified')
        const resendBtn = vm.find('.auth-resend-verification-btn')
        expect(resendBtn.exists()).toBe(true)
      })

      const resendBtn = vm.find('.auth-resend-verification-btn')
      await resendBtn.trigger('click')

      // Resend request sent with pre-existing unverified user's email
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/send-verification-email'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"email":"unverified@apple.com"'),
          }),
        )
      })
    })
  })
})
