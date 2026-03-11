import fileExtension from 'file-extension'
import { types } from './types'

export type LinkType =
  | 'link'
  | 'video'
  | 'audio'
  | 'recipe'
  | 'image'
  | 'document'
  | 'article'
  | 'game'
  | 'book'
  | 'event'
  | 'product'
  | 'note'
  | 'file'

export type TypeDictionary = Record<string, LinkType>

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
