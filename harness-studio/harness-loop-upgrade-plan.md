# Harness Studio — 产品升级规划文档

> **产品定位**：输入一个 Loop 名称，自动生成跨平台（6+）的多智能体编排配置。
> **当前版本**：v1.0 — 基于固定 `worker-leader` 模板 + 5 个预设 Agent 的静态生成。
> **目标**：从「模板填空工具」进化为「智能编排配置引擎」。

---

## 用户需求总结

| 维度 | 用户期望 |
|------|----------|
| **输入** | 仅需 Loop 名称；可选择性地提供项目架构文件或文字描述以获取更精准的生成 |
| **Agent** | 完全可定制 — 数量、名称、职责均可由用户决定，软件提供行业/场景推荐 |
| **编排模式** | 支持多种模式（worker-leader / peer-to-peer / pipeline 等），用户自行选择，软件给出建议 |
| **用户群体** | 开发者 + 普通用户，两套配置路径，按需切换 |
| **输出交付** | 目前为 JSON 文件 + 各平台使用指引；用户将文件交给 Agent 自助置入 |

---

## 升级路线图（按商业价值排序）

### 🥇 第一优先级：Agent 智能生成引擎（商业价值：★★★★★）

> **为什么最高**：这是核心差异化能力。当前生成的 Agent 指令全是空壳，用户拿到的是一份「看起来有用但实际上帮不了忙」的配置。只有解决了内容深度问题，产品才有付费价值。

#### Phase 1.1 — 基于项目上下文的内容生成

**用户输入扩展**（可选，不填也能生成）：

- **项目架构文件上传**：支持上传 `package.json`、`pyproject.toml`、`go.mod`、目录树、`docker-compose.yml` 等，自动解析出：
  - 技术栈（前端框架 / 后端语言 / 数据库 / 部署方式）
  - 项目规模（单体 / 微服务 / Monorepo）
  - 已有工具链（测试框架、Linter、CI/CD）

- **文字描述输入**：用户用自然语言描述项目，如：
  > "这是一个电商后台，前端 React + TypeScript，后端 Go 微服务，用 PostgreSQL，部署在 K8s 上"

**生成增强**：
- 调用 LLM 根据以上上下文，为每个 Agent 生成**领域相关、具体可执行**的指令
- 示例对比：

```
# 当前生成（v1.0）
"You are the Frontend Worker. Role: worker. UI components + state."

# 升级后（v1.1）
"You are the Frontend Worker for MyECommerceApp.
 Tech stack: React 18 + TypeScript + Zustand + Tailwind CSS.
 Responsibilities:
 - Build reusable UI components in src/components/
 - Manage global state with Zustand stores in src/stores/
 - Follow Atomic Design methodology
 - Write unit tests with Vitest for every component
 - Ensure all text supports i18n via react-intl
 File scope: src/**/*.{tsx,ts,css}
 Hand-off: When a page/feature is complete, return the file list and API contract expectations."
```

#### Phase 1.2 — 行业知识库匹配

预置行业模板，根据 Loop 名称和上下文自动匹配：
- `*financial*` → 金融合规、数据脱敏、审计日志
- `*ecommerce*` → 高并发、缓存策略、AB 测试
- `*iot*` → 设备管理、MQTT 协议、边缘计算
- `*healthcare*` → HIPAA 合规、数据加密、访问审计
- 也可支持**自定义行业标签**

#### 交付物
- 升级后的生成引擎，使 Agent 指令从 2 行变为 15-30 行可执行内容
- 向后兼容：不填上下文时仍按当前模式生成


### 🥈 第二优先级：Agent 自定义 + 多模式编排（商业价值：★★★★★）

> **为什么第二高**：这是产品从「能用」到「好用」的质变。让用户摆脱 5 个固定 Agent + 单一模式的限制，真正适配千差万别的项目需求。

#### Phase 2.1 — Agent 自定义系统

**交互流程**：

