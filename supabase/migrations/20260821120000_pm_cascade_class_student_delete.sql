-- pimath: deleting a class/student also removes leftover PvP rows.
-- Apply to shared DB only after explicit human confirmation.
-- Does not touch foreducator objects.

-- ---------------------------------------------------------------------------
-- PvP queue / game FKs: SET NULL → CASCADE
-- ---------------------------------------------------------------------------

ALTER TABLE public.pm_omok_queue
  DROP CONSTRAINT pm_omok_queue_class_id_fkey,
  ADD CONSTRAINT pm_omok_queue_class_id_fkey
    FOREIGN KEY (class_id) REFERENCES public.pm_classes(id) ON DELETE CASCADE;

ALTER TABLE public.pm_omok_queue
  DROP CONSTRAINT pm_omok_queue_student_id_fkey,
  ADD CONSTRAINT pm_omok_queue_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.pm_students(id) ON DELETE CASCADE;

ALTER TABLE public.pm_omok_queue
  DROP CONSTRAINT pm_omok_queue_game_fk,
  ADD CONSTRAINT pm_omok_queue_game_fk
    FOREIGN KEY (game_id) REFERENCES public.pm_omok_games(id) ON DELETE CASCADE;

ALTER TABLE public.pm_omok_games
  DROP CONSTRAINT pm_omok_games_black_student_id_fkey,
  ADD CONSTRAINT pm_omok_games_black_student_id_fkey
    FOREIGN KEY (black_student_id) REFERENCES public.pm_students(id) ON DELETE CASCADE;

ALTER TABLE public.pm_omok_games
  DROP CONSTRAINT pm_omok_games_white_student_id_fkey,
  ADD CONSTRAINT pm_omok_games_white_student_id_fkey
    FOREIGN KEY (white_student_id) REFERENCES public.pm_students(id) ON DELETE CASCADE;

ALTER TABLE public.pm_quad_queue
  DROP CONSTRAINT pm_quad_queue_class_id_fkey,
  ADD CONSTRAINT pm_quad_queue_class_id_fkey
    FOREIGN KEY (class_id) REFERENCES public.pm_classes(id) ON DELETE CASCADE;

ALTER TABLE public.pm_quad_queue
  DROP CONSTRAINT pm_quad_queue_student_id_fkey,
  ADD CONSTRAINT pm_quad_queue_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.pm_students(id) ON DELETE CASCADE;

ALTER TABLE public.pm_quad_queue
  DROP CONSTRAINT pm_quad_queue_game_fk,
  ADD CONSTRAINT pm_quad_queue_game_fk
    FOREIGN KEY (game_id) REFERENCES public.pm_quad_games(id) ON DELETE CASCADE;

ALTER TABLE public.pm_quad_games
  DROP CONSTRAINT pm_quad_games_black_student_id_fkey,
  ADD CONSTRAINT pm_quad_games_black_student_id_fkey
    FOREIGN KEY (black_student_id) REFERENCES public.pm_students(id) ON DELETE CASCADE;

ALTER TABLE public.pm_quad_games
  DROP CONSTRAINT pm_quad_games_white_student_id_fkey,
  ADD CONSTRAINT pm_quad_games_white_student_id_fkey
    FOREIGN KEY (white_student_id) REFERENCES public.pm_students(id) ON DELETE CASCADE;

ALTER TABLE public.pm_sq_queue
  DROP CONSTRAINT pm_sq_queue_class_id_fkey,
  ADD CONSTRAINT pm_sq_queue_class_id_fkey
    FOREIGN KEY (class_id) REFERENCES public.pm_classes(id) ON DELETE CASCADE;

ALTER TABLE public.pm_sq_queue
  DROP CONSTRAINT pm_sq_queue_student_id_fkey,
  ADD CONSTRAINT pm_sq_queue_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.pm_students(id) ON DELETE CASCADE;

ALTER TABLE public.pm_sq_queue
  DROP CONSTRAINT pm_sq_queue_game_fk,
  ADD CONSTRAINT pm_sq_queue_game_fk
    FOREIGN KEY (game_id) REFERENCES public.pm_sq_games(id) ON DELETE CASCADE;

ALTER TABLE public.pm_sq_games
  DROP CONSTRAINT pm_sq_games_black_student_id_fkey,
  ADD CONSTRAINT pm_sq_games_black_student_id_fkey
    FOREIGN KEY (black_student_id) REFERENCES public.pm_students(id) ON DELETE CASCADE;

ALTER TABLE public.pm_sq_games
  DROP CONSTRAINT pm_sq_games_white_student_id_fkey,
  ADD CONSTRAINT pm_sq_games_white_student_id_fkey
    FOREIGN KEY (white_student_id) REFERENCES public.pm_students(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Rematch blocks have no FK (player_key is text). Clean them on student delete.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pm_cleanup_student_pvp_rows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pm_pvp_rematch_block
  WHERE player_key = 'student:' || OLD.id::text
     OR opponent_key = 'student:' || OLD.id::text;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS pm_students_cleanup_pvp ON public.pm_students;
CREATE TRIGGER pm_students_cleanup_pvp
  BEFORE DELETE ON public.pm_students
  FOR EACH ROW
  EXECUTE FUNCTION public.pm_cleanup_student_pvp_rows();

REVOKE ALL ON FUNCTION public.pm_cleanup_student_pvp_rows() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pm_cleanup_student_pvp_rows() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- One-time: leftover queue rows from past SET NULL student deletes
-- (guest queues keep guest_id and must stay)
-- ---------------------------------------------------------------------------

DELETE FROM public.pm_omok_queue
WHERE student_id IS NULL AND coalesce(trim(guest_id), '') = '';

DELETE FROM public.pm_quad_queue
WHERE student_id IS NULL AND coalesce(trim(guest_id), '') = '';

DELETE FROM public.pm_sq_queue
WHERE student_id IS NULL AND coalesce(trim(guest_id), '') = '';

DELETE FROM public.pm_pvp_rematch_block b
WHERE (
  b.player_key LIKE 'student:%'
  AND NOT EXISTS (
    SELECT 1 FROM public.pm_students s
    WHERE b.player_key = 'student:' || s.id::text
  )
) OR (
  b.opponent_key LIKE 'student:%'
  AND NOT EXISTS (
    SELECT 1 FROM public.pm_students s
    WHERE b.opponent_key = 'student:' || s.id::text
  )
);
