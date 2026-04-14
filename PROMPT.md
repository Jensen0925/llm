要求：

    根目录：
        目录：clients/ services/ packages/contracts/src infra/compose
        package.json：workspaces=clients/, services/, packages/*；scripts 包含 dev/dev:web/dev:api/build/typecheck；packageManager=bun@<你的版本>
        bunfig.toml：linker="isolated"
        turbo.json：dev 不缓存且 persistent；build dependsOn ["^build"] 且 outputs 包含 dist/ 和 .next/
        tsconfig.base.json：配置 paths，@repo/contracts 指向 packages/contracts/src/index.ts
    packages/contracts：
        package.json + tsconfig.json + src/index.ts
        导出常量 APP_NAME="llm"
    clients/web（Next）：
        初始化 Next（app router）
        package.json name=@repo/web，依赖引用 "@repo/contracts":"workspace:*"
        next.config.ts 必须设置 transpilePackages=["@repo/contracts"], output="standalone", outputFileTracingRoot
        app/page.tsx 显示 "Hello from ${APP_NAME}"
    services/api（Nest）：
        初始化 Nest
        package.json name=@repo/api，依赖引用 "@repo/contracts":"workspace:*"
        监听端口 3001
        GET /health 返回 { ok: true }
        GET /hello 返回 { message: Hello from API, shared APP_NAME=${APP_NAME} }
    Web 调用 API：
        Web 页面加按钮，点击后 fetch /hello 并展示返回 message
        处理跨域：优先使用 Next rewrites 把 /api/ 转发到 http://localhost:3001/，并把前端请求写成 fetch("/api/hello")
    Compose：
        infra/compose/compose.yaml：web:3000, api:3001；api healthcheck 访问 /health；web depends_on api service_healthy
        允许开发覆盖文件 compose.dev.yaml（挂载源码）

交付要求：

    生成所有必要文件
    根目录 bun install、bun run dev 可运行
    打开 http://localhost:3000，点击按钮能展示 API 返回 message
    每一步完成后，输出你修改/新增了哪些文件（按步骤 1→6 汇报）。


在现有 monorepo 的 services/api 下，完成 LangChain 的接入准备与模型调用基础，严格按以下要求执行：

前置：
- 在 services/api 安装依赖：langchain @langchain/openai @langchain/core js-yaml
- 在 services/api/.env 中配置环境变量：OPENAI_API_KEY, OPENAI_BASE_URL, EMBEDDING_API_KEY, VECTOR_DB_URL, VECTOR_DB_API_KEY
- .env 加入 .gitignore

1. 配置层：
   - 新建 services/api/config/langchain.yaml，只放运行参数：llm、retrieval、tools、features
   - 新建 services/api/src/config/load-langchain-config.ts

2. 统一模型工厂：
   - 新建 services/api/src/llm/model.factory.ts
   - 从 YAML 读取模型参数，从 getApiKeys() 读取令牌和 baseURL

3. NestJS 骨架 + 三种调用路由：
   - 新建 services/api/src/llm/llm.module.ts
   - 新建 services/api/src/llm/llm.service.ts
   - 新建 services/api/src/llm/llm.controller.ts（@Controller('api/langchain')）
   - 在 LlmService + LlmController 中实现：POST invoke / POST stream / POST batch
   - 输入统一使用：'用户注册时必须绑定手机号，密码至少8位'

约束：
- 令牌/密钥/服务地址一律走 process.env
- 所有路由的 SystemMessage 角色为“需求结构化抽取助手”
- 不要在 Service 里直接 new ChatOpenAI，统一用 createChatModel()
- 所有能力以 Service 方法 + Controller 路由形式暴露

在 services/api 的 LangChain 层中，把提示内容抽成模板，并提供最小模板渲染与调用示例，严格按以下要求执行：

1. 提示模板：
   - 新建 services/api/src/llm/prompts/requirement.prompt.ts
   - 导出 REQUIREMENT_SYSTEM_PROMPT
   - 导出 REQUIREMENT_USER_TEMPLATE（包含 {input} 占位符）

2. 模板构建器：
   - 新建 services/api/src/llm/requirement.prompt-builder.ts
   - 用 ChatPromptTemplate.fromMessages() 组装 system + human 消息

3. 示例路由：
   - POST prompt-preview：只渲染模板，不调模型
   - POST prompt-to-model：模板 → formatMessages → 模型调用

测试输入统一为：'用户注册时必须绑定手机号，密码至少8位'

export const REQUIREMENT_SYSTEM_PROMPT = `
你是一名“需求结构化抽取助手”。

你的任务是：
从输入文本中提取结构化字段。

严格要求：
1. 不允许编造信息
2. action 必须是唯一核心动作（动词+对象）
3. constraints 只保留明确约束（必须 / 至少 / 不得 / 不能）
4. entities 只提取文本中真实出现的名词
5. 如果不存在某字段，返回空数组

输出必须符合 schema，不要输出解释
`.trim();

export const REQUIREMENT_USER_TEMPLATE = `
请抽取结构化信息：

输入：
{input}
`.trim();

在 services/api 的 LangChain 层中，用 pipe() 构建最小调用链，严格按以下要求执行：

1. 调用链：
   - 新建 services/api/src/llm/requirement.chain.ts
   - 用 requirementPrompt.pipe(model).pipe(new StringOutputParser()) 构建链
   - 导出 requirementChain

2. 新增以下路由：
   - POST chain-invoke
   - POST chain-stream
   - POST chain-batch

输入统一为：'用户注册时必须绑定手机号，密码至少8位'

在 services/api 的 LangChain 层中，让模型返回固定字段格式，严格按以下要求执行：

1. 共享字段定义：
   - 在 packages/contracts/src/index.ts 中新增：
     - RequirementSchema
     - RequirementResultSchema
     - 导出 RequirementResult

2. 结构化服务：
   - 新建 services/api/src/llm/requirement.service.ts
   - 复用 prompts/requirement.prompt.ts 中的常量
   - 用 ChatPromptTemplate.fromMessages() 构建提示
   - 方法 extract(input: string)：
     - 用 prompt.formatMessages({ input })
     - 用 model.withStructuredOutput(RequirementResultSchema)
     - 返回结构化结果

3. 新增路由：
   - POST structured

在 services/api 的 LangChain 层中，接入工具调用机制，严格按以下要求执行：

1. 工具定义：
   - 新建 services/api/src/llm/tools/basic.tools.ts
   - 定义两个工具：
     - check_constraint_validity
     - lookup_entity_definition

2. 在 LlmService + LlmController 中新增以下路由：
   - POST tool-bind
   - POST tool-loop

输入统一使用需求抽取场景。

把前面所有 LangChain 能力收回到 Nest 服务端，并更新前端页面，严格按以下要求执行：

1. 服务层：
   - services/api/src/llm/requirement.service.ts
   - @Injectable() 类 RequirementService
   - 对外提供 extract(input: string): Promise<RequirementResult>

2. Controller：
   - services/api/src/app.controller.ts
   - POST /requirement/extract 接收 { input: string }

3. 前端页面：
   - textarea + 提交按钮 + JSON 结果展示
   - 默认输入：'用户注册时必须绑定手机号，密码至少8位'

4. 增加测试文件：
   - services/api/test/requirement.spec.ts
