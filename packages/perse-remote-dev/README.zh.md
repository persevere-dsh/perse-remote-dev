# Persevere with DSH：PC 远程连接

`perse` = persevere。本项目是 Perse 插件集合中的 `perse-remote-dev`。PC 界面按用户确认的 revision B 收敛：**插件入口只管理连接，聊天继续使用 DSH 原生会话框。** 已移除自建任务界面、项目工具、代码审阅以及平行的草稿/时间线控制器。

插件会把已验证的远程工作区和会话注册到 DSH 原生外部会话后端，由 DSH 原生会话框负责对话、输入和事件展示。该集成要求匹配的 DSH 0.2.1 扩展版 API；缺少此 API 的上游运行时仍可使用连接设置页，插件会提示需升级 DSH 才能使用原生远程会话。

## 当前使用路径

1. 被控电脑运行此项目配套的 `perse-remote` 主机插件，并明确授权工作区。在插件管理页生成短时配对链接。
2. 控制电脑在 DSH 原生侧栏打开「远程连接」，粘贴链接，预览主机和地址后确认。
3. 管理保存的主机：连接、断开、忘记或撤销此设备。长期凭证只在本机插件私有存储，浏览器不接收设备令牌。
4. 在 DSH 原生侧栏选择远程工作区和会话，或点项目右侧的新建按钮；直接在 DSH 原生输入框里开发。未实现的操作会显示明确错误，不会转交给本地 Agent 执行。

同机测试使用 loopback，无需服务器、域名或 SSH。跨电脑使用可达且可信的 WSS 地址，HTTPS 反向代理或私有转发由用户选择。配对地址中的 `127.0.0.1` 指运行 PC 插件的电脑。插件不自动开隧道或公开监听端口。

## 开发与安装

```sh
npm ci
npm run setup:dsh-native -- --source /path/to/perse-dsh-native
npm test
npm run pack
dsh plugin --profile web add ./perse-remote-dev-0.3.0.tgz
```

开发 setup 会校验隔离 DSH 0.2.1 源码及编译产物，并只在当前开发仓库中链接会话类型包；也可用 `PERSE_DSH_SOURCE_ROOT` 指定目录。它不会改安装版 DSH 或用户配置。正式插件 tarball 已预构建，无需运行 setup。Node 要求 22+，Typert generator 和 protocol 均固定为 0.2.1-rc.2。

权威远程协议来自 `perse-ios-app/specs/001..003`，PC revision B 在 `specs/004-pc-remote-control`。包内附协议镜像与哈希；`PERSE_REMOTE_CANONICAL_ROOT` 可指定规范仓库。

`src/client/native-sessions` 负责原生 SessionFace、事件转换和代次/发送回执。模块：`src/pc` 为私有凭证与协议桥接；`src/client/connections` 为连接状态；`src/client/pc-ui` 只包含连接设置页；`src/client/index.ts` 仅注册连接入口。旧浏览器草稿数据没有读取、迁移或删除。旧 token URL 打开入口已停用，旧 SSH/rd-core 配置未破坏。

当前候选状态与验收边界见 [原生 DSH 状态](docs/pc-native-status.md)。历史界面证据不能证明当前候选已验收。Dashboard、Proof、Updater、CUA 保持独立项目。
