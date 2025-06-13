import type { CheckOptions, PageType } from '../check'
import { getTag } from '../utils/html'

export default function (options: CheckOptions, document: Document, page: PageType) {
  if (!options.accessibility)
    return

  // Check inputs without labels
  const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input[type="url"], input[type="search"], textarea, select'))

  for (const input of inputs) {
    const id = input.getAttribute('id')
    const ariaLabel = input.getAttribute('aria-label')
    const ariaLabelledby = input.getAttribute('aria-labelledby')

    let hasLabel = false

    // Check for aria-label
    if (ariaLabel) {
      hasLabel = true
    }

    // Check for aria-labelledby
    if (ariaLabelledby) {
      const labelElement = document.querySelector(`#${ariaLabelledby}`)
      if (labelElement) {
        hasLabel = true
      }
    }

    // Check for associated label
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`)
      if (label) {
        hasLabel = true
      }
    }

    // Check for wrapping label
    const parentLabel = input.closest('label')
    if (parentLabel) {
      hasLabel = true
    }

    if (!hasLabel) {
      page.errors.push(`Accessibility: Form input without label: ${getTag(input)}`)
    }
  }

  // Check labels without associated inputs
  const labels = Array.from(document.querySelectorAll('label[for]'))
  for (const label of labels) {
    const forAttr = label.getAttribute('for')
    if (forAttr && !document.querySelector(`#${forAttr}`)) {
      page.errors.push(`Accessibility: Label references non-existent input: ${getTag(label)}`)
    }
  }
}
