'use client'

import { useEffect, useRef } from 'react'
import Composer from '@/components/atelier/Composer'
import Strip from '@/components/atelier/Strip'
import TopBar from '@/components/atelier/TopBar'
import FailureInspector from '@/components/atelier/inspector/FailureInspector'
import ImageInspector from '@/components/atelier/inspector/ImageInspector'
import MultiInspector from '@/components/atelier/inspector/MultiInspector'
import PairInspector from '@/components/atelier/inspector/PairInspector'
import SettingsInspector from '@/components/atelier/inspector/SettingsInspector'
import { buildCommands } from '@/components/atelier/commands'
import CommandPalette from '@/components/atelier/overlays/CommandPalette'
import HistoryDialog from '@/components/atelier/overlays/HistoryDialog'
import KeysDialog from '@/components/atelier/overlays/KeysDialog'
import PresetsMenu from '@/components/atelier/overlays/PresetsMenu'
import { ConfirmClearDialog, ShortcutsDialog } from '@/components/atelier/overlays/ShortcutsDialog'
import Stage from '@/components/atelier/stage/Stage'
import { useShortcuts } from '@/components/atelier/use-shortcuts'
import { resolveSelection } from '@/lib/atelier/session-view'
import { useAtelier, type Atelier } from '@/lib/atelier/use-atelier'
import { I18nProvider, useT } from '@/lib/i18n'

export default function Home() {
  const atelier = useAtelier()
  const { prefs } = atelier

  // Le script de layout.tsx a posé thème et langue avant la première peinture.
  // Au départ de l'app, la landing retrouve son thème sombre et sa langue.
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme
    document.documentElement.lang = prefs.lang
    return () => {
      document.documentElement.dataset.theme = 'dark'
      document.documentElement.lang = 'fr'
    }
  }, [prefs.theme, prefs.lang])

  return (
    <I18nProvider lang={prefs.lang}>
      <Workspace atelier={atelier} />
    </I18nProvider>
  )
}

function Workspace({ atelier }: { atelier: Atelier }) {
  const { state, dispatch, prefs } = atelier
  const promptRef = useRef<HTMLTextAreaElement>(null)
  useShortcuts(atelier, promptRef)

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar
        overlay={state.overlay}
        onOverlay={(overlay) => dispatch({ type: 'toggleOverlay', overlay })}
        theme={prefs.theme}
        onTheme={() => atelier.setPrefs({ ...prefs, theme: prefs.theme === 'dark' ? 'light' : 'dark' })}
        lang={prefs.lang}
        onLang={() => atelier.setPrefs({ ...prefs, lang: prefs.lang === 'fr' ? 'en' : 'fr' })}
        sheetOpen={state.sheetOpen}
        onSheet={() => dispatch({ type: 'toggleSheet' })}
        presetsMenu={
          <PresetsMenu
            recipes={atelier.recipes}
            activeId={atelier.activeRecipeId}
            onApply={atelier.applyRecipe}
            onSave={atelier.saveCurrentRecipe}
            onDelete={atelier.deleteRecipe}
            onImport={atelier.setRecipes}
            onClose={() => dispatch({ type: 'closeOverlay' })}
          />
        }
      />

      <div className="relative grid min-h-0 flex-1 grid-cols-[88px_minmax(0,1fr)_288px] gap-4 p-4 max-[1100px]:grid-cols-[88px_minmax(0,1fr)] max-sm:grid-cols-1 max-sm:grid-rows-[auto_minmax(0,1fr)] max-sm:gap-2 max-sm:p-2">
        <Strip
          items={atelier.items}
          failures={atelier.failures}
          pending={atelier.pending}
          selectedIds={state.selectedIds}
          onSelect={(id, additive) => dispatch({ type: 'select', id, additive })}
          onNewSession={() => dispatch({ type: 'openOverlay', overlay: 'clear' })}
        />

        <main className="flex min-h-0 min-w-0 flex-col gap-4 max-sm:gap-2">
          <Stage atelier={atelier} />
          <Composer atelier={atelier} promptRef={promptRef} />
        </main>

        <Inspector atelier={atelier} />
      </div>

      <Overlays atelier={atelier} />
    </div>
  )
}

function Inspector({ atelier }: { atelier: Atelier }) {
  const t = useT()
  const { state, dispatch } = atelier
  const selected = resolveSelection(state.selectedIds, atelier.items, atelier.failures)

  let body: React.ReactNode
  if (selected.length === 0) {
    body = <SettingsInspector atelier={atelier} onOpenKeys={() => dispatch({ type: 'openOverlay', overlay: 'keys' })} />
  } else if (selected.length === 1) {
    const [entry] = selected
    body =
      entry.kind === 'item' ? (
        <ImageInspector item={entry.item} atelier={atelier} />
      ) : (
        <FailureInspector failure={entry.failure} atelier={atelier} />
      )
  } else {
    const images = selected.flatMap((entry) => (entry.kind === 'item' ? [entry.item] : []))
    body =
      images.length === 2 && selected.length === 2 ? (
        <PairInspector pair={[images[0], images[1]]} atelier={atelier} />
      ) : (
        <MultiInspector items={images} ids={selected.map((entry) => entry.id)} atelier={atelier} />
      )
  }

  return (
    <aside
      aria-label={t.stage.inspector}
      className={`flex min-h-0 flex-col overflow-hidden rounded-xs border border-hairline bg-solid ${
        state.sheetOpen
          ? 'max-[1100px]:absolute max-[1100px]:inset-y-4 max-[1100px]:right-4 max-[1100px]:z-30 max-[1100px]:w-[288px] max-sm:inset-2 max-sm:w-auto'
          : 'max-[1100px]:hidden'
      }`}
    >
      {body}
    </aside>
  )
}

function Overlays({ atelier }: { atelier: Atelier }) {
  const t = useT()
  const { state, dispatch, prefs } = atelier
  const close = () => dispatch({ type: 'closeOverlay' })

  switch (state.overlay) {
    case 'palette':
      return <CommandPalette commands={buildCommands(atelier, t)} onClose={close} />
    case 'history':
      return (
        <HistoryDialog
          items={atelier.items}
          onClose={close}
          onSelect={(id) => {
            dispatch({ type: 'select', id })
            close()
          }}
        />
      )
    case 'keys':
      return (
        <KeysDialog
          keys={atelier.keys}
          onKeyChange={atelier.setKey}
          prefs={prefs}
          onPrefsChange={atelier.setPrefs}
          onClose={close}
        />
      )
    case 'shortcuts':
      return <ShortcutsDialog onClose={close} />
    case 'clear':
      return (
        <ConfirmClearDialog
          count={atelier.items.length}
          onClose={close}
          onConfirm={() => {
            atelier.clearSession()
            close()
          }}
        />
      )
    default:
      return null
  }
}
