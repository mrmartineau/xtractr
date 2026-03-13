#!/usr/bin/env node

import { inspect } from 'node:util'

import { xtract } from '../dist/index.mjs'

const targetUrl = process.argv[2]

if (!targetUrl) {
  console.error('Usage: bun run test:local -- <url>')
  process.exit(1)
}

try {
  const result = await xtract(targetUrl)
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : inspect(error),
  )
  process.exit(1)
}
