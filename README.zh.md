# perse-remote-dev — DSH 的远端开发工作台

**perse-remote-dev** 是 DSH 的远端开发插件：盘点主机与链路状态、通过 ssh 浏览与创建
目录、打开带 token URL 的远端 DSH 隧道、打开远端项目，并在浏览器里驱动 **rd-core**
批次审阅链（审阅 → 应用 → 拒绝 → 回滚）。

属于 **Persevere with DSH** 插件合集，短称 **perse**（`` `perse` = persevere ``，即"坚持"）。

---

## 它做什么

| 能力 | 保证 |
|------|------|
| **主机盘点与链路状态** | 列出已配置主机、读取与更新生效配置，并报告单台主机的可达性/链路状态。 |
| **ssh 目录浏览与建目录** | 通过已配置的 ssh 连接列出远端目录、创建目录——不使用自有的裸 HTTP 路由。 |
| **远端 DSH 隧道与 token URL** | 打开通往远端 DSH 的隧道并返回可达的 token URL，列出活动隧道，按需关闭其中一条。 |
| **远端项目打开** | 在远端打开项目，并把选择记录到 `remote-dev` settings 命名空间。 |
| **rd-core 批次审阅** | 读取批次状态、取批、应用已批准文件、带评论拒绝文件、回滚到已批准的基线 ref。 |

宿主侧注册 `remoteDev` 类型化 Remote 命名空间——共 15 个方法：
`listTargets`、`readConfiguration`、`updateConfiguration`、`describe`、
`listDirectory`、`createDirectory`、`openTunnel`、`listTunnels`、`closeTunnel`、
`openProject`、`reviewStatus`、`reviewBatch`、`reviewApply`、`reviewReject`、
`reviewRollback`。浏览器侧把它渲染到会话、设置、侧边栏与布局槽位。

## 安装

先构建并打包——插件通过 tarball 安装，**不要**用目录 link：

```sh
npm install        # 构建工具（TypeScript、tsdown、Typert 生成器）
npm run pack       # 构建 + `npm pack --workspace perse-remote-dev`
                   # npm 会打印生成的 tarball 路径

dsh plugin --profile web add <npm 打印的 tarball 路径>
```

> **不要**用目录路径安装（`dsh plugin --profile web add ./`）。加载器按包名解析，
> 并要求生成的 Typert 工件（`lib/typert.host.js`、`lib/typert.remote-client.js`）
> 与编译入口相邻。目录 link 不提供该布局，插件会加载失败。

## 开发

```sh
npm run typecheck          # tsc -b tsconfig.host.json（输出 lib/types）
npm run codegen            # 由带注解源码重新生成 lib/typert.*
npm run bundle             # tsdown -> lib/index.js（宿主半边）
npm run bundle:client      # tsdown --config tsdown.client.config.ts -> client.js
npm test                   # 先构建，再跑 verify-generated + verify-client-bundle + verify-host-surface
```

`@deepseek-ai/cordis`、`@deepseek-ai/dsh-typert-protocol` 与
`@deepseek-ai/schemastery` 故意不打包：这三个 peer 由宿主提供，使 Remote 层与
settings 接缝共享同一模块实例——第二份拷贝会静默禁用 Remote 层。`zod` 同样保持
裸说明符，但它是本包的真依赖而非 peer：宿主侧解析与它同级安装的那份，浏览器
bundle 则内联一份私有副本。

## 驱动 Remote API

宿主面挂在 Connection 信任围栏内，所以每个请求都要带会话 cookie。wire 信封是对
`/api/<命名空间>/<方法>` 的 JSON `POST`：

```json
{ "type": "client-request", "rpcId": "1", "method": "remoteDev/describe",
  "payload": { "args": { "request": { "includeEndpoints": true } } } }
```

两个字段最容易写错：`rpcId` 是**字符串**；`method` 是**完整端点 id**
（`<命名空间>/<方法名>`，例如 `remoteDev/describe`），不是裸方法名。信封写错时
仍然返回 `HTTP 200` 且 `ok:false`、错误码 `gateway/bad-request`——看起来像插件故障，
其实只是信封不对。插件自身抛出的失败会以 `ok:false` 加 `remote-dev/<reason>` 码返回。

## 环境要求

- Node.js 22+
- DSH，且带有 `@deepseek-ai/cordis` ^4.0.2、`@deepseek-ai/dsh-typert-protocol` ^0.1.5-rc.2
  与 `@deepseek-ai/schemastery` ^3.18.2
- `@deepseek-ai/cordis`、`@deepseek-ai/dsh-typert-protocol` 与
  `@deepseek-ai/schemastery` 必须由宿主提供，保证 Remote 层（以及 settings 接缝）
  共享同一模块实例。

## 许可证

MIT — © Xilong Liu，见 [`LICENSE`](./LICENSE)。

---

<sub>Part of Persevere with DSH</sub>
