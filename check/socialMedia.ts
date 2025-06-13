import type { CheckOptions, PageType } from '../check'

export default function (options: CheckOptions, document: Document, page: PageType) {
  if (!options.socialMedia)
    return

  if (!document.querySelector('meta[property="og:title"]'))
    page.errors.push(`SEO: Missing og:title tag`)

  if (!document.querySelector('meta[property="og:description"]'))
    page.errors.push(`SEO: Missing og:description tag`)

  if (!document.querySelector('meta[property="og:image"]'))
    page.errors.push(`SEO: Missing og:image tag`)

  if (!document.querySelector('meta[property="og:url"]'))
    page.errors.push(`SEO: Missing og:url tag`)

  if (!document.querySelector('meta[property="og:type"]'))
    page.errors.push(`SEO: Missing og:type tag`)

  if (!document.querySelector('meta[name="twitter:title"]'))
    page.errors.push(`SEO: Missing twitter:title tag`)

  if (!document.querySelector('meta[name="twitter:description"]'))
    page.errors.push(`SEO: Missing twitter:description tag`)

  if (!document.querySelector('meta[name="twitter:image"]'))
    page.errors.push(`SEO: Missing twitter:image tag`)
}
