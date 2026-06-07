# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Chat2API Manager is an Electron desktop application that provides an OpenAI-compatible API proxy for multiple AI service providers (DeepSeek, GLM, Kimi, MiniMax, Qwen, Z.ai, Perplexity). It enables using any OpenAI-compatible client with these providers across macOS, Windows, and Linux.

## Build Commands

```bash
# Development
npm run dev              # Start dev server (macOS/Linux)
npm run dev:win          # Start dev server (Windows)

# Build
npm run build            # Build the application
npm run build:mac        # Build for macOS (dmg, zip)
npm run build:win        # Build for Windows (nsis)
npm run build:linux      # Build for Linux (AppImage, deb)
npm run build:all        # Build for all platforms

# Preview production build
npm run preview
```

## Architecture

```
src/
├── main/                    # Electron main process
│   ├── index.ts            # App entry point
│   ├── ipc/                # IPC handlers (main ↔ renderer communication)
│   ├── proxy/              # Proxy server (Koa)
│   │   ├── server.ts       # HTTP server with middleware
│   │   ├── forwarder.ts    # Request forwarding logic & auth
│   │   ├── adapters/       # Provider-specific adapters
│   │   ├── routes.ts       # Proxy routes registration
│   │   ├── sessionManager.ts # Multi-turn conversation management
│   │   └── services/       # Prompt injection & prompt generation
│   ├── oauth/              # OAuth authentication
│   │   ├── manager.ts      # OAuth flow orchestration
│   │   ├── inAppLogin.ts   # In-app browser login with token auto-extraction
│   │   └── adapters/       # Provider-specific OAuth adapters
│   ├── providers/          # Provider configurations
│   │   ├── builtin/        # Built-in provider configs (one file per provider)
│   │   └── custom.ts       # Custom provider support
│   ├── store/              # Persistent storage (electron-store)
│   │   ├── store.ts        # Main store manager with IPC bridge
│   │   ├── types.ts        # Type definitions and default values
│   │   └── config.ts       # Configuration management
│   └── tray/               # System tray integration
├── preload/                # Context bridge (IPC API exposure)
├── renderer/               # React frontend
│   ├── components/         # UI components
│   ├── pages/              # Page components
│   ├── stores/             # Zustand state management
│   └── i18n/               # Internationalization (en-US, zh-CN)
└── shared/                 # Shared types between main and renderer
```

## Key Concepts

### Provider Adapters
Each AI provider has a dedicated adapter in `src/main/proxy/adapters/` that handles:
- Message format conversion (OpenAI format → provider-specific format)
- Authentication header construction
- Stream response parsing
- Multi-turn conversation context

To add a new provider:
1. Create config in `src/main/providers/builtin/<provider>.ts`
2. Create OAuth adapter in `src/main/oauth/adapters/<provider>.ts`
3. Create proxy adapter in `src/main/proxy/adapters/<provider>.ts`
4. Create stream handler in `src/main/proxy/adapters/<provider>-stream.ts`
5. Register in `src/main/providers/builtin/index.ts` and `src/main/proxy/adapters/index.ts`

### IPC Communication
All main-renderer communication uses IPC channels defined in `src/main/ipc/channels.ts`. The naming convention is `domain:action` (e.g., `proxy:start`, `accounts:add`).

### Session Management
Multi-turn conversations are managed by `sessionManager.ts`:
- `single` mode: Session deleted after each chat
- `multi` mode: Session persists with parent message IDs for context

### Tool Prompt Injection
For models without native function calling, prompts are injected via `promptInjectionService.ts`. This enables function calling compatibility with clients like Cherry Studio and Kilo Code.

### Session Management Flow
1. Client sends request with `sessionId`
2. `sessionManager.ts` retrieves session or creates new one
3. For `multi` mode: parentMessageId is used to fetch conversation history
4. Adapter creates/uses provider-specific session
5. Response is returned with new parentMessageId for context continuation

## Data Storage

Application data is stored in `~/.chat2api/`:
- `config.json` - Application configuration
- `providers.json` - Provider settings
- `accounts.json` - Account credentials (encrypted)
- `logs/` - Request logs

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Electron 33+ |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Build | Vite + electron-vite |
| Server | Koa |

## Coding Guidelines

