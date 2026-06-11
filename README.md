# World Cup Bet

2026 世界杯情侣竞猜账本。前端使用 Next.js 静态导出并部署到 GitHub Pages，登录、下注、赛果和结算数据存储在 InsForge，赛后同步由 GitHub Actions 调用 API-Football 完成。

## Local Setup

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev
```

未配置 InsForge 时，页面会使用示例数据，方便先预览 UI。

## InsForge Setup

本项目已链接到 InsForge 项目 `world-cup`。本地链接配置在 `.insforge/project.json`，不会提交到 Git。

Schema 已通过 InsForge CLI 导入：

```bash
npx @insforge/cli db import insforge/001_initial_schema.sql
```

后续如需重新导入或迁移，请优先使用 InsForge CLI：

```bash
npx @insforge/cli current
npx @insforge/cli db tables
npx @insforge/cli db query "select count(*) from matches;"
```

## Auth Users

在 InsForge Dashboard 中创建你和女朋友两个 email/password 用户，然后把两个用户 ID 插入 `players` 表：

```sql
insert into players (user_id, code, display_name, avatar_color)
values
  ('USER_ID_A', 'player_a', '我', '#0f8a5f'),
  ('USER_ID_B', 'player_b', '女朋友', '#ff6b5f');
```

如果你希望我代做，告诉我两个登录邮箱和显示名称即可；密码请你自己在 Dashboard 设置。

## Environment Variables

本地 `.env.local`：

```text
NEXT_PUBLIC_INSFORGE_URL=https://5t7npezs.ap-southeast.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=your_anon_key
NEXT_PUBLIC_BASE_PATH=
INSFORGE_API_KEY=server_only_api_key
API_FOOTBALL_KEY=your_api_football_key
```

获取 anon key：

```bash
npx @insforge/cli secrets get ANON_KEY
```

`INSFORGE_API_KEY` 是 admin key，只能放本地 server env 或 GitHub Secrets，不能写到前端代码里。

## GitHub Pages

新建公开仓库后，把这些 secrets 加到 GitHub Actions：

- `NEXT_PUBLIC_INSFORGE_URL`
- `NEXT_PUBLIC_INSFORGE_ANON_KEY`
- `INSFORGE_API_KEY`
- `API_FOOTBALL_KEY`
- `NEXT_PUBLIC_BASE_PATH`

如果仓库名是 `world-cup-bet`，`NEXT_PUBLIC_BASE_PATH` 通常填 `/world-cup-bet`。如果部署到用户主页根路径，可留空。

在仓库 Settings -> Pages 中选择 GitHub Actions 作为发布来源。推送到 `main` 或 `master` 后会自动构建并发布 `out/`。

## Result Sync

`sync-results.yml` 每 2 小时运行一次，也可以手动触发。脚本会：

- 拉取 API-Football 的 `fixtures?league=1&season=2026`。
- 写入或更新 `matches`。
- 对已完赛且双方已下注的比赛生成 `settlements`。
- 在 `sync_runs` 记录成功或失败。

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run sync:results
```

`sync:results` 需要设置 `NEXT_PUBLIC_INSFORGE_URL`、`INSFORGE_API_KEY` 和 `API_FOOTBALL_KEY`。
