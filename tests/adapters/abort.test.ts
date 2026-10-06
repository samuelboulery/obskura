// @vitest-environment node
// Le SDK OpenAI refuse de s'instancier sous jsdom : ces appels réels tournent sous Node.
import { describe, expect, test, vi } from 'vitest'
import { nanoBanana2Adapter } from '@/lib/adapters/nano-banana-2'

// Le SDK Gemini n'écoute que l'événement `abort` : un signal déjà annulé ne
// l'arrête pas. On vérifie donc le contrat — le signal atteint `config`.
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }))
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent }
  },
}))
import { gptImage2Adapter } from '@/lib/adapters/gpt-image-2'
import { parseGenerationRequest } from '@/lib/adapters/validate'

const requete = () =>
  parseGenerationRequest({
    adapterId: 'nano-banana-2',
    prompt: 'un phare',
    params: {
      aspectRatio: '1:1', resolution: '2K', batch: 1, seed: null, seedLock: false,
      fileFormat: 'png', transparent: false, compression: 80,
      personGeneration: 'allow_adult', moderation: 'auto', language: 'fr', extraParams: [],
    },
  })

describe('adapters — le signal d’annulation atteint le SDK', () => {
  test.each([
    ['gpt-image-2', gptImage2Adapter, 'sk-FACTICE'],
  ] as const)('%s : un signal déjà annulé coupe l’appel avant le réseau', async (_, adapter, cle) => {
    const controller = new AbortController()
    controller.abort()
    await expect(adapter.generate(requete(), cle, controller.signal)).rejects.toThrow(/abort/i)
  })
})

test('nano-banana-2 : le signal est transmis au SDK dans config.abortSignal', async () => {
  generateContent.mockResolvedValue({
    candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] } }],
  })
  const controller = new AbortController()

  await nanoBanana2Adapter.generate(requete(), 'AIzaFACTICE', controller.signal)

  expect(generateContent.mock.calls[0][0].config.abortSignal).toBe(controller.signal)
})
