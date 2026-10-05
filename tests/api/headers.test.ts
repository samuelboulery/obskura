import { afterEach, describe, expect, test, vi } from 'vitest'
import nextConfig from '@/next.config'

async function csp() {
  const [{ headers }] = (await nextConfig.headers?.()) ?? []
  const all = Object.fromEntries(headers.map((h) => [h.key, h.value]))
  return { all, csp: all['Content-Security-Policy'] ?? '' }
}

afterEach(() => vi.unstubAllEnvs())

describe('en-têtes de sécurité', () => {
  test('en production, plus de unsafe-eval', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect((await csp()).csp).not.toContain("'unsafe-eval'")
  })

  test('en développement, unsafe-eval reste — le HMR de Next en dépend', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect((await csp()).csp).toContain("'unsafe-eval'")
  })

  test.each(["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"])(
    'la CSP contient %s',
    async (directive) => {
      expect((await csp()).csp).toContain(directive)
    }
  )

  test('le beacon Cloudflare chargé par le layout est autorisé', async () => {
    const { csp: value } = await csp()
    expect(value).toMatch(/script-src[^;]*https:\/\/static\.cloudflareinsights\.com/)
    expect(value).toMatch(/connect-src[^;]*https:\/\/cloudflareinsights\.com/)
  })

  test('Permissions-Policy coupe caméra, micro et géolocalisation', async () => {
    expect((await csp()).all['Permissions-Policy']).toMatch(/camera=\(\).*microphone=\(\).*geolocation=\(\)/)
  })

  test('Next ne s’annonce pas', () => {
    expect(nextConfig.poweredByHeader).toBe(false)
  })
})
