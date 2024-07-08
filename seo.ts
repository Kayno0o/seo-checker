import fs from 'node:fs'
import { JSDOM } from 'jsdom'
import chalk from 'chalk'
import { Command } from 'commander'

interface PageType {
  path: string
  title: string
  headings: Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', string[]>
  errors: string[]
  warnings: string[]
  loadingTime?: number
}

async function testUrl(path: string) {
  try {
    const url = new URL(path)
    await fetch(url).catch(() => {
      console.error('URL not reachable', url.toString())
      process.exit(1)
    })
  }
  catch (e: any) {
    console.error(e)
    process.exit(1)
  }
}

// also check parent elements for aria-hidden
function notAriaHidden(element: Element) {
  if (element.getAttribute('aria-hidden') === 'true' || element.getAttribute('aria-hidden') === '')
    return false

  if (element.parentElement)
    return notAriaHidden(element.parentElement)

  return true
}

// check element to have textContent or content for aria-label, if none, check children
function hasAccessibilityContent(element: Element, value = true): boolean {
  if (element.getAttribute('aria-label') || element.textContent?.trim())
    return value

  for (const child of element.children) {
    if (hasAccessibilityContent(child, value))
      return value
  }

  return false
}

function getTag(element: Element) {
  return element.outerHTML.slice(0, element.outerHTML.indexOf('>') + 1)
}

function notNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

function isHTMLElement(element: Element): element is HTMLElement {
  return 'style' in element
}

