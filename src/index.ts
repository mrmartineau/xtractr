import Defuddle from 'defuddle'
import { parseHTML } from 'linkedom'
import { followShortUrl } from './follow-short-url'
import { linkType } from './link-type'
import './polyfill'
import { createMarkdownContent } from './defuddle/markdown'
import type { LinkType } from './type-checker'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_JSON_LD_DEPTH = 10

type DefuddleCompatDocument = Document & {
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

const schemaTypeMap: Record<string, LinkType> = {
  article: 'article',
  audioobject: 'audio',
  blogposting: 'article',
  book: 'book',
  clip: 'video',
  event: 'event',
  imageobject: 'image',
  movie: 'video',
  musicalbum: 'audio',
  musicplaylist: 'audio',
  musicrecording: 'audio',
  newsarticle: 'article',
  photograph: 'image',
  podcastepisode: 'audio',
  podcastseries: 'audio',
  product: 'product',
  recipe: 'recipe',
  report: 'article',
  techarticle: 'article',
  tvepisode: 'video',
  videoobject: 'video',
}

const ogTypeMap: Array<{ startsWith: string; type: LinkType }> = [
  { startsWith: 'article', type: 'article' },
  { startsWith: 'video', type: 'video' },
  { startsWith: 'music', type: 'audio' },
  { startsWith: 'product', type: 'product' },
  { startsWith: 'book', type: 'book' },
  { startsWith: 'event', type: 'event' },
]

function detectPageTypeFromJsonLd(
  value: unknown,
  depth = 0,
): LinkType | undefined {
  if (!value || typeof value !== 'object' || depth > MAX_JSON_LD_DEPTH) {
    return undefined
  }

  const objectValue = value as Record<string, unknown>

  const atType = objectValue['@type']
  if (typeof atType === 'string') {
    const mappedType = schemaTypeMap[atType.toLowerCase()]
    if (mappedType) {
      return mappedType
    }
  }
  if (Array.isArray(atType)) {
    for (const item of atType) {
      if (typeof item !== 'string') {
        continue
      }
      const mappedType = schemaTypeMap[item.toLowerCase()]
      if (mappedType) {
        return mappedType
      }
    }
  }

  for (const nestedValue of Object.values(objectValue)) {
    if (Array.isArray(nestedValue)) {
      for (const item of nestedValue) {
        const nestedType = detectPageTypeFromJsonLd(item, depth + 1)
        if (nestedType) {
          return nestedType
        }
      }
      continue
    }

    const nestedType = detectPageTypeFromJsonLd(nestedValue, depth + 1)
    if (nestedType) {
      return nestedType
    }
  }

  return undefined
}

function detectPageTypeFromDocument(
  document: Document,
  fallbackUrl: string,
  isReaderable: boolean,
): LinkType {
  const ogTypeContent = document
    .querySelector('meta[property="og:type"]')
    ?.getAttribute('content')
    ?.toLowerCase()
    ?.trim()

  if (ogTypeContent) {
    for (const ogTypeRule of ogTypeMap) {
      if (ogTypeContent.startsWith(ogTypeRule.startsWith)) {
        return ogTypeRule.type
      }
    }
  }

  const jsonLdScripts = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  )
  for (const script of jsonLdScripts) {
    const text = script.textContent?.trim()
    if (!text) {
      continue
    }

    try {
      const parsed = JSON.parse(text) as unknown
      const detectedType = detectPageTypeFromJsonLd(parsed)
      if (detectedType) {
        return detectedType
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }

  return linkType(fallbackUrl, isReaderable)
}

async function readResponseWithLimit(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    return response.text()
  }

  const chunks: Uint8Array[] = []
  let totalSize = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalSize += value.byteLength
    if (totalSize > MAX_SIZE) {
      reader.cancel()
      throw new Error(
        `Page too large (>${Math.round(MAX_SIZE / 1024 / 1024)}MB, max 5MB)`,
      )
    }
    chunks.push(value)
  }

  const combined = new Uint8Array(totalSize)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(combined)
}

export async function xtract(targetUrl: string): Promise<XtractResponse> {
  const { unshortened_url, urls } = await followShortUrl([targetUrl])
  const resolvedShortUrl = unshortened_url || targetUrl

  const response = await fetch(resolvedShortUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; OtterBot/1.0)',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch: ${response.status} ${response.statusText}`,
    )
  }

  const contentType = response.headers.get('content-type') || ''
  if (
    !contentType.includes('text/html') &&
    !contentType.includes('application/xhtml+xml')
  ) {
    throw new Error(`Not an HTML page (content-type: ${contentType})`)
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
    throw new Error(
      `Page too large (${Math.round(parseInt(contentLength, 10) / 1024 / 1024)}MB, max 5MB)`,
    )
  }

  const html = await readResponseWithLimit(response)

  const parsedWindow = parseHTML(html)
  const document = parsedWindow.document as unknown as Document

  const doc = document as DefuddleCompatDocument
  if (!doc.styleSheets) {
    Object.defineProperty(doc, 'styleSheets', {
      configurable: true,
      value: [],
      writable: true,
    })
  }
  if (doc.defaultView && !doc.defaultView.getComputedStyle) {
    doc.defaultView.getComputedStyle = () =>
      ({ display: '' }) as CSSStyleDeclaration
  }

  const finalUrl = response.url || resolvedShortUrl
  const defuddle = new Defuddle(document, { url: finalUrl, useAsync: true })
  const result = await defuddle.parseAsync()

  const markdown = createMarkdownContent(result.content || '', finalUrl)

  const computedPageType = detectPageTypeFromDocument(
    document,
    finalUrl,
    Boolean(result?.author),
  )

  return {
    author: result.author || '',
    content: markdown,
    description: result.description || '',
    domain: result.domain || new URL(finalUrl).hostname,
    favicon: result.favicon,
    image: result.image,
    pageType: computedPageType,
    published: result.published || '',
    redirectUrls: urls,
    resolvedUrl: finalUrl,
    site: result.site,
    source: targetUrl,
    title: result.title || '',
    url: finalUrl,
    urlType: computedPageType,
    wordCount: result.wordCount || 0,
  }
}

export type { LinkType } from './type-checker'
