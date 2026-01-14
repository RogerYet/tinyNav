# AppleBar（Apple-like 个人导航站）

本项目是一个 **Cloudflare Workers（静态站 + API 一体）** 的导航站：
- 前端：Vite 构建输出到 `dist/`
- 后端：Worker 入口 `src/worker.ts`，API 路由保持 `/api/...`
- 存储：Durable Object（单实例，`state.storage` 持久化 `cloudnav:data`）

## 技术栈

- Vite + React + TypeScript（输出：`dist/`）
- TailwindCSS（glass / vibrancy + 深色模式）
- Framer Motion（克制动效 + 尊重 `prefers-reduced-motion`）
- Cloudflare Workers（托管静态资源 + API）
- Durable Objects（不依赖 KV 绑定）

## 本地开发

```bash
npm i
npm run dev
```

`npm run dev` 只跑前端（Vite）。要本地同时跑 Worker（静态 + API + DO）：

```bash
npm run dev:worker
```

`.dev.vars`（不要提交）示例：

```ini
PASSWORD=admin
SESSION_SECRET=your_long_random_secret
```

## 部署（CI / Cloudflare 构建环境）

本仓库默认兼容如下流水线：
- Build command：`npm run build`
- Deploy command：`npx wrangler deploy`

需要的环境变量：
- `PASSWORD`（必填）：管理密码  
  - 如果未配置：所有 `/api/admin/*` 写接口会返回 `503` 并提示缺少 PASSWORD（不会给默认密码，避免后台暴露）
  - 公开接口 `/api/links` 仍可读（返回初始化数据结构）
- `SESSION_SECRET`（可选）：建议配置；不配则从 `PASSWORD` 派生

## API

- `GET /api/links`（公开，可缓存）：返回 `{ settings, groups, sections, links }`
- `GET /api/me`：`{ authed: boolean }`
- `POST /api/login`：`{ password }`，成功后写入 HttpOnly cookie（默认 7 天）
- `POST /api/logout`：清 cookie
- 管理端（必须登录，否则 401）：
  - `POST /api/admin/groups`
  - `PUT /api/admin/groups/:id`
  - `DELETE /api/admin/groups/:id`
  - `POST /api/admin/sections`
  - `PUT /api/admin/sections/:id`
  - `DELETE /api/admin/sections/:id`
  - `POST /api/admin/links`
  - `PUT /api/admin/links/:id`
  - `DELETE /api/admin/links/:id`
  - `POST /api/admin/reorder`
  - `GET /api/admin/settings`
  - `PUT /api/admin/settings`
  - 兼容旧接口（不推荐）：`POST /api/admin/save`

## 存储结构（Durable Object）

DO 中保存单 key：`cloudnav:data`：

```json
{
  "settings": {
    "siteTitle": "AppleBar",
    "siteSubtitle": "个人导航",
    "homeTagline": "轻盈、克制、随手可用。",
    "siteIconDataUrl": "",
    "faviconDataUrl": "",
    "siteIconFit": "contain"
  },
  "groups": [],
  "sections": [],
  "links": []
}
```

