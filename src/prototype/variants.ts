/**
 * The prototype's variants, in tab order. Each one is a separate page with its own copy of the
 * app (see scripts/new-variant.mjs); they share only the sample data in src/data.
 *
 * - `main` lives in src/ and is served at the site root.
 * - Every other variant lives in src/variants/<id>/ and is served at /variants/<id>/.
 */
export interface Variant {
  id: string
  label: string
  /** One line on what the variant tries, shown as the tab's tooltip. */
  description: string
}

export const VARIANTS: Variant[] = [
  { id: 'main', label: 'Facet drawer', description: 'Filters in a side drawer: a section per property, values tick on and apply right away' },
  { id: 'popover', label: 'Popover + chips', description: 'Filters as chips above the table; one popover picks the column and its values, added with a button' },
  { id: 'drawer-2', label: 'Facet drawer 2', description: 'Facet drawer with progressive disclosure: applied filters, a few common properties, the rest behind Add filter' },
]

export function variantHref(id: string) {
  return id === 'main' ? '/' : `/variants/${id}/`
}
