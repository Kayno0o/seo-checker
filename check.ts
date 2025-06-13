import fs from 'node:fs'
import { readdir } from 'node:fs/promises'
import { colors, notNullish } from '@kaynooo/utils'
import { Command } from 'commander'
import { JSDOM } from 'jsdom'

export interface PageType {
  path: string
  title: string
  headings: Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', string[]>
  errors: string[]
  warnings: string[]
  loadingTime?: number
}

const methods: Record<string, (options: CheckOptions, document: Document, page: PageType) => Promise<void>> = {}
const files = await readdir(new URL('./check', import.meta.url))
for (const file of files) {
  if (file.endsWith('.ts') && file !== 'index.ts') {
    const module = await import(`./check/${file}`)
    if (module.default) {
      methods[file.slice(0, -3)] = module.default
    }
  }
}

async function testUrl(path: string) {
  try {
    const url = new URL(path)
    try {
      await fetch(url)
    }
    catch (e) {
      console.error(e)
      console.error('URL not reachable', url.toString())
      process.exit(1)
    }
  }
  catch (e: any) {
    console.error(e)
    process.exit(1)
  }
}

export interface CheckOptions { seo?: boolean, accessibility?: boolean, verbose?: boolean, socialMedia?: boolean }

async function checkPath(baseUrl: string, path: string, pages: Record<string, PageType>, options: CheckOptions = { seo: true, accessibility: true, socialMedia: true }): Promise<string[]> {
  if (pages[path] || path.startsWith('http') || path.endsWith('sitemap.xml') || path.endsWith('robots.txt'))
    return []

  console.log(colors.cyan('[checking]'), path)

  const errors: string[] = []
  const warnings: string[] = []
  let stop = false

  const url = new URL(path, baseUrl)

  const startTime = performance.now()
  const data = await fetch(url)
  const text = await data.text()

  // ignore responses that are not html
  if (!data.headers.get('content-type')?.includes('text/html')) {
    return []
  }

  const loadingTime = performance.now() - startTime

  if (!data.ok) {
    errors.push(`HTTP error: ${data.status}`)
    stop = true
  }

  if (stop) {
    pages[path] = {
      path: url.toString(),
      title: '',
      headings: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
      errors,
      warnings,
      loadingTime,
    }
    return []
  }

  const textWithoutStyles = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  const dom = new JSDOM(textWithoutStyles)
  const document = dom.window.document

  const page: PageType = {
    path: url.toString(),
    title: document.title.trim(),
    headings: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
    errors,
    warnings,
    loadingTime,
  }

  for (const method of Object.values(methods))
    await method(options, document, page)

  pages[path] = page

  const pagesToCheck: string[] = []
  const links = Array.from(document.querySelectorAll('a')).map(element => element.getAttribute('href')).filter(notNullish)
  for (const link of links) {
    const url = new URL(link, baseUrl)
    if (url.origin === baseUrl && !pagesToCheck.includes(url.pathname) && !Object.values(pages).find(page => page.path === url.toString()))
      pagesToCheck.push(url.pathname)
  }
  return pagesToCheck
}

async function checkAvailable(baseUrl: URL) {
  const url = new URL(baseUrl)
  const data = await fetch(url)
  if (!data.ok)
    return false
  return true
}

async function checkAllPages(baseUrl: string, options: { max: number, seo: boolean, accessibility: boolean, verbose: boolean }) {
  const pages: Record<string, PageType> = {}
  let pagesToCheck: string[] = ['/']

  while (pagesToCheck.length > 0) {
    pagesToCheck.push(...(
      await Promise.all(pagesToCheck.splice(0, Math.max(options.max, 1)).map(url => checkPath(baseUrl, url, pages, options)))
    ).flat())
    pagesToCheck = Array.from(new Set(pagesToCheck))
  }

  return pages
}

const cli = new Command()

cli
  .argument('<url>', 'Check a website')
  .option<number>('-m, --max <max>', 'Max concurrent requests', (max: string) => Number.parseInt(max), 15)
  .option('-s, --seo', 'Check SEO errors', true)
  .option('-a, --accessibility', 'Check accessibility errors', true)
  .option('-o, --social-media', 'Check social media tags', false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (url: string, options: { max: number, seo: boolean, accessibility: boolean, verbose: boolean, socialMedia: boolean }) => {
    let baseUrl = url ?? 'https://localhost:3000'

    if (!baseUrl.startsWith('http'))
      baseUrl = `https://${baseUrl}`

    console.log(colors.bold.blue('Parsing'), baseUrl)
    console.log(colors.bold.blue('With options'))
    console.log(Object.entries(options)
      .filter(([key, value]) => value !== undefined && key.length !== 1)
      .map(([key, value]) => `  - ${key}: ${value}`).join('\n'))

    console.log()

    await testUrl(baseUrl)

    const startTime = performance.now()
    const pages = await checkAllPages(baseUrl, options)
    const uniqueErrors = Array.from(new Set(Object.values(pages).reduce((total, page) => total.concat(page.errors), [] as string[])))
    const uniqueWarnings = Array.from(new Set(Object.values(pages).reduce((total, page) => total.concat(page.warnings), [] as string[])))

    if (!await checkAvailable(new URL('robots.txt', baseUrl))) {
      console.log()
      console.log(colors.bold.red('robots.txt not found'))
    }

    if (!await checkAvailable(new URL('sitemap.xml', baseUrl))) {
      console.log()
      console.log(colors.bold.red('sitemap.xml not found'))
    }

    console.log()
    console.log(colors.bold.blue('Global errors'))
    for (const issue of uniqueErrors)
      console.log('  -', issue)

    console.log()
    console.log(colors.bold.blue('Fetched'), Object.keys(pages).length, 'pages', colors.bold.blue('in'), Math.round(performance.now() - startTime), 'ms')

    console.log()
    console.log(colors.bold.red('Total errors'), Object.values(pages).reduce((total, page) => total + page.errors.length, 0))
    console.log(colors.bold.yellow('Total warnings'), Object.values(pages).reduce((total, page) => total + page.warnings.length, 0))

    fs.writeFileSync('pages.json', JSON.stringify({ ...pages, global: { errors: uniqueErrors, warnings: uniqueWarnings } }, null, 2))
  })

cli.parse()
