import "server-only";
import type { SessionUser } from "@/lib/auth";
import type { Exam } from "@/lib/types";

/** Principal sees all; teacher sees own + legacy (no owner). */
export function canViewExam(user: SessionUser, exam: Exam) {
  if (user.role === "principal") return true;
  if (user.role !== "teacher") return false;
  if (!exam.ownerTeacherId) return true;
  return exam.ownerTeacherId === user.id;
}

export function canMutateExam(user: SessionUser, exam: Exam) {
  if (user.role === "principal") return true;
  if (user.role !== "teacher") return false;
  if (!exam.ownerTeacherId) return true;
  return exam.ownerTeacherId === user.id;
}

export function filterExamsForUser(user: SessionUser, exams: Exam[]) {
  if (user.role === "principal") return exams;
  if (user.role === "teacher") {
    return exams.filter((e) => !e.ownerTeacherId || e.ownerTeacherId === user.id);
  }
  return [];
}