### Immutability (CRITICAL)
ALWAYS create new objects, NEVER mutate existing ones. Use `update` functions that return new copies.

### Error Handling
Handle errors comprehensively:
- Validate all user input before processing
- Provide user-friendly error messages in UI-facing code
- Log detailed error context on the server side
- Never silently swallow errors

### Input Validation
Validate at system boundaries (user input, external APIs). Use schema-based validation where available.

### Security
- Validate all API keys before use
- Sanitize all user inputs
- Never trust external data (API responses, user input, file content)
- Rotate any exposed secrets immediately

## macOS Development Note

A workaround is applied for V8 JIT compiler crash on macOS ARM64 (Electron 33 bug):
```typescript
app.commandLine.appendSwitch('js-flags', '--jitless --no-opt')
```
This trades some performance for stability.

## Adding a New Provider

### Overview

Adding a new provider requires modifications across 4 layers: Provider Config, OAuth Authentication, Proxy Adapter, and UI. The following guide covers all necessary steps.

### Core File Modification Checklist

#### 1. Provider Config Layer (Required)

| File | Purpose |
|------|---------|
| `src/main/providers/builtin/<provider>.ts` | Provider configuration definition |
| `src/main/providers/builtin/index.ts` | Register provider in `builtinProviders` array |
| `src/main/store/types.ts` | Sync to `BUILTIN_PROVIDERS` array |

#### 2. OAuth Authentication Layer (Required)

| File | Purpose |
|------|---------|
| `src/main/oauth/adapters/<provider>.ts` | OAuth adapter implementation |
| `src/main/oauth/adapters/index.ts` | Register in `createAdapter()` and `getSupportedAuthMethods()` |
| `src/main/oauth/types.ts` | Add to `MANUAL_TOKEN_CONFIGS` (optional) |

#### 3. Proxy Adapter Layer (Required)

| File | Purpose |
|------|---------|
| `src/main/proxy/adapters/<provider>.ts` | Proxy adapter implementation |
| `src/main/proxy/adapters/<provider>-stream.ts` | Stream handler implementation |
| `src/main/proxy/adapters/index.ts` | Export adapter |
| `src/main/proxy/forwarder.ts` | Add `forward<Provider>()` method |

#### 4. UI Layer (Required)

| File | Purpose |
|------|---------|
| `src/renderer/src/i18n/locales/zh-CN.json` | Chinese translations |
| `src/renderer/src/i18n/locales/en-US.json` | English translations |
| `src/renderer/src/components/providers/ProviderCard.tsx` | Add icon mapping |
| `src/assets/providers/<provider>.svg` | Provider icon file |

### Step-by-Step Implementation

#### Step 1: Provider Configuration

```typescript
// src/main/providers/builtin/<provider>.ts
import type { BuiltinProviderConfig } from '../../store/types'

export const providerConfig: BuiltinProviderConfig = {
  id: 'provider-id',
  name: 'Provider Name',
  type: 'builtin',
  authType: 'userToken',  // See AuthType section below
  apiEndpoint: 'https://api.example.com',
  chatPath: '/chat/completions',
  headers: {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Origin': 'https://example.com',
    'Referer': 'https://example.com/',
  },
  enabled: true,
  description: 'Provider description',
  supportedModels: ['Model-1', 'Model-2'],
  modelMappings: {
    'Model-1': 'model-1-id',
    'Model-2': 'model-2-id',
  },
  credentialFields: [
    {
      name: 'token',
      label: 'Token',
      type: 'password',
      required: true,
      placeholder: 'Enter token',
      helpText: 'How to get token',
    },
  ],
  tokenCheckEndpoint: '/api/user',    // Optional
  tokenCheckMethod: 'GET',            // Optional
}

export default providerConfig
```

#### Step 2: Register Provider

```typescript
// src/main/providers/builtin/index.ts
import providerConfig from './provider'

export const builtinProviders: BuiltinProviderConfig[] = [
  // ...existing
  providerConfig,
]

export const builtinProviderMap: Record<string, BuiltinProviderConfig> = {
  // ...existing
  'provider-id': providerConfig,
}

export { providerConfig }
```

**CRITICAL**: Must also update `src/main/store/types.ts` `BUILTIN_PROVIDERS` array with identical configuration.

