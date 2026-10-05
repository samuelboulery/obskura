import type { Metadata } from 'next'
import Landing from '@/components/landing/Landing'
import { landingFr as t } from '@/lib/i18n/landing-fr'
import '@/components/landing/landing.css'

export const metadata: Metadata = {
  title: { absolute: t.meta.title },
  description: t.meta.description,
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Obskura',
    url: '/',
    title: t.meta.title,
    description: t.meta.description,
  },
  twitter: { card: 'summary_large_image', title: t.meta.title, description: t.meta.description },
}

export default function Home() {
  return <Landing />
}
