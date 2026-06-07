/**
 * Docker standalone entry point (TypeScript)
 * Runs Chat2API proxy server without Electron GUI
 * Must be executed with: node --require ./src/docker/electron-hook.js -r tsx ./src/docker/index.ts
 */

import { storeManager } from '../main/store/store'
import { ProxyServer } from '../main/proxy/server'
import { generateManagementSecret } from '../main/proxy/middleware/managementAuth'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { createServer } from 'http'

// ==================== Configuration ====================

function getDockerConfig() {
  return {
    port: parseInt(process.env.CHAT2API_PORT || '18050', 10),
    host: process.env.CHAT2API_HOST || '0.0.0.0',
    logLevel: (process.env.CHAT2API_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    managementSecret: process.env.CHAT2API_MANAGEMENT_SECRET || '',
  }
}

// ==================== Import config from file ====================

async function importConfigFromEnv(): Promise<void> {
  const configPath = process.env.CHAT2API_CONFIG_PATH || join(homedir(), '.chat2api', 'docker-config.json')

  if (!existsSync(configPath)) return

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const importData = JSON.parse(raw)

    if (importData.config) {
      storeManager.updateConfig(importData.config)
      console.log('[Docker] Imported config from', configPath)
    }

    if (importData.accounts && Array.isArray(importData.accounts)) {
      for (const account of importData.accounts) {
        const existing = storeManager.getAccountById(account.id)
        if (existing) {
          storeManager.updateAccount(account.id, account)
        } else {
          storeManager.addAccount(account)
        }
      }
      console.log(`[Docker] Imported ${importData.accounts.length} accounts`)
    }

    if (importData.apiKeys && Array.isArray(importData.apiKeys)) {
      storeManager.updateConfig({ apiKeys: importData.apiKeys, enableApiKey: true })
      console.log(`[Docker] Imported ${importData.apiKeys.length} API keys`)
    }
  } catch (error) {
    console.error('[Docker] Failed to import config:', error)
  }
}

// ==================== Main ====================

async function main(): Promise<void> {
  const config = getDockerConfig()

  console.log('╔══════════════════════════════════════════╗')
  console.log('║         Chat2API Docker Server           ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()

  // Ensure data directory exists
  const dataDir = join(homedir(), '.chat2api')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  // Initialize storage
  console.log('[Docker] Initializing storage...')
  await storeManager.initialize()

  // Import config from file if present
  await importConfigFromEnv()

  // Apply env overrides
  const managementSecret = config.managementSecret || generateManagementSecret()
  storeManager.updateConfig({
    logLevel: config.logLevel,
    autoStartProxy: true,
    managementApi: {
      enableManagementApi: true,
      managementApiSecret: managementSecret,
    },
    // Enhanced request logging for Docker
    requestLogConfig: {
      enabled: true,
      maxEntries: 2000,
      includeBodies: true,
      maxBodyChars: 8000,
      redactSensitiveData: true,
    },
  })

  // Start proxy server
  console.log(`[Docker] Starting proxy server on ${config.host}:${config.port}...`)
  const proxyServer = new ProxyServer()
  const success = await proxyServer.start(config.port, config.host)

  if (success) {
    console.log()
    console.log(`  Proxy server running at http://${config.host}:${config.port}`)
    console.log()
    console.log('  API Endpoints:')
    console.log('    POST /v1/chat/completions')
    console.log('    GET  /v1/models')
    console.log('    GET  /health')
    console.log()
    console.log('  Management API:')
    console.log(`    Base URL:  http://${config.host}:${config.port}/v0/management`)
    console.log(`    Secret:    ${managementSecret}`)
    console.log(`    Example:   curl -H "Authorization: Bearer ${managementSecret}" http://localhost:${config.port}/v0/management/config`)
    console.log()
    if (!config.managementSecret) {
      console.log('  [TIP] Set CHAT2API_MANAGEMENT_SECRET env to use a fixed secret')
      console.log()
    }
    console.log('  Data directory:', dataDir)
    console.log()

    // Start Admin Web UI server + Extended API
    const adminPort = parseInt(process.env.CHAT2API_ADMIN_PORT || '18051', 10)
    const adminHtmlPath = join(__dirname, 'admin.html')
    if (existsSync(adminHtmlPath)) {
      const adminHtml = readFileSync(adminHtmlPath, 'utf-8')
      const { handleExtendedApi } = require('./extendedApi')
      const adminServer = createServer(async (req, res) => {
        const url = req.url || ''
        // Auth callback - receives token from provider site redirect
        if (url.startsWith('/auth/callback')) {
          const callbackHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Chat2API - Token 获取成功</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0fdf4}
.box{background:white;padding:40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);text-align:center;max-width:400px}
.icon{font-size:48px;margin-bottom:16px}h2{color:#16a34a;margin:0 0 8px}p{color:#666;font-size:14px}
.token{background:#f1f5f9;padding:8px 12px;border-radius:6px;font-family:monospace;font-size:12px;word-break:break-all;margin:12px 0;max-height:80px;overflow:auto}
.btn{display:inline-block;margin-top:12px;padding:8px 24px;background:#2563eb;color:white;border-radius:6px;text-decoration:none;font-size:14px}</style>
</head><body><div class="box">
<div class="icon">✅</div>
<h2>Token 获取成功！</h2>
<p>正在自动返回管理后台...</p>
<div class="token" id="t"></div>
<p id="status" style="color:#999;font-size:12px">如果未自动关闭，请手动关闭此窗口</p>
<a class="btn" href="/" onclick="return closeAndReturn()">返回管理后台</a>
</div>
<script>
var params = new URLSearchParams(location.search);
var token = params.get('token') || '';
var provider = params.get('provider') || '';
document.getElementById('t').textContent = token ? token.substring(0,60) + (token.length>60?'...':'') : '(empty)';
function closeAndReturn() {
  if (window.opener) {
    window.opener.postMessage({type:'chat2api-token',token:token,provider:provider}, '*');
    window.close();
  }
  return false;
}
// Auto send token and close after 1.5s
setTimeout(function() {
  if (window.opener && token) {
    window.opener.postMessage({type:'chat2api-token',token:token,provider:provider}, '*');
    try { window.close(); } catch(e) {}
  }
}, 1500);
</script></body></html>`
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(callbackHtml)
          return
        }
        // Extended API routes
        if (url.startsWith('/api/')) {
          req.url = url.replace('/api', '')
          const handled = await handleExtendedApi(req, res, managementSecret)
          if (!handled) {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, error: { message: 'Not found' } }))
          }
          return
        }
        // Serve admin HTML for everything else
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(adminHtml)
      })
      adminServer.listen(adminPort, config.host, () => {
        console.log(`  Web Admin UI:`)
        console.log(`    http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${adminPort}`)
        console.log()
      })
    }
  } else {
    console.error('  Failed to start proxy server')
    process.exit(1)
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Docker] Received ${signal}, shutting down...`)
    await proxyServer.stop()
    storeManager.flushPendingWrites()
    console.log('[Docker] Server stopped')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('uncaughtException', (error) => console.error('[Docker] Uncaught Exception:', error))
  process.on('unhandledRejection', (reason) => console.error('[Docker] Unhandled Rejection:', reason))
}

main().catch((error) => {
  console.error('[Docker] Fatal error:', error)
  process.exit(1)
})
