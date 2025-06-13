import type { CheckOptions, PageType } from '../check'
import { getTag } from '../utils/html'

const validRoles = new Set([
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'button',
  'cell',
  'checkbox',
  'columnheader',
  'combobox',
  'complementary',
  'contentinfo',
  'definition',
  'dialog',
  'directory',
  'document',
  'feed',
  'figure',
  'form',
  'grid',
  'gridcell',
  'group',
  'heading',
  'img',
  'link',
  'list',
  'listbox',
  'listitem',
  'log',
  'main',
  'marquee',
  'math',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'navigation',
  'none',
  'note',
  'option',
  'presentation',
  'progressbar',
  'radio',
  'radiogroup',
  'region',
  'row',
  'rowgroup',
  'rowheader',
  'scrollbar',
  'search',
  'searchbox',
  'separator',
  'slider',
  'spinbutton',
  'status',
  'switch',
  'tab',
  'table',
  'tablist',
  'tabpanel',
  'term',
  'textbox',
  'timer',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
  'treeitem',
])

const ariaRequirements: Record<string, string[]> = {
  checkbox: ['aria-checked'],
  radio: ['aria-checked'],
  slider: ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
  spinbutton: ['aria-valuenow'],
  progressbar: ['aria-valuenow'],
  tab: ['aria-selected'],
  option: ['aria-selected'],
  switch: ['aria-checked'],
}

export default function (options: CheckOptions, document: Document, page: PageType) {
  if (!options.accessibility)
    return

  // Check for invalid roles
  const elementsWithRoles = Array.from(document.querySelectorAll('[role]'))
  for (const element of elementsWithRoles) {
    const role = element.getAttribute('role')
    if (role && !validRoles.has(role)) {
      page.errors.push(`Accessibility: Invalid ARIA role "${role}": ${getTag(element)}`)
    }
  }

  // Check for required ARIA attributes
  for (const element of elementsWithRoles) {
    const role = element.getAttribute('role')
    if (role && ariaRequirements[role]) {
      for (const requiredAttr of ariaRequirements[role]) {
        if (!element.hasAttribute(requiredAttr)) {
          page.errors.push(`Accessibility: ARIA role "${role}" missing required attribute "${requiredAttr}": ${getTag(element)}`)
        }
      }
    }
  }

  // Check for elements that should have roles
  const buttonLikeElements = Array.from(document.querySelectorAll('div[onclick], span[onclick]')).filter(el => !el.hasAttribute('role'))
  for (const element of buttonLikeElements) {
    page.warnings.push(`Accessibility: Interactive element should have role="button": ${getTag(element)}`)
  }
}
