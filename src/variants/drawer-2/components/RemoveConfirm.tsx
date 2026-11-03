import { ConfirmDialog } from './ConfirmDialog'

/** Asks before removing respondents from the project. */
export function RemoveConfirm({ names, onConfirm, onCancel }: { names: string[]; onConfirm: () => void; onCancel: () => void }) {
  const who = names.length === 1 ? names[0] : `${names.length} respondents`
  return (
    <ConfirmDialog
      title={`Remove ${who} from this project?`}
      confirmLabel={names.length === 1 ? 'Remove respondent' : `Remove ${who}`}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {names.length === 1 ? 'They' : 'These respondents'} will no longer appear in this list. This can’t be undone.
    </ConfirmDialog>
  )
}
