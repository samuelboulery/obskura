import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Space_Grotesk, Unbounded } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  weight: ['400', '500'],
  subsets: ['latin'],
})

/** Titre d'accueil seulement. */
const unbounded = Unbounded({
  variable: '--font-unbounded',
  weight: ['800'],
  subsets: ['latin'],
})

const title = 'Obskura'
const description =
  "Un prompt entre, une image sort. Génération d'images multi-modèles (Nano Banana 2, GPT Image), avec votre propre clé. Sans compte ni base de données : tout reste dans le navigateur."

export const metadata: Metadata = {
  metadataBase: new URL('https://obskura.netlify.app'),
  title: { default: title, template: '%s — Obskura' },
  description,
  applicationName: 'Obskura',
  keywords: ["génération d'images", 'IA', 'nano-banana-2', 'gpt-image-2', 'prompt'],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Obskura',
    url: '/',
    title,
    description,
  },
  twitter: { card: 'summary_large_image', title, description },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: '#121110',
}

/**
 * Pose le thème et la langue avant la première peinture : sans lui, un
 * utilisateur en clair verrait un éclair sombre à chaque chargement.
 */
const PREFS_SCRIPT = `try{var p=JSON.parse(localStorage.getItem('imgc.prefs')||'{}');var d=document.documentElement;if(p.theme==='light')d.dataset.theme='light';if(p.lang==='en')d.lang='en'}catch(e){}`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fr"
      data-theme="dark"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${unbounded.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body className="h-full">
        {children}
        <script
          async
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "ef321ec6f5fa4044a696cecef364fedf"}'
        />
      </body>
    </html>
  )
}
