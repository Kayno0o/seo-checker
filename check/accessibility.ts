import type { CheckOptions, PageType } from '../check'
import { getTag, isHTMLElement } from '../utils/html'

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

// also check parent elements for aria-hidden
function notAriaHidden(element: Element) {
  if (element.getAttribute('aria-hidden') === 'true' || element.getAttribute('aria-hidden') === '')
    return false

  if (element.parentElement)
    return notAriaHidden(element.parentElement)

  return true
}

export default function (options: CheckOptions, document: Document, page:PageType) {
  if (!options.accessibility)
    return

  const notLabelledLink = Array.from(document.querySelectorAll('a:not([aria-label]), [role=button]:not([aria-label]), button:not([aria-label])')).filter(isHTMLElement).filter(notAriaHidden).filter(e => hasAccessibilityContent(e, false))
  for (const element of notLabelledLink)
    page.errors.push(`Accessibility: Not labelled link/button: ${getTag(element)}`)

  const notAltImage = Array.from(document.querySelectorAll('img:not([alt])')).filter(notAriaHidden)
  for (const element of notAltImage)
    page.errors.push(`Accessibility: Image without alt: ${getTag(element)}`)

  const notRoleImgSvg = Array.from(document.querySelectorAll('svg:not([role=img])')).filter(notAriaHidden)
  for (const element of notRoleImgSvg)
    page.warnings.push(`Accessibility: SVG without role=img: ${getTag(element)}`)

  const notAriaLabelSvg = Array.from(document.querySelectorAll('svg:not([aria-label])')).filter(notAriaHidden)
  for (const element of notAriaLabelSvg)
    page.errors.push(`Accessibility: SVG without aria-label: ${getTag(element)}`)
}
