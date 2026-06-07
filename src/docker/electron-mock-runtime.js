/**
 * Electron API mock runtime (CommonJS)
 * Provides replacement for 'electron' module in Docker/Standalone mode
 */

'use strict'

const crypto = require('crypto')
const path = require('path')
const os = require('os')
const fs = require('fs')

// ==================== Encryption (replaces safeStorage) ====================

const ENCRYPTION_KEY = crypto.scryptSync('chat2api-docker-key-v1', 'salt', 32)
const IV_LENGTH = 16

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decrypt(encryptedText) {
  const parts = encryptedText.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts.slice(1).join(':')
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// ==================== Module Exports ====================

const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (data) => Buffer.from(encrypt(data)),
  decryptString: (buffer) => decrypt(buffer),
}

const app = {
  getVersion: () => process.env.npm_package_version || '1.4.0-docker',
  getPath: (name) => {
    const p = path.join(os.homedir(), '.chat2api')
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
    return p
  },
  getName: () => 'chat2api',
  isReady: () => true,
  on: () => {},
  quit: () => process.exit(0),
  relaunch: () => {},
  requestSingleInstanceLock: () => true,
  commandLine: { appendSwitch: () => {} },
  whenReady: () => Promise.resolve(),
}

class BrowserWindow {
  constructor() {
    this.webContents = { send: () => {}, on: () => {} }
  }
  isMinimized() { return false }
  show() {}
  restore() {}
  focus() {}
  destroy() {}
  on() {}
}

const ipcMain = {
  handle: () => {},
  on: () => {},
  removeHandler: () => {},
  removeAllListeners: () => {},
}

const shell = {
  openExternal: async () => {},
  openPath: async () => '',
}

const dialog = {
  showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  showSaveDialog: async () => ({ canceled: true, filePath: '' }),
  showMessageBox: async () => ({ response: 0 }),
  showErrorBox: () => {},
}

const Notification = class {
  constructor() {}
  show() {}
  on() {}
}

const Tray = class {
  constructor() {}
  setToolTip() {}
  setContextMenu() {}
  on() {}
  destroy() {}
}

const Menu = {
  buildFromTemplate: () => ({}),
  setApplicationMenu: () => {},
}

const nativeImage = {
  createFromPath: () => ({ isEmpty: () => true, resize: () => ({}) }),
  createEmpty: () => ({ isEmpty: () => true }),
}

const clipboard = {
  writeText: () => {},
  readText: () => '',
}

module.exports = {
  app,
  safeStorage,
  BrowserWindow,
  ipcMain,
  ipcRenderer: { send: () => {}, invoke: async () => {}, on: () => {} },
  shell,
  dialog,
  Notification,
  Tray,
  Menu,
  nativeImage,
  clipboard,
}