```
Step 1: 用户输入 Loop 名称 + 项目描述（可选）
           ↓
Step 2: 软件分析项目类型，推荐 Agent 角色组合
        例：电商项目 → 推荐 [Orchestrator, Frontend, Backend, Test, DevOps, Docs]
        例：数据分析 → 推荐 [Orchestrator, DataEngineer, Analyst, VizDesigner, Reviewer]
           ↓
Step 3: 用户确认 / 增删 / 修改 Agent
        - 修改名称（任意行业术语均可）
        - 修改职责描述
        - 调整数量（2~12 个）
           ↓
Step 4: 生成配置
```

**Agent 推荐引擎**：
- 内置 15+ 行业 Agent 模板（金融审批员、安全审计员、合规检查员、DevOps 工程师、数据科学家 等）
- 支持用户自定义并保存为模板，下次复用

#### Phase 2.2 — 多编排模式

支持以下模式，软件根据项目特征给出推荐：

| 模式 | 适用场景 | 图标标识 |
|------|----------|----------|
| **Worker-Leader**（当前） | 有明确总控者的项目，如全栈 Web 应用 | 🏗️ |
| **Peer-to-Peer** | 平等协作，如代码 Review、结对编程 | 🤝 |
| **Pipeline** | 线性流水线，如数据处理 ETL | 🔗 |
| **Hierarchical** | 多层树形结构，如大型企业级项目 | 🌳 |
| **Event-Driven** | 事件驱动，如微服务、消息队列场景 | ⚡ |
| **Round-Robin** | 轮转审查，如多轮代码审查 | 🔄 |

每种模式在生成时对应不同的控制流和 hand-off 规则。

#### 交付物
- Agent 自定义配置器 + 推荐引擎
- 6 种编排模式模板
- 可视化预览（可选，可视作第三优先级新增）


### 🥉 第三优先级：平台能力深度适配（商业价值：★★★★☆）

> **为什么**：这是建立护城河的关键。普通工具只会做格式转换，但深度理解每个平台的独特能力会让你的产品对重度用户有不可替代的吸引力。

#### Phase 3.1 — 平台差异化生成

| 平台 | 当前问题 | 升级后 |
|------|----------|--------|
| **Claude Code** | hooks 的 matcher 全部重复触发，没有实际分发效果 | 使用 Claude 的 `Task` tool 实现 subagent 的真正的条件调用；hooks 改为有意义的操作（如自动创建 PR） |
| **Cursor** | 所有 Agent 的 `globs` 都是 `**/*`，权限无差别 | Frontend Worker 锁定 `src/**/*.tsx`，Backend Worker 锁定 `server/**/*.go` |
| **GitHub Copilot** | 配置过于简略 | 利用 Copilot 的 `applyTo` 字段精确控制 Agent 生效范围 |
| **Trae** | MCP Server 配置只有 orchestrator 一个 | 为每个 Agent 生成对应的 MCP Server 配置，连接不同外部工具 |
| **Agents** | 与其他平台高度重复 | 利用该平台的独特能力（如文件范围、工具权限）做差异化 |

#### Phase 3.2 — 平台兼容性校验

生成后自动检查：
- 同一文件路径是否被多个平台写入冲突（如当前 `AGENTS.md` 的问题）
- 各平台格式规范是否符合官方标准
- 依赖的工具/命令是否在目标平台可用

#### 交付物
- 6 个平台的差异化生成逻辑
- 兼容性校验报告


### 4️⃣ 第四优先级：双模式用户界面（商业价值：★★★☆☆）

> **为什么**：扩大潜在用户群体。当前只有懂 Agent 的开发者能上手，加入向导模式后，普通用户也能用。

#### Phase 4.1 — 双界面模式

