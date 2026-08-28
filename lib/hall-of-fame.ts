import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getStudentSessionToken } from "@/lib/student-session";

export type HofTab = "world" | "school" | "class";

export type HofViewer = {
  kind: "anon" | "student" | "teacher";
  classId: string | null;
  className: string | null;
  schoolInfoId: number | null;
  schoolName: string | null;
  region: string | null;
  worldRank: number | null;
  schoolRank: number | null;
  classRank: number | null;
  schoolBoardRank: number | null;
};

export type HofSchoolRow = {
  rank: number;
  schoolInfoId: number;
  schoolName: string;
  region: string | null;
  totalXp: number;
  studentCount: number;
  isMine: boolean;
};

export type HofClassRow = {
  rank: number;
  classId: string;
  className: string;
  schoolInfoId: number | null;
  schoolName: string | null;
  region: string | null;
  totalXp: number;
  studentCount: number;
  isMine: boolean;
};

export type HofStudentRow = {
  rank: number;
  displayName: string;
  className: string | null;
  schoolName: string | null;
  schoolInfoId: number | null;
  classId: string | null;
  totalXp: number;
  level: number;
  isMe: boolean;
  isMasked: boolean;
};

export type HofBoard = {
  tab: HofTab;
  viewer: HofViewer;
  schools: HofSchoolRow[];
  classes: HofClassRow[];
  students: HofStudentRow[];
  selectedSchoolId: number | null;
  selectedClassId: string | null;
};

export type TeacherSchool = {
  schoolInfoId: number;
  schoolName: string;
  region: string | null;
  source: "foreducator" | "manual";
};

export type SchoolSearchHit = {
  schoolInfoId: number;
  schoolName: string;
  region: string | null;
};

function firstRows<T>(data: T | T[] | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

function asInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const EMPTY_VIEWER: HofViewer = {
  kind: "anon",
  classId: null,
  className: null,
  schoolInfoId: null,
  schoolName: null,
  region: null,
  worldRank: null,
  schoolRank: null,
  classRank: null,
  schoolBoardRank: null,
};

function mapViewer(row: Record<string, unknown> | null): HofViewer {
  if (!row) return EMPTY_VIEWER;
  const kind = row.kind;
  return {
    kind: kind === "student" || kind === "teacher" ? kind : "anon",
    classId: asText(row.class_id),
    className: asText(row.class_name),
    schoolInfoId: asInt(row.school_info_id),
    schoolName: asText(row.school_name),
    region: asText(row.region),
    worldRank: asInt(row.world_rank),
    schoolRank: asInt(row.school_rank),
    classRank: asInt(row.class_rank),
    schoolBoardRank: asInt(row.school_board_rank),
  };
}

function mapSchool(row: Record<string, unknown>): HofSchoolRow | null {
  const schoolInfoId = asInt(row.school_info_id);
  const rank = asInt(row.rank);
  const schoolName = asText(row.school_name);
  if (schoolInfoId == null || rank == null || !schoolName) return null;
  return {
    rank,
    schoolInfoId,
    schoolName,
    region: asText(row.region),
    totalXp: asInt(row.total_xp) ?? 0,
    studentCount: asInt(row.student_count) ?? 0,
    isMine: Boolean(row.is_mine),
  };
}

function mapClass(row: Record<string, unknown>): HofClassRow | null {
  const classId = asText(row.class_id);
  const rank = asInt(row.rank);
  const className = asText(row.class_name);
  if (!classId || rank == null || !className) return null;
  return {
    rank,
    classId,
    className,
    schoolInfoId: asInt(row.school_info_id),
    schoolName: asText(row.school_name),
    region: asText(row.region),
    totalXp: asInt(row.total_xp) ?? 0,
    studentCount: asInt(row.student_count) ?? 0,
    isMine: Boolean(row.is_mine),
  };
}

function mapStudent(row: Record<string, unknown>): HofStudentRow | null {
  const rank = asInt(row.rank);
  const displayName = asText(row.display_name);
  if (rank == null || !displayName) return null;
  return {
    rank,
    displayName,
    className: asText(row.class_name),
    schoolName: asText(row.school_name),
    schoolInfoId: asInt(row.school_info_id),
    classId: asText(row.class_id),
    totalXp: asInt(row.total_xp) ?? 0,
    level: asInt(row.level) ?? 1,
    isMe: Boolean(row.is_me),
    isMasked: Boolean(row.is_masked),
  };
}

async function sessionTokenOr(
  explicit?: string | null,
): Promise<string | null> {
  if (explicit !== undefined) return explicit;
  return getStudentSessionToken();
}

export async function fetchHofViewer(input?: {
  sessionToken?: string | null;
}): Promise<HofViewer> {
  const token = await sessionTokenOr(input?.sessionToken);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_get_hof_viewer", {
    p_session_token: token,
  });
  if (error) {
    console.error("[pm] pm_get_hof_viewer failed:", error.message);
    return EMPTY_VIEWER;
  }
  return mapViewer(firstRows(data)[0] as Record<string, unknown> | undefined ?? null);
}

