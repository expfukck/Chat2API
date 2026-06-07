/**
 * Extended API routes for Docker admin panel
 * Provides endpoints missing from the Management API
 */

import { storeManager } from '../main/store/store'
import { Server, IncomingMessage, ServerResponse } from 'http'
import { DeepSeekAdapter } from '../main/proxy/adapters/deepseek'
import { GLMAdapter } from '../main/proxy/adapters/glm'
import { KimiAdapter } from '../main/proxy/adapters/kimi'
import { MimoAdapter } from '../main/proxy/adapters/mimo'
import { MiniMaxAdapter } from '../main/proxy/adapters/minimax'
import { PerplexityAdapter } from '../main/proxy/adapters/perplexity'
import { QwenAdapter } from '../main/proxy/adapters/qwen'
import { QwenAiAdapter } from '../main/proxy/adapters/qwen-ai'
import { ZaiAdapter } from '../main/proxy/adapters/zai'

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: string) => { body += chunk })
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}) }
      catch { resolve({}) }
    })
  })
}

function json(res: ServerResponse, data: any, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify({ success: true, data }))
}

function error(res: ServerResponse, message: string, status = 400) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify({ success: false, error: { message } }))
}

function getQuery(url: string): Record<string, string> {
  const params: Record<string, string> = {}
  const qs = url.split('?')[1]
  if (qs) qs.split('&').forEach(p => { const [k, v] = p.split('='); params[k] = decodeURIComponent(v || '') })
  return params
}

