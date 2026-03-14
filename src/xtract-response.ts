import type { LinkType } from './link-types'

export type DefuddleCompatDocument = Document & {
  styleSheets?: unknown
  defaultView?: (Window & typeof globalThis) | null
}

export interface XtractResponse {
  title: string
  author: string
  published: string
  description: string
  domain: string
  content: string
  wordCount: number
  source: string
  url: string
  resolvedUrl: string
  redirectUrls: string[]
  urlType: LinkType
  pageType: LinkType
  favicon?: string
  image?: string
  site?: string
}
