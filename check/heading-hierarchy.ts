import type { CheckOptions, PageType } from '../check'

export default function (options: CheckOptions, document: Document, page: PageType) {
  if (!options.seo)
    return

  const headings = page.headings
  const levels = [1, 2, 3, 4, 5, 6]

  for (const element of levels) {
    const currentLevel = element
    const currentHeadings = headings[`h${currentLevel}` as keyof typeof headings] || []

    if (currentHeadings.length > 0) {
      // Check if previous levels exist (skip h1 as it's the starting point)
      if (currentLevel > 1) {
        let hasParentLevel = false
        for (let j = 1; j < currentLevel; j++) {
          if ((headings[`h${j}` as keyof typeof headings] || []).length > 0) {
            hasParentLevel = true
            break
          }
        }
        if (!hasParentLevel) {
          page.errors.push(`SEO: Heading hierarchy - h${currentLevel} used without any parent heading levels`)
        }
      }

      // Check for proper sequential nesting
      if (currentLevel > 2) {
        const previousLevel = currentLevel - 1
        const previousHeadings = headings[`h${previousLevel}` as keyof typeof headings] || []
        if (previousHeadings.length === 0) {
          // Check if there's a heading level before the previous one
          let hasEarlierLevel = false
          for (let k = 1; k < previousLevel; k++) {
            if ((headings[`h${k}` as keyof typeof headings] || []).length > 0) {
              hasEarlierLevel = true
              break
            }
          }
          if (hasEarlierLevel) {
            page.errors.push(`SEO: Heading hierarchy - h${currentLevel} skips h${previousLevel} level`)
          }
        }
      }
    }
  }
}
