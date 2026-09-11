#!/usr/bin/env python3
"""Resume: copy remaining pm_* tables (skip already-filled core tables)."""

from __future__ import annotations

import base64
import json
import subprocess
import time
import urllib.error
import urllib.request
from typing import Any

SOURCE_REF = "jmgoqpqyrnoamfjngcmy"
TARGET_REF = "ldkteahouacxazcmijav"
API = "https://api.supabase.com/v1/projects/{ref}/database/query"

SKIP = {"pm_schools", "pm_classes", "pm_students"}

PM_TABLES = [
    "pm_student_sessions",
    "pm_student_qr_tokens",
    "pm_xp_events",
    "pm_class_contents",
    "pm_game_runs",
    "pm_activity_sessions",
    "pm_teacher_schools",
    "pm_profiles",
    "pm_notifications",
    "pm_game_presence",
    "pm_diagram_feedback",
    "pm_forum_posts",
    "pm_forum_comments",
    "pm_inquiry_sessions",
    "pm_inquiry_participants",
    "pm_inquiry_step_responses",
    "pm_dice_race_sessions",
    "pm_dice_race_players",
    "pm_ball_box_sessions",
    "pm_ball_box_players",
    "pm_graph_sessions",
    "pm_graph_participants",
    "pm_graph_points",
    "pm_omok_queue",
    "pm_omok_games",
    "pm_omok_ratings",
    "pm_quad_queue",
    "pm_quad_games",
    "pm_quad_ratings",
    "pm_sq_queue",
    "pm_sq_games",
    "pm_sq_ratings",
    "pm_alkagi_queue",
    "pm_alkagi_games",
    "pm_alkagi_ratings",
    "pm_pvp_rematch_block",
]


def token() -> str:
    raw = subprocess.check_output(
        ["security", "find-generic-password", "-s", "Supabase CLI", "-a", "supabase", "-w"],
        text=True,
    ).strip()
    return base64.b64decode(raw.split(":", 1)[1]).decode()


def sql(ref: str, query: str, tok: str) -> Any:
    req = urllib.request.Request(
        API.format(ref=ref),
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            body = resp.read().decode()
            return json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode()[:2500]) from e


def esc(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False).replace("'", "''")


def main() -> None:
    tok = token()
    for table in PM_TABLES:
        if table in SKIP:
            continue
        exists = sql(SOURCE_REF, f"SELECT to_regclass('public.{table}') IS NOT NULL AS ok", tok)
        if not (exists or [{"ok": False}])[0].get("ok"):
            print(f"skip missing {table}", flush=True)
            continue
        n = int((sql(SOURCE_REF, f"SELECT count(*)::int AS n FROM public.{table}", tok) or [{"n": 0}])[0]["n"])
        tgt = int((sql(TARGET_REF, f"SELECT count(*)::int AS n FROM public.{table}", tok) or [{"n": 0}])[0]["n"])
        print(f"==> {table} source={n} target={tgt}", flush=True)
        if n == 0:
            continue
        if tgt == n:
            print("    already complete", flush=True)
            continue
        if tgt > 0:
            sql(TARGET_REF, f"TRUNCATE public.{table} CASCADE;", tok)
        page = 100 if n > 10000 else 150
        offset = 0
        while offset < n:
            rows = sql(
                SOURCE_REF,
                f"""
                SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS rows
                FROM (
                  SELECT * FROM public.{table}
                  ORDER BY 1
                  LIMIT {page} OFFSET {offset}
                ) t
                """,
                tok,
            )
            batch = (rows or [{}])[0].get("rows") or []
            if isinstance(batch, str):
                batch = json.loads(batch)
            if not batch:
                break
            sql(
                TARGET_REF,
                f"""
                BEGIN;
                SET LOCAL session_replication_role = replica;
                INSERT INTO public.{table}
                SELECT * FROM jsonb_populate_recordset(NULL::public.{table}, '{esc(batch)}'::jsonb);
                COMMIT;
                """,
                tok,
            )
            offset += len(batch)
            print(f"    {offset}/{n}", flush=True)
            time.sleep(0.01)

    # profiles from common_profile
    print("==> pm_profiles", flush=True)
    ids = sql(
        SOURCE_REF,
        """
        SELECT array_agg(DISTINCT teacher_id::text) AS ids FROM (
          SELECT teacher_id FROM public.pm_classes
          UNION SELECT teacher_id FROM public.pm_students
          UNION SELECT teacher_id FROM public.pm_teacher_schools
          UNION SELECT author_id FROM public.pm_forum_posts
          UNION SELECT author_id FROM public.pm_forum_comments
          UNION SELECT author_id FROM public.pm_diagram_feedback
          UNION SELECT resolved_by FROM public.pm_diagram_feedback WHERE resolved_by IS NOT NULL
        ) t WHERE teacher_id IS NOT NULL
        """,
        tok,
    )
    id_list = ",".join(f"'{u}'::uuid" for u in ((ids or [{}])[0].get("ids") or []))
    prof = sql(
        SOURCE_REF,
        f"""
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'user_id', u.id,
          'email', lower(nullif(trim(u.email), '')),
          'nickname', coalesce(
            nullif(trim(pr.nickname), ''),
            nullif(trim(u.raw_user_meta_data ->> 'nickname'), ''),
            nullif(trim(u.raw_user_meta_data ->> 'name'), '')
          ),
          'created_at', now(),
          'updated_at', now()
        )), '[]'::jsonb) AS rows
        FROM auth.users u
        LEFT JOIN public.auth_user_supabase_mapping m ON m.supabase_uid = u.id
        LEFT JOIN public.common_profile pr ON pr.user_id = m.django_user_id
        WHERE u.id IN ({id_list})
        """,
        tok,
    )
    batch = (prof or [{}])[0].get("rows") or []
    if isinstance(batch, str):
        batch = json.loads(batch)
    if batch:
        sql(
            TARGET_REF,
            f"""
            INSERT INTO public.pm_profiles (user_id, email, nickname, created_at, updated_at)
            SELECT user_id, email, nickname, created_at, updated_at
            FROM jsonb_populate_recordset(NULL::public.pm_profiles, '{esc(batch)}'::jsonb)
            ON CONFLICT (user_id) DO UPDATE
              SET email = coalesce(EXCLUDED.email, public.pm_profiles.email),
                  nickname = coalesce(EXCLUDED.nickname, public.pm_profiles.nickname);
            """,
            tok,
        )
        print(f"    profiles {len(batch)}", flush=True)

    print("==> verify", flush=True)
    print(json.dumps(sql(TARGET_REF, open("/Users/hwanys2/Coding/pimath_new/scripts/supabase-split/verify-orphans.sql").read(), tok), indent=2))
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
