export function isHTMLElement(element: Element): element is HTMLElement {
  return 'style' in element
}

export function getTag(element: Element) {
  return element.outerHTML.slice(0, element.outerHTML.indexOf('>') + 1)
}