export async function fetchHofBoard(input?: {
  tab?: HofTab;
  schoolInfoId?: number | null;
  classId?: string | null;
  sessionToken?: string | null;
  lockClassId?: string | null;
}): Promise<HofBoard> {
  const tab = input?.tab ?? "world";
  const token = await sessionTokenOr(input?.sessionToken);
  const supabase = await createClient();

  const [viewerRes, schoolsRes, classesRes] = await Promise.all([
    supabase.rpc("pm_get_hof_viewer", { p_session_token: token }),
    supabase.rpc("pm_list_hof_schools", {
      p_limit: 20,
      p_session_token: token,
    }),
    supabase.rpc("pm_list_hof_classes", {
      p_limit: 20,
      p_session_token: token,
    }),
  ]);

  if (viewerRes.error) {
    console.error("[pm] pm_get_hof_viewer failed:", viewerRes.error.message);
  }
  if (schoolsRes.error) {
    console.error("[pm] pm_list_hof_schools failed:", schoolsRes.error.message);
  }
  if (classesRes.error) {
    console.error("[pm] pm_list_hof_classes failed:", classesRes.error.message);
  }

  const viewer = mapViewer(
    firstRows(viewerRes.data)[0] as Record<string, unknown> | undefined ?? null,
  );
  const schools = firstRows(schoolsRes.data)
    .map((row) => mapSchool(row as Record<string, unknown>))
    .filter((row): row is HofSchoolRow => row != null);
  const classes = firstRows(classesRes.data)
    .map((row) => mapClass(row as Record<string, unknown>))
    .filter((row): row is HofClassRow => row != null);

  let selectedSchoolId = input?.schoolInfoId ?? null;
  let selectedClassId = input?.classId ?? input?.lockClassId ?? null;

  if (tab === "school" && selectedSchoolId == null) {
    selectedSchoolId =
      viewer.schoolInfoId ?? schools.find((s) => s.rank === 1)?.schoolInfoId ?? null;
  }

  if (tab === "class" && selectedClassId == null) {
    if (input?.lockClassId) {
      selectedClassId = input.lockClassId;
    } else if (viewer.kind === "student") {
      selectedClassId = viewer.classId;
    } else if (viewer.kind === "teacher") {
      selectedClassId = null;
    } else {
      selectedClassId = classes.find((c) => c.rank === 1)?.classId ?? null;
    }
  }

  const { data: studentData, error: studentError } = await supabase.rpc(
    "pm_list_hof_students",
    {
      p_scope: tab,
      p_school_info_id: tab === "school" ? selectedSchoolId : null,
      p_class_id: tab === "class" ? selectedClassId : null,
      p_limit: 20,
      p_session_token: token,
    },
  );

  if (studentError) {
    console.error("[pm] pm_list_hof_students failed:", studentError.message);
  }

  const students = firstRows(studentData)
    .map((row) => mapStudent(row as Record<string, unknown>))
    .filter((row): row is HofStudentRow => row != null);

  return {
    tab,
    viewer,
    schools,
    classes,
    students,
    selectedSchoolId,
    selectedClassId,
  };
}

export async function fetchMyTeacherSchool(): Promise<TeacherSchool | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_get_my_teacher_school");
  if (error) {
    console.error("[pm] pm_get_my_teacher_school failed:", error.message);
    return null;
  }
  const row = firstRows(data)[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const schoolInfoId = asInt(row.school_info_id);
  const schoolName = asText(row.school_name);
  if (schoolInfoId == null || !schoolName) return null;
  return {
    schoolInfoId,
    schoolName,
    region: asText(row.region),
    source: row.source === "manual" ? "manual" : "foreducator",
  };
}

export async function searchSchools(query: string): Promise<SchoolSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_search_schools", {
    p_query: q,
  });
  if (error) {
    console.error("[pm] pm_search_schools failed:", error.message);
    return [];
  }
  return firstRows(data)
    .map((row) => {
      const rec = row as Record<string, unknown>;
      const schoolInfoId = asInt(rec.school_info_id);
      const schoolName = asText(rec.school_name);
      if (schoolInfoId == null || !schoolName) return null;
      return {
        schoolInfoId,
        schoolName,
        region: asText(rec.region),
      };
    })
    .filter((row): row is SchoolSearchHit => row != null);
}

export async function setTeacherSchool(
  schoolInfoId: number,
): Promise<TeacherSchool | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pm_set_teacher_school", {
    p_school_info_id: schoolInfoId,
  });
  if (error) {
    console.error("[pm] pm_set_teacher_school failed:", error.message);
    return { error: "학교를 저장하지 못했어요." };
  }
  const row = firstRows(data)[0] as Record<string, unknown> | undefined;
  const id = asInt(row?.school_info_id);
  const name = asText(row?.school_name);
  if (id == null || !name) return { error: "학교를 저장하지 못했어요." };
  return {
    schoolInfoId: id,
    schoolName: name,
    region: asText(row?.region),
    source: row?.source === "foreducator" ? "foreducator" : "manual",
  };
}

export async function syncTeacherSchoolFromForeducator(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "pm_sync_teacher_school_from_foreducator",
  );
  if (error) {
    console.error(
      "[pm] pm_sync_teacher_school_from_foreducator failed:",
      error.message,
    );
  }
}
