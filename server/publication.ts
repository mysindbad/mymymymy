/**
 * Publication is a database fact, not a UI convention.
 *
 * A row in `public.places` or `public.reviews` is published exactly when moderation has approved
 * it. `supabase/migrations/20260917115914_admin_control_center.sql` enforces the same rule at the
 * row-security layer, and this module is where the API server applies it to the reads it performs
 * with a privileged client - RLS does not bind `service_role`, so without this half of the rule an
 * unpublished submission would still be reachable through `/api/places`.
 *
 * Two deliberate details:
 *  - A row with no `moderation_status` at all is published. Bundled seed content and snapshots
 *    written before moderation existed carry no moderation column, and hiding them would quietly
 *    empty the catalogue the app depends on.
 *  - A viewer may read *their own* unpublished row. Someone whose submission is queued is told so
 *    by the interface; making their record vanish on reload would look like data loss, and it is
 *    the same exemption the authenticated RLS policy grants. It is an ownership exemption, never a
 *    publication one: discovery lists and AI context stay approved-only for everybody.
 */

export const PUBLISHED_MODERATION_STATUS = 'approved';
export const PENDING_MODERATION_STATUS = 'pending';

/** Columns a moderation-bearing row can name an owner by. */
export type PublicationRow = {
  moderation_status?: string | null;
  created_by_user_id?: string | null;
  author_user_id?: string | null;
};

export function isPublished(row: PublicationRow | null | undefined, viewerId?: string | null): boolean {
  if (!row) return false;
  const status = row.moderation_status;
  if (status === undefined || status === null || status === PUBLISHED_MODERATION_STATUS) return true;
  if (!viewerId) return false;
  return row.created_by_user_id === viewerId || row.author_user_id === viewerId;
}

export function isPublishedOnly(row: PublicationRow | null | undefined): boolean {
  return isPublished(row, null);
}

export function publishedRows<T extends PublicationRow>(rows: readonly T[] | null | undefined, viewerId?: string | null): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => isPublished(row, viewerId));
}

export function publishedForEveryone<T extends PublicationRow>(rows: readonly T[] | null | undefined): T[] {
  return publishedRows(rows, null);
}
