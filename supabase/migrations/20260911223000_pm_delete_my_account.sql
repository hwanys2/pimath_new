-- pimath: teacher self-delete. Wipes the auth user and all owned class/student data.
-- Independent project only.

-- ---------------------------------------------------------------------------
-- Leftover FKs that would otherwise SET NULL (or have no FK)
-- ---------------------------------------------------------------------------

ALTER TABLE public.pm_alkagi_queue
  DROP CONSTRAINT IF EXISTS pm_alkagi_queue_class_id_fkey;
ALTER TABLE public.pm_alkagi_queue
  ADD CONSTRAINT pm_alkagi_queue_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES public.pm_classes (id) ON DELETE CASCADE;

ALTER TABLE public.pm_alkagi_queue
  DROP CONSTRAINT IF EXISTS pm_alkagi_queue_student_id_fkey;
ALTER TABLE public.pm_alkagi_queue
  ADD CONSTRAINT pm_alkagi_queue_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.pm_students (id) ON DELETE CASCADE;

ALTER TABLE public.pm_alkagi_queue
  DROP CONSTRAINT IF EXISTS pm_alkagi_queue_game_fk;
ALTER TABLE public.pm_alkagi_queue
  ADD CONSTRAINT pm_alkagi_queue_game_fk
  FOREIGN KEY (game_id) REFERENCES public.pm_alkagi_games (id) ON DELETE CASCADE;

ALTER TABLE public.pm_alkagi_games
  DROP CONSTRAINT IF EXISTS pm_alkagi_games_black_student_id_fkey;
ALTER TABLE public.pm_alkagi_games
  ADD CONSTRAINT pm_alkagi_games_black_student_id_fkey
  FOREIGN KEY (black_student_id) REFERENCES public.pm_students (id) ON DELETE CASCADE;

ALTER TABLE public.pm_alkagi_games
  DROP CONSTRAINT IF EXISTS pm_alkagi_games_white_student_id_fkey;
ALTER TABLE public.pm_alkagi_games
  ADD CONSTRAINT pm_alkagi_games_white_student_id_fkey
  FOREIGN KEY (white_student_id) REFERENCES public.pm_students (id) ON DELETE CASCADE;

ALTER TABLE public.pm_graph_sessions
  DROP CONSTRAINT IF EXISTS pm_graph_sessions_teacher_id_fkey;
ALTER TABLE public.pm_graph_sessions
  ADD CONSTRAINT pm_graph_sessions_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES auth.users (id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Self-delete RPC: forum files first, then auth.users (cascades the rest)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id = 'pm_forum'
    AND (
      name LIKE v_uid::text || '/%'
      OR owner = v_uid
      OR owner_id = v_uid::text
    );

  DELETE FROM public.pm_pvp_rematch_block b
  WHERE b.player_key IN (
      SELECT 'student:' || s.id::text
      FROM public.pm_students s
      WHERE s.teacher_id = v_uid
    )
     OR b.opponent_key IN (
      SELECT 'student:' || s.id::text
      FROM public.pm_students s
      WHERE s.teacher_id = v_uid
    );

  DELETE FROM public.pm_notifications
  WHERE sender_id = v_uid;

  DELETE FROM auth.users
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'account not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pm_delete_my_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.pm_delete_my_account() TO authenticated;
