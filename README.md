# AppleBar（Apple-like 个人导航站）

Cloudflare Pages + Pages Functions + Workers KV + 环境变量 `PASSWORD` 的“CloudNav-abcd”同款部署思路。

## 技术栈

- Vite + React + TypeScript（构建输出：`dist`）
- TailwindCSS（Apple-like tokens + 毛玻璃）
- Framer Motion（克制动效，尊重 reduced-motion）
- Cloudflare Pages Functions（放在项目根目录 `/functions`）
- Workers KV（数据存储）

## 本地开发

```bash
npm i
npm run dev
```

> `npm run dev` 只启动前端（Vite）。要在本地同时跑 Functions，请用 `wrangler pages dev`：

```bash
npm run build
# 推荐用 .dev.vars 提供 PASSWORD / SESSION_SECRET
npx wrangler pages dev dist
```

如果 `.dev.vars` 未生效，可显式注入（示例）：
```bash
npx wrangler pages dev dist -b PASSWORD=admin -b SESSION_SECRET=daiyi114514
```

创建 `.dev.vars`（不会提交到线上）：

```ini
PASSWORD=your_admin_password
SESSION_SECRET=your_long_random_secret
```

## Cloudflare Pages 部署（必须按这个做）

1. 把仓库推到 Git（GitHub/GitLab）。
2. Cloudflare 控制台 -> **Pages** -> Create a project -> 连接 Git 仓库。
3. Build settings：
   - Framework preset: **None**
   - Build command: `npm run build`
   - Output directory: `dist`
4. 创建 Workers KV：
   - Cloudflare 控制台 -> **Workers & Pages** -> **KV** -> Create namespace
   - 命名空间名称：`CLOUDNAV_DB`
5. 绑定 KV 到 Pages：
   - Pages 项目 -> Settings -> Bindings -> Add binding -> **KV namespace**
   - Variable name：`CLOUDNAV_KV`
   - KV namespace：选择 `CLOUDNAV_DB`
6. 配置环境变量：
   - Pages 项目 -> Settings -> Environment variables
   - 添加 `PASSWORD`（管理密码，必填）
   - 添加 `SESSION_SECRET`（推荐：随机长字符串；若不提供，会从 `PASSWORD` 派生 session 签名 secret）
7. 部署完成后访问：
   - 公共页：`/`
   - 登录：`/login`
   - 后台：`/admin`

## API

- `GET /api/links`：公开，返回 `{ groups, links }`（允许缓存）
- `GET /api/me`：返回 `{ authed: boolean }`
- `POST /api/login`：`{ password }`，成功后写入 HttpOnly cookie（默认 7 天）
- `POST /api/logout`：清 cookie
- 管理端（需要登录，否则 401）：
  - `POST /api/admin/groups`
  - `PUT /api/admin/groups/:id`
  - `DELETE /api/admin/groups/:id`
  - `POST /api/admin/links`
  - `PUT /api/admin/links/:id`
  - `DELETE /api/admin/links/:id`
  - `POST /api/admin/reorder`
- `POST /api/admin/save`：旧接口（保留兼容，后台已切到增量 API）

## KV 数据结构

- KV key：`cloudnav:data`
- 数据结构：

```json
{
  "groups": [{ "id": "g1", "name": "开发", "order": 0 }],
  "links": [
    {
      "id": "l1",
      "groupId": "g1",
      "title": "Cloudflare",
      "url": "https://...",
      "icon": "",
      "description": "",
      "order": 0
    }
  ]
}
```

## 说明

- `PASSWORD` 只存在于服务端环境变量，不会出现在前端代码中。
- Session 使用 WebCrypto `HMAC-SHA256` 对 payload 签名；推荐设置 `SESSION_SECRET`，避免 `PASSWORD` 变更导致所有 session 失效。
- 登录失败会基于 IP 做简单延迟与计数（KV，10 分钟窗口）。
- `public/_redirects` 用于 SPA 路由回退（保证 `/login`、`/admin` 刷新不 404）。
- 调试：本地可访问 `GET /api/debug/env` 查看变量是否注入（生产环境禁用）。
- favicon：可选设置环境变量 `USE_FAVICON_SERVICE=true`，服务端会把链接的 `icon` 设为 Google favicon 服务（更稳）；默认使用 `${origin}/favicon.ico`。