#### Step 3: OAuth Adapter

```typescript
// src/main/oauth/adapters/<provider>.ts
import axios from 'axios'
import { BaseOAuthAdapter } from './base'
import { OAuthResult, OAuthOptions, TokenValidationResult, AdapterConfig } from '../types'

const API_BASE = 'https://api.example.com'

export class ProviderAdapter extends BaseOAuthAdapter {
  constructor(config: AdapterConfig) {
    super({
      ...config,
      providerType: 'provider-id',
      authMethods: ['manual'],
      loginUrl: API_BASE,
      apiUrl: API_BASE,
    })
  }

  async startLogin(options: OAuthOptions): Promise<OAuthResult> {
    await shell.openExternal(API_BASE)
    return {
      success: false,
      providerId: options.providerId,
      error: 'Please log in via browser and enter Token manually',
    }
  }

  async validateToken(credentials: Record<string, string>): Promise<TokenValidationResult> {
    const token = credentials.token
    if (!token) return { valid: false, error: 'Token cannot be empty' }

    try {
      const response = await axios.get(`${API_BASE}/api/user`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
        validateStatus: () => true,
      })

      if (response.status !== 200) {
        return { valid: false, error: 'Token is invalid or expired' }
      }

      return {
        valid: true,
        tokenType: 'access',
        accountInfo: {
          userId: response.data.id,
          email: response.data.email,
          name: response.data.name,
        },
      }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Validation failed' }
    }
  }

  async refreshToken(credentials: Record<string, string>) {
    return null  // Optional
  }
}

export default ProviderAdapter
```

#### Step 4: Register OAuth Adapter

```typescript
// src/main/oauth/adapters/index.ts
export { ProviderAdapter } from './provider'

export function createAdapter(providerType: ProviderType, config: AdapterConfig): BaseOAuthAdapter {
  switch (providerType) {
    // ...existing
    case 'provider-id':
      return new ProviderAdapter(config)
    default:
      throw new Error(`Unsupported provider type: ${providerType}`)
  }
}

export function getSupportedAuthMethods(providerType: ProviderType): string[] {
  switch (providerType) {
    // ...existing
    case 'provider-id':
      return ['manual']
    default:
      return ['manual']
  }
}
```

#### Step 5: Proxy Adapter

```typescript
// src/main/proxy/adapters/<provider>.ts
import axios, { AxiosResponse } from 'axios'
import { Account, Provider } from '../../store/types'

const API_BASE = 'https://api.example.com'

export class ProviderAdapter {
  private provider: Provider
  private account: Account
  private token: string

  constructor(provider: Provider, account: Account) {
    this.provider = provider
    this.account = account
    this.token = account.credentials.token || ''
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<{
    response: AxiosResponse
    sessionId: string
  }> {
    // 1. Get/refresh token
    // 2. Build request
    // 3. Send request
    // 4. Return response
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return true
  }

  static isProviderProvider(provider: Provider): boolean {
    return provider.id === 'provider-id' || provider.apiEndpoint.includes('example.com')
  }
}

export const providerAdapter = { ProviderAdapter }
```

#### Step 6: Stream Handler

```typescript
// src/main/proxy/adapters/<provider>-stream.ts
import { PassThrough } from 'stream'

export class ProviderStreamHandler {
  private model: string
  private sessionId: string
  private isFirstChunk: boolean = true
  private created: number

  constructor(model: string, sessionId: string, onEnd?: () => void) {
    this.model = model
    this.sessionId = sessionId
    this.created = Math.floor(Date.now() / 1000)
  }

  async handleStream(stream: NodeJS.ReadableStream): Promise<NodeJS.ReadableStream> {
    const transStream = new PassThrough()
    
    stream.on('data', (chunk: Buffer) => {
      // Parse SSE data
      // Convert to OpenAI format
      // Write to transStream
    })

    stream.on('end', () => {
      transStream.write('data: [DONE]\n\n')
      transStream.end()
    })

    return transStream
  }

  async handleNonStream(stream: NodeJS.ReadableStream): Promise<any> {
    // Collect all data
    // Return OpenAI format response
  }

  private createChunk(delta: any, finishReason?: string): string {
    return `data: ${JSON.stringify({
      id: this.sessionId,
      model: this.model,
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta, finish_reason: finishReason || null }],
      created: this.created,
    })}\n\n`
  }
}
```

