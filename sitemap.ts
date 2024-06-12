import fs from 'node:fs'
import path from 'node:path'
import { Command } from 'commander'
import { JSDOM } from 'jsdom'
import chalk from 'chalk'

interface PageType {
  path: string
  depth: number
  error?: boolean
}

function notNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

async function checkAvailable(baseUrl: URL | string) {
  const url = new URL(baseUrl)
  const data = await fetch(url)
  if (!data.ok)
    return false
  return true
}

async function checkPath(baseUrl: string, page: PageType, pages: Record<string, PageType> = {}): Promise<PageType[]> {
  if (pages[page.path] || page.path.startsWith('http'))
    return []

  const url = new URL(page.path, baseUrl)

  const startTime = performance.now()
  const data = await fetch(url)
  const text = await data.text()
  const loadingTime = performance.now() - startTime

  if (!data.ok) {
    console.log(chalk.bold.red('[error]'), url.toString(), chalk.bold.red('status'), data.status)
    pages[page.path] = {
      path: url.toString(),
      depth: page.depth,
      error: true,
    }
    return []
  }

  console.log(chalk.bold.blue('[fetch]'), url.toString(), chalk.bold.blue('in'), Math.round(loadingTime), 'ms')

  const dom = new JSDOM(text)
  const document = dom.window.document

  pages[page.path] = {
    path: url.toString(),
    depth: page.depth,
  }

  const pagesToCheck: PageType[] = []

  const links = Array.from(document.querySelectorAll('a')).map(element => element.getAttribute('href')).filter(notNull)
  for (const link of links) {
    const linkUrl = new URL(link, baseUrl)
    if (linkUrl.origin === baseUrl && !Object.values(pages).find(page => page.path === linkUrl.toString()) && !pagesToCheck.find(page => page.path === linkUrl.pathname))
      pagesToCheck.push({ path: linkUrl.pathname, depth: page.depth + 1 })
  }

  return pagesToCheck
}

async function checkAllPages(baseUrl: string, options: { max: number }) {
  const pages: Record<string, PageType> = {}
  let pagesToCheck: PageType[] = [{ path: '/', depth: 1 }]

  while (pagesToCheck.length > 0) {
    pagesToCheck.push(...(
      await Promise.all(pagesToCheck.splice(0, Math.max(options.max, 1)).map(page => checkPath(baseUrl, page, pages)))
    ).flat())
    pagesToCheck = Array.from(new Set(pagesToCheck))
  }

  return pages
}

const cli = new Command()

cli
  .command('generate')
  .argument('<url>', 'URL of the website')
  .option<number>('-m, --max <number>', 'Max concurrent requests', (max: string) => Number.parseInt(max), 15)
  .option('-o, --output <string>', 'Path of output sitemap.xml file', 'sitemap.xml')
  .action(async (url: string, options: { max: number, output: string }) => {
    let baseUrl = url ?? 'https://localhost:3000'

    if (!baseUrl.startsWith('http'))
      baseUrl = `https://${baseUrl}`

    console.log(chalk.bold.blue('[options]:'))
    console.log(Object.entries(options).filter(([key, value]) => value !== undefined && key.length !== 1).map(([key, value]) => `  - ${key}: ${value}`).join('\n'))

    console.log()

    if (!(await checkAvailable(baseUrl))) {
      console.log(chalk.bold.red('The website is not available'))
      return
    }

    const startTime = performance.now()
    const pages = await checkAllPages(baseUrl, options)

    if (!await checkAvailable(new URL('robots.txt', baseUrl))) {
      console.log()
      console.log(chalk.bold.red('robots.txt not found'))
    }

    if (!await checkAvailable(new URL('sitemap.xml', baseUrl))) {
      console.log()
      console.log(chalk.bold.red('sitemap.xml not found'))
    }

    console.log()
    console.log(chalk.bold.blue('[fetch]'), Object.keys(pages).length, 'pages', chalk.bold.blue('in'), Math.round(performance.now() - startTime), 'ms')
    console.log(chalk.bold.red('[error]'), Object.values(pages).filter(page => page.error).length, 'pages unavailable')

    if (!fs.existsSync(path.dirname(options.output)))
      fs.mkdirSync(path.dirname(options.output), { recursive: true })

    fs.writeFileSync(options.output, `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
  http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd"
>${Object.values(pages).filter(page => !page.error).map(page => `
  <url>
    <loc>${page.path}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>${1 / page.depth}</priority>
  </url>`).join('')}
</urlset>
`)
  })

// cli.help()

cli.parse()
