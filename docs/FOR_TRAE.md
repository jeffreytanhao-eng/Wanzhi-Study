# 万智学习 · 给 Trae 的项目说明

> 更新日期：2026-11-05（Asia/Shanghai）  
> 仓库：https://github.com/jeffreytanhao-eng/Wanzhi-Study  
> 本地目录（BF 机）：`C:\项目\万智`  
> 生产站：https://wanzhixuexi.cn  
> 写文档时 `main` HEAD：`296ac2b`（Gate exam code behind student ID on homepage）

本文面向在本地打开本仓库的 Trae（或其他 AI IDE）。先读本文，再改代码。事实以仓库代码为准；密钥与 `data/` 永不提交。

---

## 1. 产品定位

| 项 | 内容 |
| --- | --- |
| 名称 | **万智学习 · 智能阅卷** |
| 域名 | https://wanzhixuexi.cn |
| 双模式 | **考试**（限时答题 → 自动评分/解析）与 **课件**（知识点 + 练习，可展示答案） |
| 主流程 | Word/PDF 等上传 → AI 解析题目/知识点 → 发布 → 6 位码或学生后台进入 → 提交与结果页 |
| 部署策略 | **不以 Vercel 为主**；生产在**阿里云香港** Node 进程 + nginx + Let’s Encrypt |

用户称呼：**Jeffrey**。UI 文案：**中文**。

---

## 2. 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js **App Router**（`next@16.4.x`）+ React 19 + TypeScript |
| 样式 | Tailwind CSS 4（`@tailwindcss/turbopack`，见 `next.config.ts`） |
| 试卷/课件/答卷 | **JSON 文件**，根目录由 `DATA_DIR` 决定（默认 `./data`） |
| 用户 / 小班 | **SQLite** + drizzle-orm + better-sqlite3 → `$DATA_DIR/wanzhi.sqlite` |
| AI | OpenAI 兼容接口；生产常用**火山引擎 Ark**（`AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL`） |
| Markdown/公式 | `react-markdown` + remark-math + rehype-katex（组件 `components/Md.tsx`） |
| Word | `mammoth` / `word-extractor`（`lib/word.ts`） |
| Session | Cookie 名 **`wanzhi_session`**（HMAC，密钥 `APP_SECRET`） |
| 运行时 | 生产需 **Node 22**（native `better-sqlite3`）；`serverExternalPackages: ["better-sqlite3"]` |

本地常用：

```bash
npm install
npm run dev          # 开发
npm run build && npm start
# 或 ./start-local.sh（见 start-local.sh）
```

---

## 3. 角色与入口

| 角色 | 入口 | 能力 |
| --- | --- | --- |
| 超级校长 | `/principal`（首页有入口） | CRUD 老师/学生；小班（**1 师 + 1～5 生**）；改自己密码 |
| 老师 | 首页 **AccountPicker 选/输账号 + 密码** → `/teacher`；试卷编辑 `/teacher/exam/[id]` | 上传考试/课件、AI 解析或手工录入、发布得 6 位码、看小班与提交 |
| 学生 | 首页填**学号 + 密码** → `/student`；或**先填学号再填考试码** → `/s/[code]?sid=` | 看所属小班与老师已发布内容；答题 |
| 访客码 | `/s/[code]` | 凭 6 位码进考试/课件；结果页 `/r/[sid]` |
| 遗留 | 旧共享教师口令 `TEACHER_PASSCODE` / cookie `teacher_auth` | **已停用网关作用**；个人账号密码为准（见 `lib/auth.ts`） |

首页规则（`app/page.tsx`，约 commit `296ac2b`）：

- 老师：下拉/搜索选账号再填密码 → `POST /api/teacher/login`
- 学生：学号（AccountPicker）+ 密码 → `POST /api/auth/login`，且校验 `role === "student"`
- **考试/课件码输入框在学号为空时 disabled**；提交跳转 `/s/{CODE}?sid={学号}`

校长默认用户名：`principal`。首次建库密码见服务器 `$DATA_DIR/principal_bootstrap.json`，或环境变量 `PRINCIPAL_BOOTSTRAP_PASSWORD`；**勿把该密码写进文档或 Git**。登录后应由校长改密。老师/学生账号由校长在 `/principal` 创建（无写死的 `t_math` 等演示账号进仓库）。

