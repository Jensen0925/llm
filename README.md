# LLM

LLM 是一个基于 Bun + Turborepo 的 TypeScript 单仓项目，用于演示从自然语言需求中抽取结构化信息。项目包含 Next.js Web 客户端、NestJS API 服务，以及共享的 contracts 包。

## 技术栈

- **Runtime / 包管理**：Bun
- **Monorepo**：Turborepo
- **Web**：Next.js、React、TypeScript
- **API**：NestJS、LangChain、OpenAI-compatible Chat Model
- **共享契约**：Zod、TypeScript

## 项目结构

```text
.
├── clients/
│   └── web/              # Next.js Web 客户端
├── services/
│   └── api/              # NestJS API 服务
├── packages/
│   └── contracts/        # 共享类型、Schema 和常量
├── infra/
│   └── compose/          # Docker Compose 配置
├── package.json          # 根工作区脚本
├── turbo.json            # Turborepo 任务配置
└── tsconfig.base.json    # TypeScript 基础配置
```

## 功能概览

- Web 页面输入需求文本并调用 API。
- API 提供健康检查、示例接口和需求抽取接口。
- LangChain 集成 OpenAI-compatible 模型，支持 invoke、stream、batch、chain 等示例能力。
- `@repo/contracts` 共享 `RequirementSchema`、`RequirementResultSchema` 等类型约束。

## 环境要求

- Bun `1.3.11` 或兼容版本
- Node.js 运行环境
- OpenAI 或兼容服务的 API Key

## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 配置环境变量

在 API 服务运行环境中配置：

```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_BASE_URL="https://api.openai.com/v1" # 可选，兼容 OpenAI 的服务可修改
export EMBEDDING_API_KEY="your-embedding-api-key"  # 可选，默认复用 OPENAI_API_KEY
export VECTOR_DB_URL="your-vector-db-url"          # 可选
export VECTOR_DB_API_KEY="your-vector-db-api-key"  # 可选
```

### 3. 配置 LangChain

API 启动时会读取 `services/api/config/langchain.yaml`。如不存在，请创建：

```yaml
llm:
  provider: openai
  model: gpt-4o-mini
  temperature: 0.2
  maxTokens: 1000

retrieval:
  enabled: false
  topK: 5

tools:
  enableConstraintCheck: true
  enableEntityLookup: true

features:
  enableStructuredOutput: true
  enableStreaming: true
```

### 4. 启动开发环境

同时启动 Web 和 API：

```bash
bun run dev
```

只启动 Web：

```bash
bun run dev:web
```

只启动 API：

```bash
bun run dev:api
```

默认访问地址：

- Web：`http://localhost:3000`
- API：`http://localhost:3001`

## 常用脚本

```bash
bun run dev        # 并行启动 Web 和 API
bun run dev:web    # 启动 Web
bun run dev:api    # 启动 API
bun run build      # 构建全部包
bun run typecheck  # TypeScript 类型检查
bun run lint       # 代码检查
bun run test       # 测试
```

## API 接口

### 基础接口

- `GET /health`：健康检查
- `GET /hello`：示例接口
- `POST /requirement/extract`：需求结构化抽取

请求示例：

```bash
curl -X POST http://localhost:3001/requirement/extract \
  -H "Content-Type: application/json" \
  -d '{"input":"用户注册时必须绑定手机号，密码至少8位"}'
```

### LangChain 示例接口

- `POST /api/langchain/invoke`
- `POST /api/langchain/stream`
- `POST /api/langchain/batch`
- `POST /api/langchain/prompt-preview`
- `POST /api/langchain/prompt-to-model`
- `POST /api/langchain/chain-invoke`
- `POST /api/langchain/chain-stream`
- `POST /api/langchain/chain-batch`
- `POST /api/langchain/structured`

## 开发说明

- Web 默认通过 `NEXT_PUBLIC_API_BASE_URL` 调用 `http://localhost:3001`。
- 共享包位于 `packages/contracts`，修改后会被 Web 和 API 共同使用。
- 构建产物、依赖目录、缓存文件已通过 `.gitignore` 忽略。
- `infra/compose` 中包含 Compose 配置，如需容器化运行，需要补齐对应 Dockerfile。

## 许可证

当前项目未声明开源许可证。
