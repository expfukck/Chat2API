/**
 * Docker standalone entry point (CommonJS)
 * Runs Chat2API proxy server without Electron GUI
 */

'use strict'

// Load the electron interceptor FIRST (before any other imports)
require('./electron-hook')

// Now we can safely import modules that depend on electron
const { storeManager } = require('../main/store/store')
const { ProxyServer } = require('../main/proxy/server')
const path = require('path')
const os = require('os')
const fs = require('fs')

// ==================== Configuration ====================

function getDockerConfig() {
  return {
    port: parseInt(process.env.CHAT2API_PORT || '8080', 10),
    host: process.env.CHAT2API_HOST || '0.0.0.0',
    logLevel: process.env.CHAT2API_LOG_LEVEL || 'info',
  }
}

// ==================== Import config from file ====================

async function importConfigFromEnv() {
  const configPath = process.env.CHAT2API_CONFIG_PATH || path.join(os.homedir(), '.chat2api', 'docker-config.json')

  if (!fs.existsSync(configPath)) return

  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
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
      console.log('[Docker] Imported ' + importData.accounts.length + ' accounts')
    }

    if (importData.apiKeys && Array.isArray(importData.apiKeys)) {
      storeManager.updateConfig({ apiKeys: importData.apiKeys, enableApiKey: true })
      console.log('[Docker] Imported ' + importData.apiKeys.length + ' API keys')
    }
  } catch (error) {
    console.error('[Docker] Failed to import config:', error)
  }
}

// ==================== Main ====================

async function main() {
  const config = getDockerConfig()

  console.log('╔══════════════════════════════════════════╗')
  console.log('║         Chat2API Docker Server           ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()

  // Ensure data directory exists
  const dataDir = path.join(os.homedir(), '.chat2api')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  // Initialize storage
  console.log('[Docker] Initializing storage...')
  await storeManager.initialize()

  // Import config from file if present
  await importConfigFromEnv()

  // Apply env overrides
  storeManager.updateConfig({
    logLevel: config.logLevel,
    autoStartProxy: true,
  })

  // Start proxy server
  console.log('[Docker] Starting proxy server on ' + config.host + ':' + config.port + '...')
  const proxyServer = new ProxyServer()
  const success = await proxyServer.start(config.port, config.host)

  if (success) {
    console.log()
    console.log('  Proxy server running at http://' + config.host + ':' + config.port)
    console.log()
    console.log('  Endpoints:')
    console.log('    POST /v1/chat/completions')
    console.log('    GET  /v1/models')
    console.log('    GET  /health')
    console.log()
    console.log('  Data directory: ' + dataDir)
    console.log()
  } else {
    console.error('  Failed to start proxy server')
    process.exit(1)
  }

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log('\n[Docker] Received ' + signal + ', shutting down...')
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
