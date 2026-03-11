import { type LinkType, typeChecker } from './type-checker'

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