#### Step 7: Register Proxy Adapter

```typescript
// src/main/proxy/adapters/index.ts
export { ProviderAdapter, ProviderStreamHandler, providerAdapter } from './provider'
```

#### Step 8: Add Forwarder Method

```typescript
// src/main/proxy/forwarder.ts
import { ProviderAdapter } from './adapters/provider'
import { ProviderStreamHandler } from './adapters/provider-stream'

// In doForward method, add check:
if (ProviderAdapter.isProviderProvider(provider)) {
  return this.forwardProvider(request, account, provider, actualModel, startTime, sessionContext)
}

// Add forward method:
private async forwardProvider(
  request: ChatCompletionRequest,
  account: Account,
  provider: Provider,
  actualModel: string,
  startTime: number,
  sessionContext: SessionContext
): Promise<ForwardResult> {
  // Implementation
}
```

#### Step 9: Add UI Translations

```json
// src/renderer/src/i18n/locales/zh-CN.json
{
  "provider-id": {
    "name": "供应商名称",
    "description": "供应商描述",
    "token": "Token",
    "tokenPlaceholder": "请输入 Token",
    "tokenHelp": "从网页版获取 Token",
    "models": {
      "Model-1": "模型 1 描述"
    }
  }
}
```

```json
// src/renderer/src/i18n/locales/en-US.json
{
  "provider-id": {
    "name": "Provider Name",
    "description": "Provider description",
    "token": "Token",
    "tokenPlaceholder": "Enter token",
    "tokenHelp": "Get token from web version",
    "models": {
      "Model-1": "Model 1 description"
    }
  }
}
```

#### Step 10: Add Icon Mapping

```typescript
// src/renderer/src/components/providers/ProviderCard.tsx
import providerIcon from '@/assets/providers/provider.svg'

const providerIcons: Record<string, string> = {
  // ...existing
  'provider-id': providerIcon,
}
```

### AuthType Reference

| Type | Description | Providers | Credential Field |
|------|-------------|-----------|------------------|
| `userToken` | User Token | DeepSeek | `token` |
| `jwt` | JWT Token | Kimi, MiniMax, Qwen AI, Z.ai | `token` |
| `refresh_token` | Refresh Token | GLM | `refresh_token` |
| `cookie` | Cookie Auth | Perplexity | `sessionToken` |
| `tongyi_sso_ticket` | SSO Ticket | Qwen | `ticket` |
| `token` | Generic Token | Z.ai | `token` |

### Web Search Mode Implementation

Three ways to enable web search:

1. **Model Mapping**: Auto-enable via model name
```typescript
const modelLower = request.model.toLowerCase()
if (modelLower.includes('search')) {
  searchEnabled = true
}
```

2. **Custom Parameter**: Via `web_search` parameter
```typescript
if (request.web_search) {
  searchEnabled = true
}
```

3. **Custom Header**: Via request header
```typescript
if (headers['X-Enable-Search']) {
  searchEnabled = true
}
```

### Thinking Mode Implementation

Three ways to enable thinking mode:

1. **Model Mapping**: Auto-enable via model name
```typescript
const modelLower = request.model.toLowerCase()
if (modelLower.includes('r1') || modelLower.includes('think')) {
  thinkingEnabled = true
}
```

2. **Custom Parameter**: Via `reasoning_effort` parameter
```typescript
if (request.reasoning_effort) {
  thinkingEnabled = true
}
```

3. **Custom Header**: Via request header
```typescript
if (headers['X-Enable-Thinking']) {
  thinkingEnabled = true
}
```

### Thinking Content Handling

In stream handler, output thinking content to `reasoning_content` field:

```typescript
if (path === 'thinking') {
  delta.reasoning_content = processedContent
} else {
  delta.content = processedContent
}
```

### Model List Synchronization

**CRITICAL**: Model list must be defined in TWO locations:

1. `src/main/providers/builtin/<provider>.ts` - `supportedModels` array
2. `src/main/store/types.ts` - `BUILTIN_PROVIDERS` array

Both must be identical, otherwise configuration won't take effect.

### Testing Checklist