async function checkPath(baseUrl: string, path: string, pages: Record<string, PageType>, options?: { seo?: boolean, accessibility?: boolean, verbose?: boolean, socialMedia?: boolean }): Promise<string[]> {
  if (pages[path] || path.startsWith('http') || path.endsWith('sitemap.xml') || path.endsWith('robots.txt'))
    return []

  console.log(chalk.cyan('[checking]'), path)

  const { seo = true, accessibility = true, socialMedia = true } = options ?? {}

  const errors: string[] = []
  const warnings: string[] = []
  let stop = false

  const url = new URL(path, baseUrl)

  const startTime = performance.now()
  const data = await fetch(url)
  const text = await data.text()
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

  const dom = new JSDOM(text)
  const document = dom.window.document

  const headings: Record<string, string[]> = {}
  for (let i = 1; i <= 6; i++) {
    const selector = `h${i}`
    const elements = document.querySelectorAll(selector)
    headings[selector] = Array.from(elements).map(element => element.textContent?.trim()).filter(notNull)
  }

  if (seo) {
    if (document.querySelector('h1') === null)
      errors.push('SEO: Missing h1')
    else if (Object.values(headings).every(heading => heading.length === 0))
      errors.push('SEO: No headings')

    if (headings.h1.length > 1)
      errors.push('SEO: Multiple h1')

    for (let i = 2; i <= 6; i++) {
      const selector = `h${i}`
      if (headings[selector].length > 0 && headings[`h${i - 1}`].length === 0)
        errors.push(`SEO: Heading ${i} without heading ${i - 1}`)
    }

    if (!document.title.trim())
      errors.push('SEO: Missing title')
    else if (overflowTitle(document.title))
      warnings.push('SEO: Title too long')

    if (!document.querySelector('meta[name="description"]'))
      errors.push(`SEO: Missing meta description tag`)

    if (headings.h1) {
      for (const heading of headings.h1) {
        if (heading.split(' ').length > 12)
          warnings.push(`SEO: H1 too long: ${heading}`)
      }
    }

    const notHrefLink = Array.from(document.querySelectorAll('a:not([href])'))
    for (const element of notHrefLink)
      errors.push(`SEO: Link without href: ${getTag(element)}`)

    const images = Array.from(document.querySelectorAll('img[src]')).map(element => element.getAttribute('src')) as string[]
    for (const image of images) {
      try {
        const imgUrl = image.startsWith('http') ? new URL(image) : new URL(image, baseUrl)
        const data = await fetch(imgUrl)
        if (!data.headers.get('content-type')?.startsWith('image'))
          errors.push(`SEO: Not an image: ${imgUrl.toString()}`)
      }
      catch (e) {
        errors.push(`SEO: Image not reachable: ${image}`)
      }
    }
  }

  if (socialMedia) {
    if (!document.querySelector('meta[property="og:title"]'))
      errors.push(`SEO: Missing og:title tag`)

    if (!document.querySelector('meta[property="og:description"]'))
      errors.push(`SEO: Missing og:description tag`)

    if (!document.querySelector('meta[property="og:image"]'))
      errors.push(`SEO: Missing og:image tag`)

    if (!document.querySelector('meta[property="og:url"]'))
      errors.push(`SEO: Missing og:url tag`)

    if (!document.querySelector('meta[property="og:type"]'))
      errors.push(`SEO: Missing og:type tag`)

    if (!document.querySelector('meta[name="twitter:title"]'))
      errors.push(`SEO: Missing twitter:title tag`)

    if (!document.querySelector('meta[name="twitter:description"]'))
      errors.push(`SEO: Missing twitter:description tag`)

    if (!document.querySelector('meta[name="twitter:image"]'))
      errors.push(`SEO: Missing twitter:image tag`)
  }

  if (accessibility) {
    const notLabelledLink = Array.from(document.querySelectorAll('a:not([aria-label]), [role=button]:not([aria-label]), button:not([aria-label])')).filter(isHTMLElement).filter(notAriaHidden).filter(e => hasAccessibilityContent(e, false))
    for (const element of notLabelledLink)
      errors.push(`Accessibility: Not labelled link/button: ${getTag(element)}`)

    const notAltImage = Array.from(document.querySelectorAll('img:not([alt])')).filter(notAriaHidden)
    for (const element of notAltImage)
      errors.push(`Accessibility: Image without alt: ${getTag(element)}`)

    const notRoleImgSvg = Array.from(document.querySelectorAll('svg:not([role=img])')).filter(notAriaHidden)
    for (const element of notRoleImgSvg)
      warnings.push(`Accessibility: SVG without role=img: ${getTag(element)}`)

    const notAriaLabelSvg = Array.from(document.querySelectorAll('svg:not([aria-label])')).filter(notAriaHidden)
    for (const element of notAriaLabelSvg)
      errors.push(`Accessibility: SVG without aria-label: ${getTag(element)}`)
  }

  pages[path] = {
    path: url.toString(),
    title: document.title.trim(),
    headings,
    errors,
    warnings,
    loadingTime,
  }

  const pagesToCheck: string[] = []
  const links = Array.from(document.querySelectorAll('a')).map(element => element.getAttribute('href')).filter(notNull)
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

/*
<script setup lang="ts">
const letters = ref<HTMLSpanElement[]>([])

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789- '.split('')

onMounted(() => {
  // log all the letters html width precisely
  console.log(JSON.stringify(letters.value.reduce((acc, letter) => {
    acc[letter.textContent] = letter.getBoundingClientRect().width
    return acc
  }, {} as Record<string, number>)))
})
</script>

<template>
  <div>
    <span
      v-for="(letter, i) in alphabet"
      ref="letters"
      :key="i"
      class="text-xl font-normal text-red"
    >
      <span v-if="letter === ' '">&nbsp;</span>
      <span v-else>{{ letter }}</span>
    </span>
  </div>
</template>
*/

const sizes: Record<string, number> = { '0': 11.484375, '1': 11.484375, '2': 11.484375, '3': 11.484375, '4': 11.484375, '5': 11.484375, '6': 11.484375, '7': 11.484375, '8': 11.484375, '9': 11.484375, 'A': 13.46875, 'B': 12.765625, 'C': 13.09375, 'D': 13, 'E': 11.25, 'F': 10.96875, 'G': 13.625, 'H': 14.140625, 'I': 5.84375, 'J': 11.171875, 'K': 12.703125, 'L': 10.84375, 'M': 17.53125, 'N': 14.125, 'O': 13.8125, 'P': 12.90625, 'Q': 13.8125, 'R': 12.765625, 'S': 12.296875, 'T': 12.375, 'U': 13.171875, 'V': 13.078125, 'W': 17.5, 'X': 12.71875, 'Y': 12.375, 'Z': 12.125, 'a': 10.734375, 'b': 11.265625, 'c': 10.4375, 'd': 11.28125, 'e': 10.8125, 'f': 6.9375, 'g': 11.421875, 'h': 11.203125, 'i': 5.3125, 'j': 5.203125, 'k': 10.6875, 'l': 5.3125, 'm': 17.328125, 'n': 11.203125, 'o': 11.3125, 'p': 11.265625, 'q': 11.3125, 'r': 7.296875, 's': 10.296875, 't': 6.765625, 'u': 11.203125, 'v': 10.109375, 'w': 14.703125, 'x': 10.1875, 'y': 10.046875, 'z': 10.1875, '-': 7.765625, ' ': 4.984375 }
const averageSize = Object.values(sizes).reduce((total, size) => total + size, 0) / Object.keys(sizes).length
function overflowTitle(title: string) {
  return title.split('').reduce((total, char: any) => total + (sizes[char] ?? averageSize), 0) > 550
}

const cli = new Command()

cli
  .command('check')
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

    console.log(chalk.bold.blue('Parsing'), baseUrl)
    console.log(chalk.bold.blue('With options'))
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
      console.log(chalk.bold.red('robots.txt not found'))
    }

    if (!await checkAvailable(new URL('sitemap.xml', baseUrl))) {
      console.log()
      console.log(chalk.bold.red('sitemap.xml not found'))
    }

    console.log()
    console.log(chalk.bold.blue('Global errors'))
    for (const issue of uniqueErrors)
      console.log('  -', issue)

    console.log()
    console.log(chalk.bold.blue('Fetched'), Object.keys(pages).length, 'pages', chalk.bold.blue('in'), Math.round(performance.now() - startTime), 'ms')

    console.log()
    console.log(chalk.bold.red('Total errors'), Object.values(pages).reduce((total, page) => total + page.errors.length, 0))
    console.log(chalk.bold.yellow('Total warnings'), Object.values(pages).reduce((total, page) => total + page.warnings.length, 0))

    fs.writeFileSync('pages.json', JSON.stringify({ ...pages, global: { errors: uniqueErrors, warnings: uniqueWarnings } }, null, 2))
  })

// cli.help()

cli.parse()
