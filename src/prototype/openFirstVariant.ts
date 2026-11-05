import { VARIANTS, variantHref } from './variants'

// The site root has no app of its own: it opens the first tab of the variant bar, so reordering
// the tabs also changes which variant the link opens. replace() keeps the root out of history.
location.replace(variantHref(VARIANTS[0].id) + location.search + location.hash)