- [ ] Provider displays correctly
- [ ] Account can be added
- [ ] Account validation works
- [ ] Streaming chat works
- [ ] Non-streaming chat works
- [ ] Web search mode works
- [ ] Thinking mode works
- [ ] Model mapping works
- [ ] Multi-turn conversation works
- [ ] Session deletion works

## Updating Provider Configuration

When updating provider configuration (e.g., model list, description, help text), you MUST update **both** locations:

1. **`src/main/providers/builtin/<provider>.ts`** - Provider config module
2. **`src/main/store/types.ts`** - `BUILTIN_PROVIDERS` array

The `initializeDefaultProviders()` method in `store.ts` syncs configuration from `BUILTIN_PROVIDERS` to persistent storage on app startup. If only one location is updated, the changes will not be reflected in the UI.

Example: When updating Z.ai model list:
```typescript
// 1. src/main/providers/builtin/zai.ts
supportedModels: ['GLM-5-Turbo', 'GLM-5', 'GLM-4.7', ...]

// 2. src/main/store/types.ts (BUILTIN_PROVIDERS array)
supportedModels: ['GLM-5-Turbo', 'GLM-5', 'GLM-4.7', ...]
```

**Important**: Users must restart the app after configuration updates to see the changes.

---

## Docker 部署方案

### 概述

本项目原为 Electron 桌面应用。Docker 方案通过 mock 层剥离 Electron 依赖，以纯 Node.js 服务方式运行核心代理功能，并提供 Web 管理后台。

- **Docker 镜像**: `movemama/chat2api:latest`
- **Git 分支**: `expfukck/Chat2API` → `docker` 分支
- **上游仓库**: `xiaoY233/Chat2API` → `main` 分支

### 架构

```
Docker 容器内运行:

src/docker/index.ts (入口)
    ├── electron-mock-runtime.js  → 替换 node_modules/electron/index.js
    │   (safeStorage → AES-256-CBC, app/BrowserWindow/ipcMain → stub)
    ├── store-mock-runtime.mjs   → 替换 node_modules/electron-store/index.js
    │   (JSON 文件读写替代 electron-store)
    ├── ProxyServer (Koa)        → 原始 src/main/proxy/server.ts（未修改）
    │   └── 端口 18050: /v1/chat/completions, /v1/models, /health
    ├── Admin HTTP Server        → Node.js http.createServer
    │   ├── 端口 18051: admin.html (Vue3 SPA 管理后台)
    │   ├── /api/* → extendedApi.ts (扩展 API)
    │   └── /auth/callback → Token 回调页面
    └── Management API           → 原始 /v0/management/* (自动启用)
```

### Docker 相关文件

#### 新增文件（不会与上游冲突）

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 两阶段构建：electron-vite 编译 + tsx 运行时 |
| `docker-compose.yml` | 一键部署配置 |
| `.dockerignore` | 构建排除规则 |
| `DOCKER.md` | 完整部署文档（中文） |
| `docker-config.example.json` | 配置文件示例 |
| `scripts/sync-upstream.sh` | 上游同步+构建+推送一键脚本 |
| `src/docker/index.ts` | Docker 入口（启动代理+管理后台） |
| `src/docker/extendedApi.ts` | 扩展 API（提示词、模型、数据导出等 15+ 端点） |
| `src/docker/admin.html` | Web 管理后台（Vue3 + Tailwind，11 页面） |
| `src/docker/electron-mock-runtime.js` | Electron API 模拟（CJS） |
| `src/docker/electron-hook.js` | 模块拦截器（CJS） |
| `src/docker/store-mock-runtime.mjs` | electron-store 替代（ESM） |
| `src/docker/store-mock-runtime.js` | electron-store 替代（CJS） |
| `src/docker/index.js` | CJS 入口（备用） |

#### 修改文件（上游更新时可能冲突）

| 文件 | 改动 | 冲突概率 |
|------|------|:---:|
| `electron.vite.config.ts` | 从 exclude 列表移除 `electron-store` 和 `electron-updater`（使其外部化） | 低 |
| `.gitignore` | 添加 `!src/docker/*.js` 例外（允许提交 Docker JS 文件） | 极低 |

### 端口说明