---

## 4. 目录地图（关键路径）

```
exam-grader/   （GitHub 仓库名 Wanzhi-Study；本地常称「万智」）
├── app/
│   ├── page.tsx                 # 首页：校长入口 + 老师/学生登录 + 考试码（需先学号）
│   ├── layout.tsx / globals.css
│   ├── principal/page.tsx       # 校长后台
│   ├── teacher/page.tsx         # 老师列表/上传/小班
│   ├── teacher/exam/[id]/page.tsx
│   ├── student/page.tsx         # 学生仪表盘（小班 + materials）
│   ├── s/[code]/page.tsx        # 公开答题
│   ├── r/[sid]/page.tsx         # 提交结果 / 解析
│   └── api/
│       ├── auth/{login,logout,me,password}/
│       ├── teacher/{login,logout,password,classes}/
│       ├── principal/{teachers,students,classes}/...
│       ├── student/dashboard/
│       ├── public/{directory,[code], [code]/start}/
│       ├── exams/ … /from-upload /[id]/solutions|submissions|source
│       ├── parse/               # AI 解析上传（老师/校长）
│       ├── submissions/[sid]/
│       └── figures/[examId]/[name]/
├── components/
│   ├── AccountPicker.tsx        # 老师/学生公开目录选择
│   └── Md.tsx                   # Markdown + KaTeX
├── lib/
│   ├── store.ts                 # DATA_DIR JSON KV + files/
│   ├── exams.ts                 # exam/code/sub CRUD、AI 解答管线
│   ├── exam-access.ts           # 老师只能看自己的 + 无 owner 的遗留卷
│   ├── db/index.ts + schema.ts  # SQLite 初始化与表
│   ├── accounts.ts              # 用户/小班业务
│   ├── auth.ts                  # session cookie
│   ├── password.ts / subjects.ts / types.ts
│   ├── ai.ts                    # 解析试卷/课件、解题
│   ├── word.ts / grade.ts
├── data/                        # 本地运行时数据（Git 忽略）
├── MULTIUSER.md                 # 多用户短说明
├── PROJECT.md                   # 根目录指针（链到本文）
└── docs/FOR_TRAE.md             # 本文
```

### 数据流（简图）

1. **账号**：校长 API → SQLite `users` / `teacher_subjects` / `classes` / `class_members`
2. **登录**：密码校验 → 签发 `wanzhi_session`
3. **内容**：上传 → `DATA_DIR/files/{examId}/` + `exam_{id}.json`；索引 `exams.json`、`code_{CODE}.json`
4. **公开答卷**：`POST /api/public/[code]/start` → `sub_*.json`；交卷评分 → `/r/[sid]`
5. **学生仪表盘**：小班老师 ID 集合 ∩ `status=published` 的卷（含无 `ownerTeacherId` 的旧共享卷）

---

## 5. 数据与配置

### DATA_DIR

| 环境 | 典型路径 |
| --- | --- |
| 本地默认 | `./data`（相对项目根） |
| 生产 | `/opt/wanzhi/data`（以服务器实际 env 为准） |

重要文件/键：

| 路径或键 | 用途 |
| --- | --- |
| `wanzhi.sqlite` | 用户与小班 |
| `principal_bootstrap.json` | 仅首次校长密码提示（敏感，勿提交） |
| `exams.json` | 试卷 id 列表 |
| `exam_{id}.json` / `code_{CODE}.json` | 试卷本体 / 码→id |
| `sub_{sid}.json` / `subs_{examId}.json` | 答卷 |
| `files/{examId}/` | 原始上传与配图 |

`Exam.ownerTeacherId`：创建者老师 id；`null`/缺省 = **遗留共享卷**（所有老师可见可改）。

### 环境变量（`.env.local`，已在 `.gitignore`）

