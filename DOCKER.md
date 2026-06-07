# Chat2API Docker 部署指南

## 项目简介

Chat2API 是一个多平台 AI 服务统一管理工具，通过逆向各家 AI 的官方 Web UI，将其转换为标准的 OpenAI 兼容 API，实现零成本调用多种主流 AI 模型。

**支持的 AI Provider：**
- DeepSeek
- GLM（智谱清言）
- Kimi
- MiniMax
- Perplexity
- Qwen（通义千问）
- Z.ai

---

## 一、环境准备

### 1.1 系统要求

| 项目 | 最低要求 |
|------|----------|
| 操作系统 | Linux / macOS / Windows |
| CPU | 1 核 |
| 内存 | 512 MB |
| 磁盘 | 2 GB 可用空间 |
| 网络 | 能访问各 AI 平台 API |

### 1.2 安装 Docker

#### Linux (Ubuntu/Debian)

```bash
# 更新包索引
sudo apt-get update

# 安装依赖
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 设置仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 将当前用户加入 docker 组（免 sudo）
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker compose version
```

#### Linux (CentOS/RHEL)

```bash
# 安装依赖
sudo yum install -y yum-utils

# 添加仓库
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 安装 Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动并设置开机自启
sudo systemctl start docker
sudo systemctl enable docker

# 免 sudo
sudo usermod -aG docker $USER
newgrp docker
```

#### macOS

