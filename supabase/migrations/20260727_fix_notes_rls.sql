-- Fix: notes table RLS — allow soft-delete (UPDATE setting is_deleted = true)
--
-- Root cause: the original FOR ALL policy uses
--   USING (user_id = auth.uid() AND is_deleted = false)
-- Supabase/PostgREST evaluates the USING expression against the NEW row after
-- an UPDATE. After soft-deleting a note, the new row has is_deleted = true,
-- which fails `is_deleted = false`, so the UPDATE is silently blocked (0 rows
-- affected, no error). softDeleteNote() therefore always returns true while
-- the DB row remains unchanged — the note reappears on next page load.
--
-- Fix: split into per-command policies.
-- SELECT keeps `is_deleted = false` (users only see live notes).
-- UPDATE relaxes USING to `user_id = auth.uid()` only, allowing soft-deletes
-- and other mutations regardless of current is_deleted state.
--
-- Execute in Supabase SQL Editor.

-- Drop the overly restrictive FOR ALL policy
DROP POLICY IF EXISTS notes_user_isolation ON notes;

-- SELECT: users only see their own non-deleted notes
CREATE POLICY notes_select ON notes FOR SELECT
  USING (user_id = auth.uid() AND is_deleted = false);

-- INSERT: users can only insert their own notes
CREATE POLICY notes_insert ON notes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: users can update their own notes in any state
-- (is_deleted = false → true for soft-delete, or title edits on live notes)
-- Both USING (old row) and WITH CHECK (new row) only check ownership.
CREATE POLICY notes_update ON notes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: hard-delete safety guard (not used in practice, but present for
-- defence-in-depth should PostgREST ever issue a physical DELETE)
CREATE POLICY notes_delete ON notes FOR DELETE
  USING (user_id = auth.uid());