**简易模式（面向普通用户）**：
```
┌─────────────────────────────────────────┐
│  🚀 创建 Agent 编排配置                   │
│                                          │
│  📝 项目名称：[____________]              │
│                                          │
│  🎯 项目类型：[▼ 请选择 ▼]               │
│     · Web 全栈应用                       │
│     · 移动 App                          │
│     · 数据分析项目                       │
│     · 微服务架构                         │
│     · 其他（请描述）                      │
│                                          │
│  🤖 目标平台：[ ] Claude [x] Cursor ...  │
│                                          │
│  [ 一键生成最优配置 ]                     │
└─────────────────────────────────────────┘
```
- 自动推荐最优的 Agent 组合和编排模式
- 隐藏复杂的技术细节

**专业模式（面向开发者）**：
- 完整的 Agent 自定义面板
- 编排模式选择
- 每个平台的细粒度参数调节
- 配置文件预览 + 手动编辑

#### Phase 4.2 — 使用指引系统

针对每个目标平台生成定制化的部署指引：

```
📋 你的配置已生成！

➊ 复制以下 JSON 文件给你的 AI Agent
➋ 告诉它："请根据 harness-loop-configs.json 将配置文件部署到项目中"

各平台专属指引：
· Claude Code: 将文件拖入项目根目录，运行 claude --init
· Cursor: 将 .cursor/rules/*.mdc 放入项目根目录
· GitHub Copilot: 将 .github/ 目录放入项目根目录
· ...
```

#### 交付物
- 简易模式 + 专业模式双界面
- 各平台的部署指引文案


### 5️⃣ 第五优先级：配置优化与质量保障（商业价值：★★☆☆☆）

> **为什么**：锦上添花的功能，提升专业感和可靠性。

#### Phase 5.1 — 智能去重与结构优化

- 内容完全相同且平台不冲突的文件 → 默认只生成一份，标注 `shared: true`
- JSON 增加元数据字段：
  ```json
  {
    "_meta": {
      "version": "1.1.0",
      "generated_at": "2026-07-03T20:00:00Z",
      "loop_name": "My_financial_manager_loop",
      "pattern": "worker-leader",
      "agent_count": 5,
      "platforms": ["claude", "cursor", "copilot", "trae", "agents"],
      "input_context": "financial-management-app"
    }
  }
  ```

#### Phase 5.2 — 配置健康检查

生成后自动评分：
- **完整度**：每个 Agent 是否有实质性指令？
- **覆盖度**：关键领域是否都有对应的 Agent？
- **合理性**：编排模式与项目类型是否匹配？
- **平台合规**：各平台配置是否符合最佳实践？

输出一份评分报告，帮助用户发现自己配置中的盲区。

#### 交付物
- 智能去重 + 元数据
- 健康检查报告


### 6️⃣ 第六优先级：版本管理与持续迭代（商业价值：★★☆☆☆）

> **为什么**：长期运营的基础设施，用于追踪用户偏好和优化推荐。

#### Phase 6.1 — 用户模板库

- 用户可保存自己的配置模板（命名、收藏、复用）
- 内置社区模板市场（匿名分享）

#### Phase 6.2 — 分析反馈闭环

- 记录用户生成的配置中哪些 Agent 被保留、哪些被删除
- 持续优化推荐算法

#### 交付物
- 模板保存/加载功能
- 匿名使用数据收集（隐私合规）

---

## 总结：分阶段交付计划

| 阶段 | 内容 | 预估效果 | 用户感知提升 |
|------|------|----------|:--:|
| **P1** | Agent 智能生成引擎 | 生成内容从空壳变为可执行指令 | ⭐⭐⭐⭐⭐ |
| **P2** | Agent 自定义 + 多模式编排 | 从 1 种模式 → 6 种, 5 个固定角色 → 无限可能 | ⭐⭐⭐⭐⭐ |
| **P3** | 平台能力深度适配 | 每个平台「物尽其用」 | ⭐⭐⭐⭐ |
| **P4** | 双模式 UI + 使用指引 | 开发者和普通用户都能用 | ⭐⭐⭐ |
| **P5** | 配置优化与质量保障 | 去冲突、出报告 | ⭐⭐ |
| **P6** | 版本管理与迭代 | 长期留存和持续优化 | ⭐⭐ |

---

*文档版本 v1.0 | 生成日期 2026-07-03*
