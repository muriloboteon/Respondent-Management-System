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

/** What the variants differ in, shown before the tabs. */
export const VARIANTS_COMPARE = 'Filter type'

export const VARIANTS: Variant[] = [
  { id: 'drawer-2', label: 'Guided drawer', description: 'Filters in a side drawer, guided: applied filters and a few common properties first, the rest behind Add filter' },
  { id: 'main', label: 'Full drawer', description: 'Filters in a side drawer with every property listed: values tick on and apply right away' },
  { id: 'popover', label: 'Inline chips', description: 'Filters as chips above the table, no drawer: one popover picks the column and its values' },
]

export function variantHref(id: string) {
  return id === 'main' ? '/' : `/variants/${id}/`
}
