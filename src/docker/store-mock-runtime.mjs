/**
 * electron-store mock for Docker mode (ESM)
 * Replaces the real electron-store package
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

class Store {
  constructor(options = {}) {
    const cwd = options.cwd || join(homedir(), '.chat2api')
    if (!existsSync(cwd)) mkdirSync(cwd, { recursive: true })

    const fileName = (options.name || 'data') + '.json'
    this.filePath = join(cwd, fileName)
    this.data = options.defaults ? JSON.parse(JSON.stringify(options.defaults)) : {}

    if (existsSync(this.filePath)) {
      try {
        const raw = readFileSync(this.filePath, 'utf-8')
        const existing = JSON.parse(raw)
        this._deepMerge(this.data, existing)
      } catch (error) {
        console.warn('[StoreMock] Failed to load data file, using defaults:', error.message)
      }
    }
  }

  _deepMerge(target, source) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {}
        }
        this._deepMerge(target[key], source[key])
      } else {
        target[key] = source[key]
      }
    }
  }

  get(key) {
    if (key === undefined) return this.data
    if (typeof key !== 'string') return this.data
    const keys = key.split('.')
    let obj = this.data
    for (const k of keys) {
      if (obj === undefined || obj === null) return undefined
      obj = obj[k]
    }
    return obj
  }

  set(key, value) {
    if (typeof key === 'object' && key !== null) {
      Object.assign(this.data, key)
    } else if (typeof key === 'string') {
      const keys = key.split('.')
      let obj = this.data
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') {
          obj[keys[i]] = {}
        }
        obj = obj[keys[i]]
      }
      obj[keys[keys.length - 1]] = value
    }
    this._save()
  }

  delete(key) {
    const keys = key.split('.')
    let obj = this.data
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) return
      obj = obj[keys[i]]
    }
    delete obj[keys[keys.length - 1]]
    this._save()
  }

  has(key) {
    return this.get(key) !== undefined
  }

  clear() {
    this.data = {}
    this._save()
  }

  get size() {
    return Object.keys(this.data).length
  }

  _save() {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (error) {
      console.error('[StoreMock] Failed to save:', error.message)
    }
  }
}

export default Store
