import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // principal | teacher | student
  displayName: text("display_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  grade: text("grade"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const teacherSubjects = sqliteTable(
  "teacher_subjects",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.subject] })],
);

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  teacherId: text("teacher_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  subject: text("subject").notNull(),
  note: text("note"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const classMembers = sqliteTable(
  "class_members",
  {
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.classId, t.studentId] })],
);

export type UserRow = typeof users.$inferSelect;
export type ClassRow = typeof classes.$inferSelect;
