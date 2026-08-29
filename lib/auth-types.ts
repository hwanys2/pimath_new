export type DisplayUser = {
  id: string;
  email: string | null;
  name: string;
};

export type TeacherActor = {
  type: "teacher";
  id: string;
  email: string | null;
  name: string;
};

export type StudentActor = {
  type: "student";
  id: string;
  name: string;
  loginId: string;
  classId: string;
  className: string;
  teacherId: string;
  level: number;
  totalXp: number;
  activeAvatar: string;
};

export type Actor = TeacherActor | StudentActor;
