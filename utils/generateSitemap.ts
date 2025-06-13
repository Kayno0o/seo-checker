import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'

interface PageType {
  path: string
  depth: number
  error?: boolean
}

export function round(nb: number, precision = 2) {
  return Math.round(nb * (10 ** precision)) / (10 ** precision)
}

async function checkPath(baseUrl: string, page: PageType, pages: Record<string, PageType> = {}, log = false): Promise<PageType[]> {
  if (pages[page.path] || page.path.startsWith('http'))
    return []

  const url = new URL(page.path, baseUrl)

  const startTime = performance.now()
  const data = await fetch(url)
  const text = await data.text()
  const loadingTime = performance.now() - startTime

  if (!data.ok) {
    if (log)
      console.log(chalk.bold.red('[error]'), url.toString(), chalk.bold.red('status'), data.status)
    pages[page.path] = {
      path: url.toString(),
      depth: page.depth,
      error: true,
    }
    return []
  }

  if (log)
    console.log(chalk.bold.blue('[fetch]'), url.toString(), chalk.bold.blue('in'), Math.round(loadingTime), 'ms')

  pages[page.path] = {
    path: url.toString(),
    depth: page.depth,
  }

  const pagesToCheck: PageType[] = []

  const links = text.matchAll(/<a[^>]+href="([^"]+)"/g)
  for (const link of links) {
    const linkUrl = new URL(link[1], baseUrl)
    if (linkUrl.origin === baseUrl && !Object.values(pages).find(page => page.path === linkUrl.toString()) && !pagesToCheck.find(page => page.path === linkUrl.pathname))
      pagesToCheck.push({ path: linkUrl.pathname, depth: page.depth + 1 })
  }

  return pagesToCheck
}

async function checkAllPages(baseUrl: string, options: { max: number, log: boolean }) {
  const pages: Record<string, PageType> = {}
  let pagesToCheck: PageType[] = [{ path: '/', depth: 1 }]

  while (pagesToCheck.length > 0) {
    pagesToCheck.push(...(
      await Promise.all(pagesToCheck.splice(0, Math.max(options.max, 1)).map(page => checkPath(baseUrl, page, pages, options.log)))
    ).flat())
    pagesToCheck = Array.from(new Set(pagesToCheck))
  }

  return pages
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
      default: return char
    }
  })
}

function getPriority(depth: number) {
  return round(0.8 ** (depth - 1), 2).toFixed(2)
}

export async function generateSitemap(baseUrl?: string, options?: { max: number, output?: string, log?: boolean }) {
  baseUrl ??= 'https://localhost:3000'

  if (!baseUrl.startsWith('http'))
    baseUrl = `https://${baseUrl}`

  options ??= { max: 15 }
  options.log ??= false

  if (options.log) {
    console.log(chalk.bold.blue('[options]:'))
    console.log(Object.entries(options).filter(([key, value]) => value !== undefined && key.length !== 1).map(([key, value]) => `  - ${key}: ${value}`).join('\n'))

    console.log()
  }

  const startTime = performance.now()
  const pages = await checkAllPages(baseUrl, options as { max: number, log: boolean })

  if (options.log) {
    console.log()
    console.log(chalk.bold.blue('[fetch]'), Object.keys(pages).length, 'pages', chalk.bold.blue('in'), Math.round(performance.now() - startTime), 'ms')
    console.log(chalk.bold.red('[error]'), Object.values(pages).filter(page => page.error).length, 'pages unavailable')
  }

  if (options.output && !fs.existsSync(path.dirname(options.output)))
    fs.mkdirSync(path.dirname(options.output), { recursive: true })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd"
>${Object.values(pages).filter(page => !page.error).map(page => `
<url>
  <loc>${escapeXml(page.path)}</loc>
  <lastmod>${new Date().toISOString()}</lastmod>
  <priority>${getPriority(page.depth)}</priority>
  <changefreq>daily</changefreq>
</url>`).join('')}
</urlset>
`

  if (options.output)
    fs.writeFileSync(options.output, xml)

  return xml
}