1. 下载 [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
2. 双击 `.dmg` 安装
3. 启动 Docker Desktop
4. 打开终端验证：`docker --version`

#### Windows

1. 安装 [WSL2](https://docs.microsoft.com/zh-cn/windows/wsl/install)（如未安装）
2. 下载 [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
3. 安装并启动 Docker Desktop
4. 打开 PowerShell 验证：`docker --version`

---

## 二、快速部署

### 2.1 创建部署目录

```bash
mkdir -p ~/chat2api && cd ~/chat2api
```

### 2.2 创建 docker-compose.yml

```yaml
services:
  chat2api:
    image: movemama/chat2api:latest
    container_name: chat2api
    restart: unless-stopped
    ports:
      - "18050:18050"
    environment:
      - CHAT2API_PORT=18050
      - CHAT2API_HOST=0.0.0.0
      - CHAT2API_LOG_LEVEL=info
      - NODE_ENV=production
      - TZ=Asia/Shanghai
    volumes:
      - ./data:/root/.chat2api
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:18050/health"]
      interval: 30s
      timeout: 10s
      start_period: 15s
      retries: 3
```

### 2.3 启动服务

```bash
docker compose up -d
```

### 2.4 验证运行状态

```bash
# 查看容器状态
docker ps --filter name=chat2api

# 查看日志
docker logs chat2api

# 测试健康检查
curl http://localhost:18050/health
```

预期输出：

```json
{
  "status": "running",
  "uptime": 12345,
  "statistics": {
    "totalRequests": 0,
    "successRequests": 0,
    "failedRequests": 0,
    "activeConnections": 0
  }
}
```

---

## 三、配置 AI 账号

### 3.1 配置文件方式（推荐）

在部署目录创建 `data/docker-config.json`：

```json
{
  "config": {
    "proxyPort": 18050,
    "proxyHost": "0.0.0.0",
    "loadBalanceStrategy": "round_robin",
    "logLevel": "info",
    "enableApiKey": true,
    "toolCallingConfig": {
      "enabled": true,
      "mode": "auto"
    }
  },
  "accounts": [
    {
      "id": "deepseek-1",
      "providerId": "deepseek",
      "name": "DeepSeek 账号 1",
      "status": "active",
      "credentials": {
        "userToken": "你的DeepSeek用户Token"
      },
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    },
    {
      "id": "kimi-1",
      "providerId": "kimi",
      "name": "Kimi 账号 1",
      "status": "active",
      "credentials": {
        "token": "你的Kimi JWT Token"
      },
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    }
  ],
  "apiKeys": [
    {
      "id": "key-1",
      "key": "sk-your-custom-api-key",
      "name": "默认密钥",
      "enabled": true,
      "createdAt": 1700000000000,
      "usageCount": 0
    }
  ]
}
```

配置完成后重启容器：

```bash
docker compose restart
```

### 3.2 获取各平台 Token 方法

#### DeepSeek

1. 访问 https://chat.deepseek.com 并登录
2. 按 `F12` 打开开发者工具
3. 进入 **Application** → **Local Storage** → `https://chat.deepseek.com`
4. 复制 `userToken` 的值（去掉引号）

#### Kimi

1. 访问 https://kimi.moonshot.cn 并登录
2. 按 `F12` 打开开发者工具
3. 进入 **Application** → **Local Storage** → `https://kimi.moonshot.cn`
4. 复制 `access_token` 的值

#### GLM（智谱清言）

1. 访问 https://chatglm.cn 并登录
2. 按 `F12` 打开开发者工具
3. 进入 **Application** → **Local Storage**
4. 复制 `refresh_token` 的值

#### Qwen（通义千问）

1. 访问 https://tongyi.aliyun.com 并登录
2. 按 `F12` 打开开发者工具
3. 进入 **Application** → **Cookies**
4. 复制 `tongyi_sso_ticket` 的值

#### MiniMax

1. 访问 https://chat.minimaxi.com 并登录
2. 按 `F12` 打开开发者工具
3. 进入 **Application** → **Local Storage**
4. 复制相关 JWT Token

---

## 四、API 使用

### 4.1 端点列表

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | 对话补全（OpenAI 兼容） |
| `/v1/models` | GET | 获取可用模型列表 |
| `/v1/models/:model` | GET | 获取指定模型信息 |
| `/health` | GET | 健康检查 |
| `/stats` | GET | 请求统计 |

### 4.2 调用示例

#### cURL

```bash
curl http://localhost:18050/v1/chat/completions \
  -H "Authorization: Bearer sk-your-custom-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [
      {"role": "user", "content": "你好，请介绍一下自己"}
    ]
  }'
```

#### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-custom-api-key",
    base_url="http://localhost:18050/v1"
)

response = client.chat.completions.create(
    model="deepseek-v4-flash",
    messages=[
        {"role": "user", "content": "你好"}
    ]
)

print(response.choices[0].message.content)
```

#### Node.js

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-custom-api-key',
  baseURL: 'http://localhost:18050/v1',
});

const response = await client.chat.completions.create({
  model: 'deepseek-v4-flash',
  messages: [{ role: 'user', content: '你好' }],
});

console.log(response.choices[0].message.content);
```

### 4.3 可用模型

| Provider | 模型名称 |
|----------|----------|
| DeepSeek | `deepseek-v4-flash`, `deepseek-v4-pro` |
| GLM | `GLM-5.1` |
| Kimi | `Kimi-K2.6` |
| MiniMax | `MiniMax-M2.7` |
| Qwen | `Qwen3.6`, `Qwen3.7-Max`, `Qwen3-Coder` |

---

## 五、Web Admin 管理后台

### 5.1 访问地址

启动后，Web Admin 自动运行在独立端口：

```
http://localhost:18051
```

### 5.2 登录

打开浏览器访问 `http://localhost:18051`，输入：

- **Management Secret**：`CHAT2API_MANAGEMENT_SECRET` 环境变量的值
- **API Base URL**：`http://localhost:18050`（默认已填）

### 5.3 功能页面

| 页面 | 功能 |
|------|------|
| Dashboard | 服务状态、请求统计、代理控制（Start/Stop/Restart） |
| Accounts | 添加/删除 AI 账号（DeepSeek、Kimi、GLM、Qwen 等） |
| API Keys | 创建/删除访问密钥 |
| Logs | 查看系统日志（按级别筛选） |

---

## 六、Management API（后台管理接口）

### 5.1 认证方式

Management API 默认已启用，使用 Bearer Token 认证：

```bash
# 认证方式一：Authorization Header
curl -H "Authorization: Bearer mgmt_your_secret" http://localhost:18050/v0/management/health

# 认证方式二：X-Management-Secret Header
curl -H "X-Management-Secret: mgmt_your_secret" http://localhost:18050/v0/management/health
```

**Secret 配置：**
- 通过环境变量 `CHAT2API_MANAGEMENT_SECRET` 设置固定 Secret
- 如不设置，每次启动会自动生成随机 Secret（查看 `docker logs chat2api`）

### 5.2 端点列表

所有端点前缀：`/v0/management`

#### 健康检查与统计

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查（代理状态、组件状态） |
| `GET` | `/statistics` | 使用统计（请求数、延迟、模型用量） |
| `GET` | `/logs` | 分页日志（参数：`page`, `limit`, `level`） |

#### 配置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/config` | 获取完整配置（敏感值已脱敏） |
| `PUT` | `/config` | 更新配置（部分更新） |
| `GET` | `/config/:key` | 获取单个配置项 |
| `PUT` | `/config/:key` | 更新单个配置项 |

#### Provider 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/providers` | 列出所有 Provider |
| `GET` | `/providers/:id` | 获取指定 Provider |
| `POST` | `/providers` | 创建 Provider |
| `PUT` | `/providers/:id` | 更新 Provider |
| `DELETE` | `/providers/:id` | 删除 Provider |
| `PATCH` | `/providers/:id/status` | 启用/禁用 Provider |

#### 账号管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/accounts` | 列出所有账号（凭证已脱敏） |
| `GET` | `/accounts/:id` | 获取指定账号 |
| `GET` | `/providers/:providerId/accounts` | 按 Provider 查询账号 |
| `POST` | `/accounts` | 创建账号 |
| `PUT` | `/accounts/:id` | 更新账号 |
| `DELETE` | `/accounts/:id` | 删除账号 |
| `POST` | `/accounts/:id/validate` | 验证账号凭证有效性 |

#### API Key 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api-keys` | 列出所有 API Key |
| `POST` | `/api-keys` | 创建 API Key（仅显示一次） |
| `PUT` | `/api-keys/:id` | 更新 Key 元数据 |
| `DELETE` | `/api-keys/:id` | 删除 API Key |
| `POST` | `/api-keys/:id/regenerate` | 重新生成 Key（仅显示一次） |

#### 模型映射

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/model-mappings` | 列出所有映射 |
| `POST` | `/model-mappings` | 创建映射 |
| `PUT` | `/model-mappings/:model` | 更新映射 |
| `DELETE` | `/model-mappings/:model` | 删除映射 |

#### 会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/sessions` | 列出活跃会话 |
| `GET` | `/sessions/:id` | 查看会话详情（含消息历史） |
| `DELETE` | `/sessions/:id` | 删除指定会话 |
| `DELETE` | `/sessions` | 清空所有会话（需 `{ "confirm": true }`） |

#### 代理控制

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/proxy/start` | 启动代理服务 |
| `POST` | `/proxy/stop` | 停止代理服务 |
| `POST` | `/proxy/restart` | 重启代理服务 |
| `GET` | `/proxy/status` | 获取代理运行状态 |

### 5.3 使用示例

```bash
SECRET="mgmt_chat2api_docker_secret_2026"
BASE="http://localhost:18050/v0/management"

# 健康检查
curl -s -H "Authorization: Bearer $SECRET" $BASE/health | python3 -m json.tool

# 查看配置
curl -s -H "Authorization: Bearer $SECRET" $BASE/config | python3 -m json.tool

# 添加 DeepSeek 账号
curl -s -X POST $BASE/accounts \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "deepseek",
    "name": "My DeepSeek",
    "status": "active",
    "credentials": {
      "userToken": "your-token-here"
    }
  }'

# 列出所有账号
curl -s -H "Authorization: Bearer $SECRET" $BASE/accounts | python3 -m json.tool

# 验证账号有效性
curl -s -X POST $BASE/accounts/ACCOUNT_ID/validate \
  -H "Authorization: Bearer $SECRET"

# 创建 API Key
curl -s -X POST $BASE/api-keys \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"name": "production-key"}'

