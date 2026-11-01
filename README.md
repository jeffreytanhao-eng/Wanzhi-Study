This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 本地运行（不依赖 Vercel）
- 数据：本地 JSON 文件，目录 `DATA_DIR`（默认 `./data`）。
- 配置：`.env.local` —— `TEACHER_PASSCODE`（教师口令）、`APP_SECRET`、`DATA_DIR`。
- AI（可选，OpenAI 兼容接口）：在 `.env.local` 设置 `AI_API_KEY` + `AI_BASE_URL` + `AI_MODEL`，
  或直接设置 `OPENAI_API_KEY` / `XAI_API_KEY` / `DEEPSEEK_API_KEY` / `DASHSCOPE_API_KEY` 之一。
  使用 OpenAI 官方接口时自动启用 web_search 联网搜索解答。修改后需重启服务。
- 构建与启动：`npm run build && setsid nohup ./start-local.sh > logs/server.log 2>&1 &`（端口 3000）
