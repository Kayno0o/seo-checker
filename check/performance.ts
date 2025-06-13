import type { CheckOptions, PageType } from '../check'

export default function (options: CheckOptions, document: Document, page: PageType) {
  if (!page.loadingTime)
    return

  if (page.loadingTime > 4000)
    page.errors.push(`Performance: Page load time too slow (${Math.round(page.loadingTime)}ms)`)
  else if (page.loadingTime > 2500)
    page.warnings.push(`Performance: Page load time could be improved (${Math.round(page.loadingTime)}ms)`)

  // Add performance score
  if (page.loadingTime < 1000)
    page.performanceScore = 'excellent'
  else if (page.loadingTime < 2500)
    page.performanceScore = 'good'
  else if (page.loadingTime < 4000)
    page.performanceScore = 'needs-improvement'
  else page.performanceScore = 'poor'
}