export async function handleExtendedApi(req: IncomingMessage, res: ServerResponse, secret: string): Promise<boolean> {
  // CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end()
    return true
  }

  // Auth check
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== secret) {
    error(res, 'Unauthorized', 401)
    return true
  }

  const url = req.url || ''
  const path = url.split('?')[0]
  const query = getQuery(url)

  try {
    // ==================== System Prompts ====================
    if (path === '/prompts' && req.method === 'GET') {
      json(res, storeManager.getSystemPrompts())
      return true
    }
    if (path === '/prompts' && req.method === 'POST') {
      const body = await parseBody(req)
      const prompt = storeManager.addSystemPrompt(body)
      json(res, prompt)
      return true
    }
    if (path.startsWith('/prompts/') && req.method === 'PUT') {
      const id = path.split('/')[2]
      const body = await parseBody(req)
      const result = storeManager.updateSystemPrompt(id, body)
      if (!result) return error(res, 'Not found or built-in prompt', 404), true
      json(res, result)
      return true
    }
    if (path.startsWith('/prompts/') && req.method === 'DELETE') {
      const id = path.split('/')[2]
      const ok = storeManager.deleteSystemPrompt(id)
      if (!ok) return error(res, 'Not found or built-in prompt', 404), true
      json(res, { deleted: true })
      return true
    }

    // ==================== Model Management ====================
    if (path.startsWith('/models/effective/') && req.method === 'GET') {
      const providerId = path.split('/')[3]
      json(res, storeManager.getEffectiveModels(providerId))
      return true
    }
    if (path.startsWith('/models/custom/') && req.method === 'POST') {
      const providerId = path.split('/')[3]
      const body = await parseBody(req)
      const models = storeManager.addCustomModel(providerId, body)
      json(res, models)
      return true
    }
    if (path.startsWith('/models/remove/') && req.method === 'POST') {
      const providerId = path.split('/')[3]
      const body = await parseBody(req)
      const models = storeManager.removeModel(providerId, body.modelName)
      json(res, models)
      return true
    }
    if (path.startsWith('/models/reset/') && req.method === 'POST') {
      const providerId = path.split('/')[3]
      const models = storeManager.resetModels(providerId)
      json(res, models)
      return true
    }

    // ==================== Account Extras ====================
    if (path.startsWith('/accounts/') && path.endsWith('/credits') && req.method === 'GET') {
      const id = path.split('/')[2]
      const account = storeManager.getAccountById(id, true)
      if (!account) return error(res, 'Account not found', 404), true
      // Return basic account info (actual credit check requires adapter)
      json(res, { id: account.id, providerId: account.providerId, name: account.name, status: account.status })
      return true
    }

    // ==================== Request Logs (detailed) ====================
    if (path === '/request-logs' && req.method === 'GET') {
      const limit = parseInt(query.limit || '50')
      const filter: any = {}
      if (query.status) filter.status = query.status
      if (query.providerId) filter.providerId = query.providerId
      json(res, storeManager.getRequestLogs(limit, filter))
      return true
    }
    if (path === '/request-logs/stats' && req.method === 'GET') {
      json(res, storeManager.getRequestLogStats())
      return true
    }
    if (path === '/request-logs/trend' && req.method === 'GET') {
      const days = parseInt(query.days || '7')
      json(res, storeManager.getRequestLogTrend(days))
      return true
    }
    if (path.startsWith('/request-logs/') && req.method === 'GET') {
      const id = path.split('/')[2]
      const log = storeManager.getRequestLogById(id)
      if (!log) return error(res, 'Not found', 404), true
      json(res, log)
      return true
    }

    // ==================== Statistics extras ====================
    if (path === '/statistics/daily' && req.method === 'GET') {
      json(res, storeManager.getTodayStatistics())
      return true
    }
    if (path === '/statistics/cleanup' && req.method === 'POST') {
      storeManager.cleanOldDailyStats()
      json(res, { cleaned: true })
      return true
    }

    // ==================== Log trend ====================
    if (path === '/logs/trend' && req.method === 'GET') {
      const days = parseInt(query.days || '7')
      json(res, storeManager.getLogTrend(days))
      return true
    }
    if (path === '/logs/stats' && req.method === 'GET') {
      json(res, storeManager.getLogStats())
      return true
    }
    if (path === '/logs/export' && req.method === 'GET') {
      const format = (query.format || 'json') as 'json' | 'txt'
      const data = storeManager.exportLogs(format)
      res.writeHead(200, {
        'Content-Type': format === 'json' ? 'application/json' : 'text/plain',
        'Content-Disposition': `attachment; filename="chat2api-logs.${format === 'json' ? 'json' : 'txt'}"`,
      })
      res.end(data)
      return true
    }

    // ==================== Clear Chats on Provider ====================
    if (path.startsWith('/accounts/') && path.endsWith('/clear-chats') && req.method === 'POST') {
      const id = path.split('/')[2]
      const account = storeManager.getAccountById(id, true)
      if (!account) return error(res, 'Account not found', 404), true
      const provider = storeManager.getProviderById(account.providerId)
      if (!provider) return error(res, 'Provider not found', 404), true

      const adapters: Record<string, any> = {
        deepseek: DeepSeekAdapter, glm: GLMAdapter, kimi: KimiAdapter,
        qwen: QwenAdapter, 'qwen-ai': QwenAiAdapter, minimax: MiniMaxAdapter,
        perplexity: PerplexityAdapter, zai: ZaiAdapter, mimo: MimoAdapter,
      }
      const AdapterClass = adapters[account.providerId]
      if (!AdapterClass) return error(res, `Clear chats not supported for ${account.providerId}`, 400), true

      const adapter = new AdapterClass(provider, account)
      const result = await adapter.deleteAllChats()
      json(res, { cleared: result })
      return true
    }

    // ==================== Data Export / Import ====================
    if (path === '/data/export' && req.method === 'GET') {
      const data = storeManager.exportData()
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="chat2api-backup.json"',
        'Access-Control-Allow-Origin': '*',
      })
      res.end(JSON.stringify(data, null, 2))
      return true
    }
    if (path === '/data/import' && req.method === 'POST') {
      const body = await parseBody(req)
      // Import config
      if (body.config) storeManager.updateConfig(body.config)
      // Import accounts
      if (body.accounts && Array.isArray(body.accounts)) {
        for (const acc of body.accounts) {
          const existing = storeManager.getAccountById(acc.id)
          if (existing) storeManager.updateAccount(acc.id, acc)
          else storeManager.addAccount(acc)
        }
      }
      // Import system prompts
      if (body.systemPrompts && Array.isArray(body.systemPrompts)) {
        for (const p of body.systemPrompts) {
          if (!p.isBuiltin) storeManager.addSystemPrompt(p)
        }
      }
      json(res, { imported: true })
      return true
    }
    if (path === '/data/clear' && req.method === 'POST') {
      storeManager.clearAll()
      json(res, { cleared: true })
      return true
    }

    // ==================== Session Config ====================
    if (path === '/sessions/config' && req.method === 'GET') {
      json(res, storeManager.getSessionConfig())
      return true
    }
    if (path === '/sessions/config' && req.method === 'PUT') {
      const body = await parseBody(req)
      const config = storeManager.updateSessionConfig(body)
      json(res, config)
      return true
    }
    if (path === '/sessions/active' && req.method === 'GET') {
      json(res, storeManager.getActiveSessions())
      return true
    }
    if (path === '/sessions/clean' && req.method === 'POST') {
      const count = storeManager.cleanExpiredSessions()
      json(res, { cleaned: count })
      return true
    }
    if (path.startsWith('/sessions/by-account/') && req.method === 'GET') {
      const accountId = path.split('/')[3]
      json(res, storeManager.getSessionsByAccountId(accountId))
      return true
    }
    if (path.startsWith('/sessions/by-provider/') && req.method === 'GET') {
      const providerId = path.split('/')[3]
      json(res, storeManager.getSessionsByProviderId(providerId))
      return true
    }

    // ==================== Provider Toggle ====================
    if (path.startsWith('/providers/') && path.endsWith('/toggle') && req.method === 'POST') {
      const id = path.split('/')[2]
      const provider = storeManager.getProviderById(id)
      if (!provider) return error(res, 'Provider not found', 404), true
      const updated = storeManager.updateProvider(id, { enabled: !provider.enabled })
      json(res, updated)
      return true
    }

    // Not handled
    return false
  } catch (e: any) {
    error(res, e.message || 'Internal error', 500)
    return true
  }
}
