'use client'

import { useState } from 'react'
import { ArrowSquareOutIcon, EyeIcon, EyeSlashIcon, TrashIcon } from '@phosphor-icons/react/dist/ssr'
import Dialog from './Dialog'
import { Field, IconButton, Section, Segmented } from '@/components/atelier/ui'
import { ADAPTERS, MODELS } from '@/lib/adapters/capabilities'
import type { Prefs } from '@/lib/atelier/storage'
import { ENRICH_DEFAULT_MODEL } from '@/lib/enrich'
import { useT } from '@/lib/i18n'
import type { KeyKind } from '@/lib/types'

interface KeysDialogProps {
  keys: Record<KeyKind, string>
  onKeyChange: (kind: KeyKind, value: string) => void
  prefs: Prefs
  onPrefsChange: (prefs: Prefs) => void
  onClose: () => void
}

function KeyRow({
  label,
  value,
  onChange,
  link,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  link?: { href: string; label: string }
}) {
  const t = useT()
  const [visible, setVisible] = useState(false)
  const saved = value.trim().length > 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-12 font-semibold">{label}</span>
        {saved && <span className="meta">{t.keys.saved}</span>}
      </div>
      <div className="flex items-center gap-1">
        <Field
          type={visible ? 'text' : 'password'}
          aria-label={label}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="flex-1"
        />
        <IconButton
          icon={visible ? EyeSlashIcon : EyeIcon}
          label={visible ? t.keys.hide : t.keys.show}
          onClick={() => setVisible((shown) => !shown)}
        />
        <IconButton icon={TrashIcon} label={t.common.delete} disabled={!saved} onClick={() => onChange('')} />
      </div>
      {link && !saved && (
        <a
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="meta inline-flex items-center gap-1 self-start hover:text-ink"
        >
          {link.label}
          <ArrowSquareOutIcon size={12} aria-hidden />
        </a>
      )}
    </div>
  )
}

/** Clés, enrichissement et tarifs : un seul endroit. */
export default function KeysDialog({ keys, onKeyChange, prefs, onPrefsChange, onClose }: KeysDialogProps) {
  const t = useT()
  const patch = (partial: Partial<Prefs>) => onPrefsChange({ ...prefs, ...partial })

  return (
    <Dialog title={t.keys.title} onClose={onClose} width={520}>
      <p className="px-4 pt-3.5 text-12 text-ink-soft">{t.keys.intro}</p>

      <Section first label="Google">
        <KeyRow
          label="Google AI Studio"
          value={keys.gemini}
          onChange={(value) => onKeyChange('gemini', value)}
          link={{ href: 'https://aistudio.google.com/apikey', label: t.keys.getGoogle }}
        />
      </Section>
      <Section label="OpenAI">
        <KeyRow
          label="OpenAI"
          value={keys.openai}
          onChange={(value) => onKeyChange('openai', value)}
          link={{ href: 'https://platform.openai.com/api-keys', label: t.keys.getOpenai }}
        />
      </Section>

      <Section label={t.keys.enrich}>
        <Segmented<Prefs['enrichKey']>
          label={t.keys.enrichKey}
          mono={false}
          options={[
            { value: 'gemini', label: t.keys.enrichGoogle },
            { value: 'openai', label: t.keys.enrichOpenai },
            { value: 'text', label: t.keys.enrichOther },
          ]}
          value={prefs.enrichKey}
          onChange={(enrichKey) => patch({ enrichKey })}
        />
        {prefs.enrichKey === 'text' && (
          <KeyRow label={t.keys.otherKey} value={keys.text} onChange={(value) => onKeyChange('text', value)} />
        )}
        <label className="flex flex-col gap-1.5">
          <span className="lbl">{t.keys.enrichModel}</span>
          <Field
            autoComplete="off"
            spellCheck={false}
            placeholder={Object.values(ENRICH_DEFAULT_MODEL).join(' · ')}
            value={prefs.enrichModel}
            onChange={(event) => patch({ enrichModel: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="lbl">{t.keys.instructions}</span>
          <textarea
            rows={4}
            value={prefs.enrichPrePrompt}
            onChange={(event) => patch({ enrichPrePrompt: event.target.value })}
            className="resize-y rounded-xs border border-hairline bg-sunken p-2 font-mono text-11 text-ink"
          />
        </label>
      </Section>

      <Section label={t.keys.prices} meta={t.keys.localEstimate}>
        {ADAPTERS.map((id) => (
          <label key={id} className="flex items-center justify-between gap-3 text-12">
            {MODELS[id].name}
            <span className="flex items-center gap-1">
              <input
                type="number"
                step="0.001"
                min="0"
                aria-label={t.keys.priceOf(MODELS[id].name)}
                value={prefs.pricing[id]}
                onChange={(event) =>
                  patch({ pricing: { ...prefs.pricing, [id]: Math.max(0, Number(event.target.value) || 0) } })
                }
                className="h-8 w-24 rounded-xs border border-hairline bg-sunken px-2 text-right font-mono text-11"
              />
              <span className="meta">€</span>
            </span>
          </label>
        ))}
      </Section>
    </Dialog>
  )
}
