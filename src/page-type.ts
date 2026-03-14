import fileExtension from 'file-extension'
import type { LinkType } from './link-types'
import { types } from './link-types'

const MAX_JSON_LD_DEPTH = 10

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

export const typeChecker = (path: string): LinkType | undefined => {
  try {
    const url = new URL(path)
    const hostname = url.hostname.replace(/^www\./, '')
    // Check exact match first, then walk up subdomains (e.g. m.youtube.com → youtube.com)
    const parts = hostname.split('.')
    for (let i = 0; i < parts.length - 1; i++) {
      const candidate = parts.slice(i).join('.')
      if (types[candidate]) {
        return types[candidate]
      }
    }
  } catch {
    // Non-URL strings are still checked as file paths.
  }

  const extension = fileExtension(path)
  if (extension) {
    return types[extension]
  }

  return undefined
}

export const linkType = (link: string, isReaderable?: boolean): LinkType => {
  let type: LinkType = 'link'
  if (isReaderable) {
    type = 'article'
  }

  const knownType = typeChecker(link)
  if (knownType) {
    type = knownType
  }

  return type
}

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

export function detectPageTypeFromDocument(
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
