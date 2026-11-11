# QUANTAXIS Atlas · QUANTAXIS 生态图谱

以职责、能力线路与固定源码证据浏览 QUANTAXIS 生态的独立研究网站。包含项目索引、关键历史事件、PDF能力映射，以及结构化数据下载。

[在线浏览](https://quantaxis-atlas.vercel.app/) · [结构化数据](https://quantaxis-atlas.vercel.app/data/atlas.json)

## 本地运行

需要Node.js 22.12或更高版本。

```sh
npm ci
npm run dev
```

构建与预览：

```sh
npm run build
npm run preview
```

## 浏览方式

- 宽屏显示可平移、缩放和自动适应容器的能力图谱。
- 窄窗口和手机默认显示可阅读的线路卡片，也可以切换至画布。
- 点击节点、关系、仓库或历史事件查看职责、实现边界及证据。
- 筛选和详情保存在URL hash中，可以复制当前位置。
- 页首GitHub图标链接到本项目仓库。

## 数据与Agent读取

唯一展示数据为 `public/data/atlas.json`，结构定义为同目录的 `schema.json`。部署后分别可以通过 `/data/atlas.json` 和 `/data/schema.json` 读取。

```sh
node scripts/query.mjs
node scripts/query.mjs --repo qautlra --with-evidence
node scripts/query.mjs --search QAAlphaDB --with-evidence
node scripts/query.mjs --gaps
```

节点、关系、线路和证据有稳定ID；通过 `evidenceIds` 解析引用。请分别理解源码来源、实现程度和接线状态。概念对应不代表运行调用，源码公开不代表运行验收。

## 研究范围

数据基准日为2026-11-11。公开版包含59个节点、64条关系、23个固定仓库、23个关键事件、6条线路、21项能力范围及198项证据记录。194项为公开GitHub源码或元数据引用，4项原始研究材料没有随网站发布，使用 `availability: not_published` 和空链接明确标记。

历史事件用于理解架构变化，不代表所有提交均已审计或每年的完整系统快照。未取得对应源码不等于确定闭源或从未实现。独立项目与同名产品之间的版本对应以每项证据边界为准。

网站只包含可公开的研究摘要与源码引用，不需要账户、数据库、访问令牌或后端服务。未公开原始材料的内容不会通过网站下载。原PDF和其他第三方完整材料不包含在此仓库中。

## 维护与发布

界面使用React、TypeScript、Vite和React Flow。修改 `src/` 调整界面，修改 `public/data/` 更新数据。`npm run build` 会检查TypeScript、跨集合引用、固定源码链接和公开数据边界。

Vercel关联此GitHub仓库后使用Vite预设，构建命令为 `npm run build`，输出目录为 `dist`，生产分支为 `main`。不需要配置环境变量。后续向 `main` 推送提交即可触发关联部署。

推送后，在Vercel部署记录中确认来源分支为 `main`、提交SHA与GitHub最新提交一致且状态为 `Ready`，再打开网站和 `/data/atlas.json` 检查访问结果。

本网站为独立生态研究项目，非QUANTAXIS官方站点。各上游项目、协议和产品名称归原项目所有者；实际使用以对应上游代码、许可证及说明为准。
