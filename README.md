# xtractr

Extract clean, structured content from web pages with automatic short-link expansion and lightweight page-type detection.

`xtractr` fetches a URL, follows redirects, parses the HTML, converts the main content to Markdown, and returns normalized metadata you can use in apps, pipelines, and AI workflows.

It is primarily intended for use inside a Cloudflare Worker runtime.

## Features

- Expands shortened URLs and returns the full redirect chain
- Extracts readable page content with [defuddle](https://github.com/kepano/defuddle)
- Converts extracted HTML content to Markdown
- Detects content/page type using:
  - Open Graph (`og:type`)
  - JSON-LD (`@type`) with nested traversal
  - domain and file-extension fallback rules
- Enforces a max page size (5MB) for safer fetching
- Works in ESM/CJS builds with TypeScript declarations

## Installation

```bash
npm install @mrmartineau/xtractr
bun add @mrmartineau/xtractr
pnpm add @mrmartineau/xtractr
yarn add @mrmartineau/xtractr
```

## Usage

```ts
import { xtract } from '@mrmartineau/xtractr'

const result = await xtract('https://bit.ly/example')

console.log(result.title)
console.log(result.content) // markdown
console.log(result.redirectUrls)
console.log(result.pageType)
```

### Cloudflare Worker example

```ts
import { xtract } from '@mrmartineau/xtractr'

export default {
  async fetch(request: Request): Promise<Response> {
    const { searchParams } = new URL(request.url)
    const target = searchParams.get('url')

    if (!target) {
      return new Response('Missing "url" query parameter', { status: 400 })
    }

    const data = await xtract(target)
    return Response.json(data)
  },
}
```

## API

### `xtract(targetUrl: string): Promise<XtractResponse>`

Fetches, parses, and extracts structured content from a URL.

#### `XtractResponse`

- `title: string` - extracted page title
- `author: string` - extracted author (if found)
- `published: string` - published date string (if found)
- `description: string` - summary/description (if found)
- `domain: string` - source domain
- `content: string` - extracted main content as Markdown
- `wordCount: number` - estimated word count from extracted content
- `source: string` - original input URL
- `url: string` - final fetched URL
- `resolvedUrl: string` - resolved URL after unshortening/fetch redirects
- `redirectUrls: string[]` - full redirect chain
- `urlType: LinkType` - detected type for the URL
- `pageType: LinkType` - detected type for the extracted page
- `favicon?: string` - favicon URL if available
- `image?: string` - representative image URL if available
- `site?: string` - site/publication name if available

### `LinkType`

```ts
type LinkType =
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
```

## Notes and limits

- Non-HTML responses are rejected.
- Responses larger than 5MB are rejected.
- Redirect chasing is capped (currently 20 hops).
- Intended runtime: Cloudflare Workers.
- Also works in other runtimes that provide `fetch` (Node 18+ recommended).

## Development

```bash
# Build (CJS + ESM + DTS)
npm run build

# Watch mode
npm run dev

# Lint/format
npm run check
```

## License

MIT