| 变量 | 作用 |
| --- | --- |
| `APP_SECRET` | Session HMAC |
| `DATA_DIR` | 数据根目录 |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | 主 AI；可选 `AI_SOLVE_MODEL`、`AI_WEB_SEARCH` |
| 备选 | `OPENAI_API_KEY` / `XAI_API_KEY` / `DEEPSEEK_API_KEY` / `DASHSCOPE_API_KEY` |
| `PRINCIPAL_BOOTSTRAP_PASSWORD` | 可选，首次建校长账号 |
| `TEACHER_PASSCODE` | **遗留**；新流程不依赖它做鉴权 |

仓库内**没有** `.env.local.example`；参考 `README.md`「本地运行」一节与上表。  
**切勿**把真实 Key、校长初始密码、`.env.local`、`data/` 提交到 Git。

### Git 不同步

`.env*`、`/data`、`node_modules`、`.next`、`/logs`、部分 `samples/*.docx`（见 `.gitignore`）。

---

## 6. 线上与仓库现状

| 项 | 现状 |
| --- | --- |
| GitHub | https://github.com/jeffreytanhao-eng/Wanzhi-Study · 默认分支 `main` |
| 生产机 | 阿里云 `47.82.118.133`；应用目录常为 `/opt/wanzhi`；systemd 服务名常为 `wanzhi`；nginx + LE → `wanzhixuexi.cn` |
| 本地开发 | BF 机 `C:\项目\万智`（与 GitHub 应对齐） |
| 近期提交 | `4eb5540` 多用户 SQLite + 校长/老师/学生 UI → `a83aeac` 首页账号登录 → `296ac2b` 考试码须先填学号 |

推 GitHub **不会**自动上线；需另外部署到阿里云。部署后若首页仍旧，清生产 `.next` 下 **server/route-cache**（或等价缓存）再重启，避免旧 RSC 首页。

---

## 7. 已知缺口 / 注意

- **按小班精确布置试卷**尚未产品化：学生侧大致是「所属小班老师的已发布内容 + 无 owner 的遗留卷」（见 `app/api/student/dashboard/route.ts` 与学生页文案），不是「只发给某小班」。
- 几何「如图」题：优先保留/引用**原图**；乱格式 Word 易解析差；图质量仍需人工盯。
- **不要以 Vercel 为主部署**（README 模板段落可忽略；产品决策是阿里云自托管）。
- AMC 等历史 PDF/样本是否在本机 `samples/` 或 `data/files`，视同步情况而定，非仓库必有内容。
- Next 16 与训练数据可能不一致：改框架 API 前先看本仓库 `node_modules/next` 与 `AGENTS.md` 提示。

---

## 8. Trae 协作约定

1. **改 UI/业务**：优先 `app/`、`components/`；持久化分清  
   - JSON store（试卷、码、答卷、二进制）→ `lib/store.ts` / `lib/exams.ts`  
   - SQLite 账号小班 → `lib/db/*` / `lib/accounts.ts`
2. 鉴权统一走 `lib/auth.ts` 的 `requireUser` / `getSessionUser`；老师侧接口允许 `teacher` 与部分 `principal`。
3. 中文 UI；对用户称 **Jeffrey**。
4. 提交前本地跑通：`npm run build`。
5. 推送 GitHub 后提醒：需**部署阿里云**才反映到 https://wanzhixuexi.cn 。
6. **禁止**：提交密钥、删除或清空生产/本地 `data/`、把校长 bootstrap 密码写进文档。
7. 小班约束写死在 `lib/accounts.ts`：1～5 名学生；删老师前须先处理其小班。

### 建议改动检查清单

- [ ] 不动无关的 `.env` / `data`
- [ ] 新 API 调用 `initDb()`（若碰账号）并校验角色
- [ ] 试卷列表用 `filterExamsForUser` / `canMutateExam`
- [ ] `npm run build` 通过后再 commit

---

## 9. 快速对照：类型与模式

见 `lib/types.ts`：

- `ContentKind`: `exam` | `courseware`
- `QType`: `single` | `multiple` | `fill` | `short`
- 课件题可有 `role`（典例/即学即练/习题）、`difficulty`、`knowledgePoints`

学科枚举：`lib/subjects.ts`（语文、数学、英语…）。

---

有歧义时：以当前 `main` 代码与生产行为为准，并更新本文对应小节。
