import type { MenuItem } from './FloatingMenu'

/*
 * One set of respondent actions, used by the bulk actions, the row menu and the detail
 * panel: Assign (the three research methods), Segment, Export and Remove (RemoveConfirm).
 */

/** The research methods. "Live session…" opens the scheduling flow, hence the ellipsis. */
export const ASSIGN_ITEMS: MenuItem[] = [{ label: 'Live session…' }, { label: 'AI interview' }, { label: 'Activity (diary)' }]

export const SEGMENT_ITEMS: MenuItem[] = [{ label: 'Add to segment…' }, { label: 'Remove from segment…' }]
