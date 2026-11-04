import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, newId } from "@/lib/db";
import { users, teacherSubjects, classes, classMembers, type UserRow } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";
import { isSubject, type Subject } from "@/lib/subjects";

export type PublicUser = {
  id: string;
  username: string;
  role: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  grade: string | null;
  active: boolean;
  subjects?: string[];
  createdAt: number;
  updatedAt: number;
};

function pub(u: UserRow, subjects?: string[]): PublicUser {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    displayName: u.displayName,
    phone: u.phone,
    email: u.email,
    grade: u.grade,
    active: !!u.active,
    subjects,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export type LoginDirectoryItem = {
  username: string;
  displayName: string;
  subjects?: string[];
  grade?: string | null;
};

/** Active teachers/students for login pickers (no secrets). */
export function listLoginDirectory(role: "teacher" | "student"): LoginDirectoryItem[] {
  return listUsersByRole(role)
    .filter((u) => u.active)
    .map((u) => ({
      username: u.username,
      displayName: u.displayName,
      subjects: u.subjects,
      grade: u.grade,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "zh"));
}

export function listUsersByRole(role: "teacher" | "student"): PublicUser[] {
  const db = getDb();
  const rows = db.select().from(users).where(eq(users.role, role)).all();
  if (role !== "teacher") return rows.map((r) => pub(r));
  const subs = db.select().from(teacherSubjects).all();
  const map = new Map<string, string[]>();
  for (const s of subs) {
    const arr = map.get(s.userId) || [];
    arr.push(s.subject);
    map.set(s.userId, arr);
  }
  return rows.map((r) => pub(r, map.get(r.id) || []));
}

export function getUser(id: string): PublicUser | null {
  const db = getDb();
  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) return null;
  if (row.role === "teacher") {
    const subs = db.select().from(teacherSubjects).where(eq(teacherSubjects.userId, id)).all();
    return pub(row, subs.map((s) => s.subject));
  }
  return pub(row);
}

function assertUsername(username: string) {
  const u = username.trim();
  if (!/^[a-zA-Z0-9_\u4e00-\u9fff]{2,32}$/.test(u)) {
    throw new Error("用户名需 2–32 位字母/数字/下划线/中文");
  }
  return u;
}

function assertPassword(password: string) {
  if (String(password || "").length < 6) throw new Error("密码至少 6 位");
  return String(password);
}

export function createTeacher(input: {
  username: string;
  password: string;
  displayName: string;
  phone?: string;
  email?: string;
  subjects: string[];
  active?: boolean;
}) {
  const db = getDb();
  const username = assertUsername(input.username);
  const password = assertPassword(input.password);
  const displayName = (input.displayName || "").trim() || username;
  const subjects = [...new Set((input.subjects || []).filter(isSubject))] as Subject[];
  if (!subjects.length) throw new Error("请至少选择一个学科");

  const exists = db.select().from(users).where(eq(users.username, username)).get();
  if (exists) throw new Error("用户名已存在");

  const now = Date.now();
  const id = newId();
  db.insert(users)
    .values({
      id,
      username,
      passwordHash: hashPassword(password),
      role: "teacher",
      displayName,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      grade: null,
      active: input.active !== false,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  for (const s of subjects) {
    db.insert(teacherSubjects).values({ userId: id, subject: s }).run();
  }
  return getUser(id)!;
}

export function updateTeacher(
  id: string,
  input: {
    displayName?: string;
    phone?: string | null;
    email?: string | null;
    subjects?: string[];
    active?: boolean;
    password?: string;
  },
) {
  const db = getDb();
  const row = db.select().from(users).where(and(eq(users.id, id), eq(users.role, "teacher"))).get();
  if (!row) throw new Error("老师不存在");

  const patch: Partial<UserRow> = { updatedAt: Date.now() };
  if (input.displayName !== undefined) patch.displayName = input.displayName.trim() || row.displayName;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.active !== undefined) patch.active = !!input.active;
  if (input.password) {
    assertPassword(input.password);
    patch.passwordHash = hashPassword(input.password);
  }
  db.update(users).set(patch).where(eq(users.id, id)).run();

  if (input.subjects) {
    const subjects = [...new Set(input.subjects.filter(isSubject))] as Subject[];
    if (!subjects.length) throw new Error("请至少选择一个学科");
    db.delete(teacherSubjects).where(eq(teacherSubjects.userId, id)).run();
    for (const s of subjects) {
      db.insert(teacherSubjects).values({ userId: id, subject: s }).run();
    }
  }
  return getUser(id)!;
}

export function deleteTeacher(id: string) {
  const db = getDb();
  const row = db.select().from(users).where(and(eq(users.id, id), eq(users.role, "teacher"))).get();
  if (!row) throw new Error("老师不存在");
  const used = db.select().from(classes).where(eq(classes.teacherId, id)).all();
  if (used.length) throw new Error("该老师仍有小班，请先删除或改派小班");
  db.delete(teacherSubjects).where(eq(teacherSubjects.userId, id)).run();
  db.delete(users).where(eq(users.id, id)).run();
  return true;
}

export function createStudent(input: {
  username: string;
  password: string;
  displayName: string;
  phone?: string;
  email?: string;
  grade?: string;
  active?: boolean;
}) {
  const db = getDb();
  const username = assertUsername(input.username);
  const password = assertPassword(input.password);
  const displayName = (input.displayName || "").trim() || username;
  const exists = db.select().from(users).where(eq(users.username, username)).get();
  if (exists) throw new Error("用户名已存在");
  const now = Date.now();
  const id = newId();
  db.insert(users)
    .values({
      id,
      username,
      passwordHash: hashPassword(password),
      role: "student",
      displayName,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      grade: input.grade?.trim() || null,
      active: input.active !== false,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getUser(id)!;
}

export function updateStudent(
  id: string,
  input: {
    displayName?: string;
    phone?: string | null;
    email?: string | null;
    grade?: string | null;
    active?: boolean;
    password?: string;
  },
) {
  const db = getDb();
  const row = db.select().from(users).where(and(eq(users.id, id), eq(users.role, "student"))).get();
  if (!row) throw new Error("学生不存在");
  const patch: Partial<UserRow> = { updatedAt: Date.now() };
  if (input.displayName !== undefined) patch.displayName = input.displayName.trim() || row.displayName;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.grade !== undefined) patch.grade = input.grade?.trim() || null;
  if (input.active !== undefined) patch.active = !!input.active;
  if (input.password) {
    assertPassword(input.password);
    patch.passwordHash = hashPassword(input.password);
  }
  db.update(users).set(patch).where(eq(users.id, id)).run();
  return getUser(id)!;
}

export function deleteStudent(id: string) {
  const db = getDb();
  const row = db.select().from(users).where(and(eq(users.id, id), eq(users.role, "student"))).get();
  if (!row) throw new Error("学生不存在");
  db.delete(classMembers).where(eq(classMembers.studentId, id)).run();
  db.delete(users).where(eq(users.id, id)).run();
  return true;
}

export type ClassDetail = {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  note: string | null;
  students: { id: string; username: string; displayName: string; grade: string | null }[];
  createdAt: number;
  updatedAt: number;
};

export function listClasses(filter?: { teacherId?: string; studentId?: string }): ClassDetail[] {
  const db = getDb();
  let rows = db.select().from(classes).all();
  if (filter?.teacherId) rows = rows.filter((c) => c.teacherId === filter.teacherId);
  if (filter?.studentId) {
    const mine = db
      .select()
      .from(classMembers)
      .where(eq(classMembers.studentId, filter.studentId))
      .all()
      .map((m) => m.classId);
    const set = new Set(mine);
    rows = rows.filter((c) => set.has(c.id));
  }
  return rows.map((c) => classDetail(c.id)!).filter(Boolean) as ClassDetail[];
}

export function classDetail(id: string): ClassDetail | null {
  const db = getDb();
  const c = db.select().from(classes).where(eq(classes.id, id)).get();
  if (!c) return null;
  const teacher = db.select().from(users).where(eq(users.id, c.teacherId)).get();
  const memberIds = db.select().from(classMembers).where(eq(classMembers.classId, id)).all().map((m) => m.studentId);
  const students =
    memberIds.length === 0
      ? []
      : db
          .select()
          .from(users)
          .where(inArray(users.id, memberIds))
          .all()
          .map((s) => ({
            id: s.id,
            username: s.username,
            displayName: s.displayName,
            grade: s.grade,
          }));
  return {
    id: c.id,
    name: c.name,
    teacherId: c.teacherId,
    teacherName: teacher?.displayName || "",
    subject: c.subject,
    note: c.note,
    students,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function createClass(input: {
  name: string;
  teacherId: string;
  subject: string;
  note?: string;
  studentIds?: string[];
}) {
  const db = getDb();
  const name = (input.name || "").trim();
  if (!name) throw new Error("请填写小班名称");
  if (!isSubject(input.subject)) throw new Error("学科无效");
  const teacher = db
    .select()
    .from(users)
    .where(and(eq(users.id, input.teacherId), eq(users.role, "teacher")))
    .get();
  if (!teacher || !teacher.active) throw new Error("老师不存在或已停用");
  const tSubs = db
    .select()
    .from(teacherSubjects)
    .where(eq(teacherSubjects.userId, teacher.id))
    .all()
    .map((s) => s.subject);
  if (!tSubs.includes(input.subject)) throw new Error("该老师未设置此学科");

  const studentIds = [...new Set(input.studentIds || [])];
  if (studentIds.length < 1) throw new Error("小班至少 1 名学生");
  if (studentIds.length > 5) throw new Error("小班最多 5 名学生");
  for (const sid of studentIds) {
    const s = db.select().from(users).where(and(eq(users.id, sid), eq(users.role, "student"))).get();
    if (!s) throw new Error("学生不存在");
  }

  const now = Date.now();
  const id = newId();
  db.insert(classes)
    .values({
      id,
      name,
      teacherId: teacher.id,
      subject: input.subject,
      note: input.note?.trim() || null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  for (const sid of studentIds) {
    db.insert(classMembers).values({ classId: id, studentId: sid }).run();
  }
  return classDetail(id)!;
}

export function updateClass(
  id: string,
  input: {
    name?: string;
    teacherId?: string;
    subject?: string;
    note?: string | null;
    studentIds?: string[];
  },
) {
  const db = getDb();
  const cur = db.select().from(classes).where(eq(classes.id, id)).get();
  if (!cur) throw new Error("小班不存在");

  const teacherId = input.teacherId || cur.teacherId;
  const subject = input.subject || cur.subject;
  if (!isSubject(subject)) throw new Error("学科无效");
  const teacher = db
    .select()
    .from(users)
    .where(and(eq(users.id, teacherId), eq(users.role, "teacher")))
    .get();
  if (!teacher) throw new Error("老师不存在");
  const tSubs = db
    .select()
    .from(teacherSubjects)
    .where(eq(teacherSubjects.userId, teacher.id))
    .all()
    .map((s) => s.subject);
  if (!tSubs.includes(subject)) throw new Error("该老师未设置此学科");

  if (input.studentIds) {
    const studentIds = [...new Set(input.studentIds)];
    if (studentIds.length < 1) throw new Error("小班至少 1 名学生");
    if (studentIds.length > 5) throw new Error("小班最多 5 名学生");
    for (const sid of studentIds) {
      const s = db.select().from(users).where(and(eq(users.id, sid), eq(users.role, "student"))).get();
      if (!s) throw new Error("学生不存在");
    }
    db.delete(classMembers).where(eq(classMembers.classId, id)).run();
    for (const sid of studentIds) {
      db.insert(classMembers).values({ classId: id, studentId: sid }).run();
    }
  }

  db.update(classes)
    .set({
      name: input.name !== undefined ? input.name.trim() || cur.name : cur.name,
      teacherId,
      subject,
      note: input.note !== undefined ? input.note?.trim() || null : cur.note,
      updatedAt: Date.now(),
    })
    .where(eq(classes.id, id))
    .run();
  return classDetail(id)!;
}

export function deleteClass(id: string) {
  const db = getDb();
  const cur = db.select().from(classes).where(eq(classes.id, id)).get();
  if (!cur) throw new Error("小班不存在");
  db.delete(classMembers).where(eq(classMembers.classId, id)).run();
  db.delete(classes).where(eq(classes.id, id)).run();
  return true;
}

export function addStudentToClass(classId: string, studentId: string) {
  const detail = classDetail(classId);
  if (!detail) throw new Error("小班不存在");
  if (detail.students.some((s) => s.id === studentId)) return detail;
  if (detail.students.length >= 5) throw new Error("小班最多 5 名学生");
  const db = getDb();
  const s = db.select().from(users).where(and(eq(users.id, studentId), eq(users.role, "student"))).get();
  if (!s) throw new Error("学生不存在");
  db.insert(classMembers).values({ classId, studentId }).run();
  db.update(classes).set({ updatedAt: Date.now() }).where(eq(classes.id, classId)).run();
  return classDetail(classId)!;
}

export function removeStudentFromClass(classId: string, studentId: string) {
  const detail = classDetail(classId);
  if (!detail) throw new Error("小班不存在");
  if (detail.students.length <= 1) throw new Error("小班至少保留 1 名学生");
  const db = getDb();
  db.delete(classMembers)
    .where(and(eq(classMembers.classId, classId), eq(classMembers.studentId, studentId)))
    .run();
  db.update(classes).set({ updatedAt: Date.now() }).where(eq(classes.id, classId)).run();
  return classDetail(classId)!;
}

export function teacherSubjectsOf(teacherId: string): string[] {
  const db = getDb();
  return db
    .select()
    .from(teacherSubjects)
    .where(eq(teacherSubjects.userId, teacherId))
    .all()
    .map((s) => s.subject);
}