# 查看统计
curl -s -H "Authorization: Bearer $SECRET" $BASE/statistics | python3 -m json.tool

# 查看日志（第2页，每页20条）
curl -s -H "Authorization: Bearer $SECRET" "$BASE/logs?page=2&limit=20" | python3 -m json.tool

# 重启代理服务
curl -s -X POST $BASE/proxy/restart \
  -H "Authorization: Bearer $SECRET"
```

---

## 六、环境变量说明

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `CHAT2API_PORT` | `18050` | 代理监听端口 |
| `CHAT2API_HOST` | `0.0.0.0` | 监听地址 |
| `CHAT2API_LOG_LEVEL` | `info` | 日志级别：`debug`/`info`/`warn`/`error` |
| `CHAT2API_MANAGEMENT_SECRET` | 自动生成 | Management API 认证密钥 |
| `CHAT2API_ADMIN_PORT` | `18051` | Web Admin 管理后台端口 |
| `CHAT2API_CONFIG_PATH` | `/root/.chat2api/docker-config.json` | 配置文件路径 |
| `NODE_ENV` | `production` | 运行环境 |
| `TZ` | `Asia/Shanghai` | 时区 |

---

## 六、常用运维命令

### 6.1 容器管理

```bash
# 启动
docker compose up -d

# 停止
docker compose down

