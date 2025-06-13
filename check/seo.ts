import type { CheckOptions, PageType } from '../check'
import { notNullish } from '@kaynooo/utils'
import { getTag } from '../utils/html'

const sizes: Record<string, number> = { '0': 11.484375, '1': 11.484375, '2': 11.484375, '3': 11.484375, '4': 11.484375, '5': 11.484375, '6': 11.484375, '7': 11.484375, '8': 11.484375, '9': 11.484375, 'A': 13.46875, 'B': 12.765625, 'C': 13.09375, 'D': 13, 'E': 11.25, 'F': 10.96875, 'G': 13.625, 'H': 14.140625, 'I': 5.84375, 'J': 11.171875, 'K': 12.703125, 'L': 10.84375, 'M': 17.53125, 'N': 14.125, 'O': 13.8125, 'P': 12.90625, 'Q': 13.8125, 'R': 12.765625, 'S': 12.296875, 'T': 12.375, 'U': 13.171875, 'V': 13.078125, 'W': 17.5, 'X': 12.71875, 'Y': 12.375, 'Z': 12.125, 'a': 10.734375, 'b': 11.265625, 'c': 10.4375, 'd': 11.28125, 'e': 10.8125, 'f': 6.9375, 'g': 11.421875, 'h': 11.203125, 'i': 5.3125, 'j': 5.203125, 'k': 10.6875, 'l': 5.3125, 'm': 17.328125, 'n': 11.203125, 'o': 11.3125, 'p': 11.265625, 'q': 11.3125, 'r': 7.296875, 's': 10.296875, 't': 6.765625, 'u': 11.203125, 'v': 10.109375, 'w': 14.703125, 'x': 10.1875, 'y': 10.046875, 'z': 10.1875, '-': 7.765625, ' ': 4.984375 }
const averageSize = Object.values(sizes).reduce((total, size) => total + size, 0) / Object.keys(sizes).length
function overflowTitle(title: string) {
  return title.split('').reduce((total, char: any) => total + (sizes[char] ?? averageSize), 0) > 550
}

export default async function (options: CheckOptions, document: Document, page: PageType) {
  if (!options.seo)
    return

  for (let i = 1; i <= 6; i++) {
    const selector = `h${i}` as keyof PageType['headings']
    const elements = document.querySelectorAll(selector)
    page.headings[selector] = Array.from(elements).map(element => element.textContent?.trim()).filter(notNullish)
  }

  if (document.querySelector('h1') === null)
    page.errors.push('SEO: Missing h1')
  else if (Object.values(page.headings).every(heading => heading.length === 0))
    page.errors.push('SEO: No headings')

  if (page.headings.h1.length > 1)
    page.errors.push('SEO: Multiple h1')

  for (let i = 2; i <= 6; i++) {
    const selector = `h${i}` as keyof PageType['headings']
    if (page.headings[selector].length > 0 && page.headings[`h${i - 1}` as keyof PageType['headings']].length === 0)
      page.errors.push(`SEO: Heading ${i} without heading ${i - 1}`)
  }

  if (!document.title.trim())
    page.errors.push('SEO: Missing title')
  else if (overflowTitle(document.title))
    page.warnings.push('SEO: Title too long')

  if (!document.querySelector('meta[name="description"]'))
    page.errors.push(`SEO: Missing meta description tag`)

  if (page.headings.h1) {
    for (const heading of page.headings.h1) {
      if (heading.split(' ').length > 12)
        page.warnings.push(`SEO: H1 too long: ${heading}`)
    }
  }

  const notHrefLink = Array.from(document.querySelectorAll('a:not([href])'))
  for (const element of notHrefLink)
    page.errors.push(`SEO: Link without href: ${getTag(element)}`)

  const images = Array.from(document.querySelectorAll('img[src]')).map(element => element.getAttribute('src')) as string[]
  for (const image of images) {
    try {
      const imgUrl = image.startsWith('http') ? new URL(image) : new URL(image, page.path)
      const data = await fetch(imgUrl)
      if (!data.ok)
        page.errors.push(`SEO: Image not reachable: ${imgUrl.toString()}`)
      else if (!data.headers.get('content-type')?.startsWith('image'))
        page.errors.push(`SEO: Not an image: ${imgUrl.toString()}`)
    }
    catch (e) {
      page.errors.push(`SEO: Image not reachable: ${image} - ${(e instanceof Error ? e.message : String(e))}`)
      console.error(`Error fetching image ${image}:`, e)
    }
  }
}