| 端口 | 用途 |
|------|------|
| `18050` | OpenAI 兼容 API + Management API |
| `18051` | Web 管理后台 + 扩展 API + Token 回调 |

### 数据持久化

```yaml
volumes:
  - ./data:/root/.chat2api    # bind mount 到宿主机
```

数据结构：
```
./data/
├── data.json                 # 配置、账号、Provider、API Key
├── logs/                     # 应用日志
│   └── app-logs.ndjson
└── request-logs/             # 请求日志
    └── request-logs.ndjson
```

### 构建与部署

```bash
# 构建
docker build -t movemama/chat2api:latest .

# 运行
docker compose up -d

# 一键同步上游 + 构建 + 推送
bash scripts/sync-upstream.sh

# 只同步不构建
bash scripts/sync-upstream.sh --skip-build
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CHAT2API_PORT` | `18050` | API 监听端口 |
| `CHAT2API_HOST` | `0.0.0.0` | 监听地址 |
| `CHAT2API_ADMIN_PORT` | `18051` | 管理后台端口 |
| `CHAT2API_LOG_LEVEL` | `info` | 日志级别 |
| `CHAT2API_MANAGEMENT_SECRET` | 自动生成 | Management API 密钥 |
| `CHAT2API_CONFIG_PATH` | `~/.chat2api/docker-config.json` | 初始配置文件路径 |

---

## ⚠️ 关键注意点

### 1. Provider 凭证字段名（CRITICAL）

**Docker 管理后台存储的字段名必须与适配器读取的字段名完全一致**，否则 Token 找不到，请求会失败。

| Provider | 适配器读取 (`credentials.X`) | 管理后台存储字段 | 匹配 |
|----------|------------------------------|-----------------|:---:|
| DeepSeek | `token` \|\| `apiKey` \|\| `refreshToken` | `token` | ✅ |
| GLM | `refresh_token` \|\| `token` | `refresh_token` | ✅ |
| Kimi | `token` \|\| `refreshToken` | `token` | ✅ |
| Qwen | `ticket` \|\| `tongyi_sso_ticket` | `ticket` | ✅ |
| MiniMax | `token` (+ `realUserID` 可选) | `token` + `realUserID` | ✅ |
| Perplexity | `sessionToken` \|\| `cookie` \|\| `token` | `cookie` | ✅ |
| MiMo | `service_token` + `user_id` + `ph_token` | `service_token` + `user_id` + `ph_token` | ✅ |
| Z.ai | `token` (+ `captcha_verify_param` 可选) | `token` + `captcha_verify_param` | ✅ |

**检查方法**：查看 `src/main/proxy/adapters/<provider>.ts` 中的 `credentials.X` 访问方式。

**历史教训**：曾将 DeepSeek 存为 `userToken`、GLM 存为 `refreshToken`、MiMo 存为 `cookie`，导致适配器读取不到 Token，请求全部失败。

### 2. Provider 登录网址

管理后台「打开网站」按钮使用的 URL 必须与源码 OAuth 适配器中的一致：

| Provider | 正确 URL | 错误 URL |
|----------|----------|----------|
| MiMo | `https://aistudio.xiaomimimo.com` | ~~`https://mimo.xiaomi.com`~~ |

**检查方法**：查看 `src/main/oauth/adapters/<provider>.ts` 中的 `loginUrl`。

### 3. electron.vite.config.ts 修改

Docker 模式下 `electron-store` 和 `electron-updater` **必须外部化**（不能 bundle 进输出文件），因为它们在运行时由我们的 mock 替代：

```typescript
externalizeDepsPlugin({
  exclude: [
    'axios', '@koa/router', 'koa', 'koa-bodyparser', 'koa-router',
    'eventsource-parser', 'js-sha3', 'mime-types', 'zstd-codec'
    // ⚠️ 不要在这里放 electron-store 和 electron-updater
  ]
})
```

### 4. .gitignore 例外

`src/docker/` 下的 `.js` 文件是运行时 mock 文件，**必须提交到 Git**：

```gitignore
src/**/*.js          # 排除所有 src 下的 JS（TS 编译产物）
!src/docker/*.js     # 例外：Docker 运行时 JS 文件需要提交
```

### 5. 日志配置