# 重启
docker compose restart

# 查看状态
docker ps --filter name=chat2api

# 查看日志
docker logs chat2api
docker logs -f chat2api          # 实时跟踪
docker logs --tail 100 chat2api  # 最后 100 行
```

### 6.2 更新镜像

```bash
# 拉取最新镜像
docker compose pull

# 重新创建容器（数据不丢失）
docker compose up -d
```

### 6.3 数据管理

```bash
# 查看数据目录
ls -la ./data/

# 备份数据
tar -czf chat2api-backup-$(date +%Y%m%d).tar.gz ./data/

# 恢复数据
tar -xzf chat2api-backup-20260607.tar.gz
docker compose restart

# 查看配置文件
cat ./data/data.json | python3 -m json.tool
```

### 6.4 资源监控

```bash
# 查看容器资源占用
docker stats chat2api

# 查看磁盘占用
docker system df
```

---

## 七、高级配置

### 7.1 反向代理 (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:18050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 流式响应支持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

### 7.2 多账号负载均衡

在 `docker-config.json` 中添加多个同 Provider 的账号，系统会自动轮询：

```json
{
  "accounts": [
    {
      "id": "deepseek-1",
      "providerId": "deepseek",
      "name": "账号1",
      "status": "active",
      "credentials": { "userToken": "token1" }
    },
    {
      "id": "deepseek-2",
      "providerId": "deepseek",
      "name": "账号2",
      "status": "active",
      "credentials": { "userToken": "token2" }
    }
  ]
}
```

支持的负载均衡策略（`loadBalanceStrategy`）：

| 策略 | 说明 |
|------|------|
| `round_robin` | 轮询分配（默认） |
| `fill_first` | 填满一个账号再用下一个 |
| `failover` | 故障自动切换 |

### 7.3 Function Calling（工具调用）

在 `config` 中启用：

```json
{
  "config": {
    "toolCallingConfig": {
      "enabled": true,
      "mode": "auto"
    }
  }
}
```

支持的模式：
- `off` - 关闭
- `auto` - 自动检测是否需要调用工具
- `force` - 强制调用工具

---

## 八、故障排查

### 8.1 容器启动失败

```bash
# 查看详细日志
docker logs chat2api

# 检查端口是否被占用
netstat -tlnp | grep 18050

# 检查 Docker 状态
docker info
```

### 8.2 API 调用无响应

```bash
# 检查容器是否运行
docker ps --filter name=chat2api

# 检查健康状态
curl http://localhost:18050/health

# 检查账号是否配置
cat ./data/data.json | grep -A5 accounts
```

### 8.3 Token 失效

各平台 Token 有效期不同，失效后需重新获取并更新配置：

```bash
# 编辑配置文件
vim ./data/data.json

# 重启容器
docker compose restart
```

### 8.4 网络问题

```bash
# 进入容器测试网络
docker exec -it chat2api sh

# 测试外部连通性
wget -qO- https://chat.deepseek.com
```

---

## 九、目录结构

```
~/chat2api/
├── docker-compose.yml          # Docker Compose 配置
├── docker-config.json          # 可选：初始配置（首次启动后合并到 data.json）
└── data/                       # 数据持久化目录（自动创建）
    ├── data.json               # 主数据文件（配置、账号、Provider）
    ├── logs/                   # 应用日志
    │   └── app.log
    └── request-logs/           # 请求日志
        └── requests.log
```

---

## 十、安全建议

1. **启用 API Key 认证**：在配置中设置 `enableApiKey: true`
2. **使用反向代理**：配合 Nginx + SSL 提供 HTTPS
3. **限制访问 IP**：通过防火墙或 Nginx 限制来源 IP
4. **定期备份数据**：备份 `./data/` 目录
5. **及时更新 Token**：Token 过期前及时更换

---

## 十一、相关链接

- 项目源码：https://github.com/xiaoY233/Chat2API
- Docker 镜像：https://hub.docker.com/r/movemama/chat2api
- 官方文档：https://chat2api-doc.vercel.app/

---

## 更新日志

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.4.2 | 2026-06-07 | 新增 Web Admin 管理后台 (http://localhost:18051) |
| 1.4.1 | 2026-06-07 | 启用 Management API，数据 bind mount 持久化 |
| 1.4.0 | 2026-05-27 | 初始 Docker 版本 |
