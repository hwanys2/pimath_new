#!/usr/bin/env python3
"""Dry-run / cutover data copy via Supabase Management SQL API.

Copies allowlisted auth.users + identities and public.pm_* data
from SOURCE_REF → TARGET_REF.

Each HTTP call is its own DB session, so FK-sensitive statements wrap
`SET LOCAL session_replication_role = replica` inside a single transaction.
"""

from __future__ import annotations

import base64
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from typing import Any

SOURCE_REF = "jmgoqpqyrnoamfjngcmy"
TARGET_REF = "ldkteahouacxazcmijav"
API = "https://api.supabase.com/v1/projects/{ref}/database/query"

PM_TABLES = [
    "pm_schools",
    "pm_classes",
    "pm_students",
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


def cli_token() -> str:
    raw = subprocess.check_output(
        ["security", "find-generic-password", "-s", "Supabase CLI", "-a", "supabase", "-w"],
        text=True,
    ).strip()
    if raw.startswith("go-keyring-base64:"):
        return base64.b64decode(raw.split(":", 1)[1]).decode()
    return raw


def sql(ref: str, query: str, token: str) -> Any:
    req = urllib.request.Request(
        API.format(ref=ref),
        data=json.dumps({"query": query}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            body = resp.read().decode()
            return json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"SQL HTTP {e.code} on {ref}: {err[:2500]}") from e


def esc(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False).replace("'", "''")


def insert_auth_users(token: str, rows: list[dict]) -> None:
    if not rows:
        return
    cols = [
        k
        for k in rows[0].keys()
        if k != "confirmed_at"
    ]
    col_list = ", ".join(cols)
    batch_size = 5
    for i in range(0, len(rows), batch_size):
        batch = [{k: r.get(k) for k in cols} for r in rows[i : i + batch_size]]
        sql(
            TARGET_REF,
            f"""
            BEGIN;
            SET LOCAL session_replication_role = replica;
            INSERT INTO auth.users ({col_list})
            SELECT {col_list}
            FROM jsonb_populate_recordset(NULL::auth.users, '{esc(batch)}'::jsonb);
            COMMIT;
            """,
            token,
        )
        print(f"    users {i + 1}-{i + len(batch)}")


def insert_auth_identities(token: str, rows: list[dict]) -> None:
    if not rows:
        return
    cols = [k for k in rows[0].keys() if k != "email"]
    col_list = ", ".join(cols)
    batch_size = 5
    for i in range(0, len(rows), batch_size):
        batch = [{k: r.get(k) for k in cols} for r in rows[i : i + batch_size]]
        sql(
            TARGET_REF,
            f"""
            BEGIN;
            SET LOCAL session_replication_role = replica;
            INSERT INTO auth.identities ({col_list})
            SELECT {col_list}
            FROM jsonb_populate_recordset(NULL::auth.identities, '{esc(batch)}'::jsonb);
            COMMIT;
            """,
            token,
        )
        print(f"    identities {i + 1}-{i + len(batch)}")


def main() -> int:
    token = cli_token()
    print(f"source={SOURCE_REF} target={TARGET_REF}")

    teachers = sql(
        SOURCE_REF,
        """
        SELECT array_agg(DISTINCT teacher_id::text ORDER BY teacher_id::text) AS ids FROM (
          SELECT teacher_id FROM public.pm_classes
          UNION SELECT teacher_id FROM public.pm_students
          UNION SELECT teacher_id FROM public.pm_teacher_schools
          UNION SELECT author_id FROM public.pm_forum_posts
          UNION SELECT author_id FROM public.pm_forum_comments
          UNION SELECT author_id FROM public.pm_diagram_feedback
          UNION SELECT resolved_by FROM public.pm_diagram_feedback WHERE resolved_by IS NOT NULL
        ) t WHERE teacher_id IS NOT NULL
        """,
        token,
    )
    ids: list[str] = (teachers or [{}])[0].get("ids") or []
    print(f"teachers={len(ids)}")
    if not ids:
        return 1
    id_list = ",".join(f"'{u}'::uuid" for u in ids)

    print("==> truncate target pm_* + auth")
    sql(
        TARGET_REF,
        """
        DO $$
        DECLARE r record;
        BEGIN
          FOR r IN
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public' AND tablename LIKE 'pm_%'
          LOOP
            EXECUTE format('TRUNCATE TABLE public.%I CASCADE', r.tablename);
          END LOOP;
        END $$;
        """,
        token,
    )
    sql(
        TARGET_REF,
        """
        BEGIN;
        SET LOCAL session_replication_role = replica;
        TRUNCATE auth.identities CASCADE;
        TRUNCATE auth.users CASCADE;
        COMMIT;
        """,
        token,
    )

    print("==> auth.users")
    users = sql(
        SOURCE_REF,
        f"""
        SELECT coalesce(jsonb_agg(to_jsonb(u) - 'confirmed_at'), '[]'::jsonb) AS rows
        FROM auth.users u WHERE u.id IN ({id_list})
        """,
        token,
    )
    user_rows = (users or [{}])[0].get("rows") or []
    if isinstance(user_rows, str):
        user_rows = json.loads(user_rows)
    print(f"    fetched {len(user_rows)} type={type(user_rows).__name__}")
    insert_auth_users(token, user_rows)

    print("==> auth.identities")
    identities = sql(
        SOURCE_REF,
        f"""
        SELECT coalesce(jsonb_agg(to_jsonb(i) - 'email'), '[]'::jsonb) AS rows
        FROM auth.identities i WHERE i.user_id IN ({id_list})
        """,
        token,
    )
    id_rows = (identities or [{}])[0].get("rows") or []
    if isinstance(id_rows, str):
        id_rows = json.loads(id_rows)
    print(f"    fetched {len(id_rows)}")
    insert_auth_identities(token, id_rows)

    print("==> pm_schools catalog")
    max_id = int(
        (
            sql(
                SOURCE_REF,
                'SELECT coalesce(max(id),0)::bigint AS m FROM public.school_schoolinfo',
                token,
            )
            or [{"m": 0}]
        )[0]["m"]
    )
    chunk = 1500
    for start in range(0, max_id + 1, chunk):
        end = start + chunk
        rows = sql(
            SOURCE_REF,
            f"""
            SELECT coalesce(jsonb_agg(jsonb_build_object(
              'id', s.id,
              'school_name', trim(s."SCHUL_NM"),
              'region', NULLIF(trim(s."LCTN_SC_NM"), ''),
              'created_at', now()
            )), '[]'::jsonb) AS rows
            FROM public.school_schoolinfo s
            WHERE s.id >= {start} AND s.id < {end}
              AND length(trim(s."SCHUL_NM")) > 0
            """,
            token,
        )
        batch = (rows or [{}])[0].get("rows") or []
        if not batch:
            continue
        sql(
            TARGET_REF,
            f"""
            INSERT INTO public.pm_schools (id, school_name, region, created_at)
            SELECT id, school_name, region, created_at
            FROM jsonb_populate_recordset(NULL::public.pm_schools, '{esc(batch)}'::jsonb)
            ON CONFLICT (id) DO NOTHING;
            """,
            token,
        )
        print(f"    schools {start}-{end - 1}: {len(batch)}")

    for table in PM_TABLES:
        if table == "pm_schools":
            continue
        exists = sql(
            SOURCE_REF,
            f"SELECT to_regclass('public.{table}') IS NOT NULL AS ok",
            token,
        )
        if not (exists or [{"ok": False}])[0].get("ok"):
            print(f"skip {table}")
            continue
        n = int(
            (sql(SOURCE_REF, f"SELECT count(*)::int AS n FROM public.{table}", token) or [{"n": 0}])[
                0
            ]["n"]
        )
        print(f"==> {table} ({n})")
        if n == 0:
            continue
        page = 150
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
                token,
            )
            batch = (rows or [{}])[0].get("rows") or []
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
                token,
            )
            offset += len(batch)
            print(f"    {offset}/{n}")
            time.sleep(0.02)

    print("==> pm_profiles from common_profile / metadata")
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
        token,
    )
    batch = (prof or [{}])[0].get("rows") or []
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
            token,
        )
        print(f"    profiles {len(batch)}")

    print("==> verify")
    result = sql(
        TARGET_REF,
        open(
            "/Users/hwanys2/Coding/pimath_new/scripts/supabase-split/verify-orphans.sql"
        ).read(),
        token,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