Docker 模式默认增强日志配置：
- 请求日志保留量：**2000 条**（源码默认 200 条）
- 请求/响应内容记录：**开启**（源码默认关闭）
- 敏感数据脱敏：**开启**

### 6. Token 提取脚本

管理后台的 Token 提取脚本使用 `window.opener.postMessage()` 将 Token 从 Provider 弹窗回传到管理后台。关键限制：
- 浏览器同源策略阻止直接读取跨域 localStorage
- `navigator.clipboard` 在非 HTTPS 环境下不可用，需 fallback 到 `execCommand('copy')`
- `javascript:` 前缀在地址栏粘贴时会被浏览器吞掉，因此改用 F12 Console 方式

### 7. 测试账号功能

测试按钮会遍历该 Provider 的所有可用模型发送测试请求：
1. 获取 effective models → model mappings → 默认模型列表
2. 逐个模型发送 `"Hi"` 测试请求
3. 遇到 404 跳过，试下一个
4. **任一模型成功 = 账号正常**
5. 全部失败 = 显示最后一个错误

### 8. 上游同步冲突处理

```bash
# 如果 rebase 遇到冲突
git status                    # 查看冲突文件
vim <冲突文件>                 # 解决冲突
git add <已解决文件>
git rebase --continue
bash scripts/sync-upstream.sh  # 继续完成构建推送
```

最可能的冲突文件是 `electron.vite.config.ts`，解决方式：确保 `electron-store` 和 `electron-updater` 不在 `exclude` 列表中。

---

## Docker 管理后台功能清单

### 11 个页面

| 页面 | 功能 |
|------|------|
| 📊 仪表盘 | 服务状态、请求统计、每日趋势图、Provider 状态网格、代理控制 |
| 🏢 服务商 | 所有 Provider 卡片列表、启用/禁用切换、账号数统计 |
| 👤 账号管理 | 增删改查、验证凭证、清除 Provider 端聊天记录、测试可用性 |
| 🧩 模型管理 | 有效模型列表、添加/移除自定义模型 |
| 🔀 模型映射 | 请求模型→实际模型映射 CRUD |
| 💬 系统提示词 | 自定义提示词 CRUD、内置提示词查看 |
| 🔑 API 密钥 | 创建/删除、显示/隐藏、复制、启用/禁用 |
| 🗂️ 会话管理 | 会话列表、消息详情、删除/清空 |
| 📋 请求日志 | 卡片式详情、用户输入、AI 响应、错误信息、完整 body 展开 |
| 📝 系统日志 | 按级别筛选、时间排序 |
| ⚙️ 设置 | 上下文管理、工具调用、负载均衡、日志级别、数据导出/导入/清空 |

### 全局功能
- 深色模式 🌙
- 中英文切换 🌐
- F12 Console Token 提取 + postMessage 自动回填

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.9.1 | 2026-06-07 | 测试遍历所有模型，任一成功即通过 |
| 1.9.0 | 2026-06-07 | 多字段凭证（MiMo 3 字段）、账号测试按钮 |
| 1.8.3 | 2026-06-07 | 修复 MiMo 登录网址 |
| 1.8.2 | 2026-06-07 | 修复 DeepSeek/GLM/MiMo/Qwen 凭证字段名 |
| 1.8.1 | 2026-06-07 | 简化为 2 步添加账号、postMessage 自动回填 |
| 1.8.0 | 2026-06-07 | 书签一键 Token 提取 |
| 1.7.1 | 2026-06-07 | 修复复制功能、改用 F12 Console 方式 |
| 1.7.0 | 2026-06-07 | OAuth 回调重定向流程 |
| 1.6.3 | 2026-06-07 | postMessage Token 自动回填 |
| 1.6.2 | 2026-06-07 | Provider 弹窗登录 + API Key 显示/复制/启用禁用 |
| 1.6.1 | 2026-06-07 | 增强添加账号引导 + Token 提取脚本 |
| 1.6.0 | 2026-06-07 | Provider 管理、模型映射、数据导出导入、清除聊天 |
| 1.5.1 | 2026-06-07 | 请求日志增强（2000 条、含 body） |
| 1.5.0 | 2026-06-07 | 完整管理后台 9 页面 + 深色模式 + i18n |
| 1.4.0 | 2026-06-07 | 初始 Docker 版本 |
