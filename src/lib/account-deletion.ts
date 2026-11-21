// Account deletion: what the confirm dialog gates on and the date it shows.
//
// Mirrors goscribe/server: `auth.requestAccountDeletion` sets `deletedAt`
// and emails a restore link valid for 30 days; `scripts/purge-deleted-users`
// hard-deletes accounts whose `deletedAt` is 30 or more days old. The
// mutation returns no date, so the app works it out from the same 30 days.

/** Days between the request and permanent deletion (server: purge-deleted-users). */
export const DELETION_GRACE_DAYS = 30;

/** The word the user types to confirm. Not translated: it is shown as-is. */
export const DELETE_CONFIRM_WORD = "DELETE";

/**
 * True when the typed text confirms deletion: the word DELETE (any case) or
 * the account's email (any case). Surrounding spaces are ignored; anything
 * else, including an empty string, does not confirm.
 */
export function isDeletionConfirmed(typed: string, email?: string | null): boolean {
  const value = typed.trim();
  if (!value) return false;
  if (value.toUpperCase() === DELETE_CONFIRM_WORD) return true;
  const account = email?.trim();
  return Boolean(account) && value.toLowerCase() === account!.toLowerCase();
}

/** When the account will be permanently deleted, for a request made at `requestedAt`. */
export function deletionDate(requestedAt: Date = new Date()): Date {
  return new Date(requestedAt.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
}
