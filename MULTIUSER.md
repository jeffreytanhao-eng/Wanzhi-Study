# 多老师 / 多学生 / 小班

- SQLite：`$DATA_DIR/wanzhi.sqlite`
- 校长默认用户名：`principal`（首次密码见 `data/principal_bootstrap.json` 或环境变量 `PRINCIPAL_BOOTSTRAP_PASSWORD`）
- 入口：`/principal` `/teacher` `/student`；访客码 `/s/[code]` 仍可用
- 老师登录改为用户名+密码；新建试卷会写入 `ownerTeacherId`
