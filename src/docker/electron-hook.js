/**
 * Electron module interceptor for Docker/Standalone mode.
 * Must be loaded via NODE_OPTIONS='--require ./src/docker/electron-hook.js'
 * 
 * This intercepts ALL require('electron') calls and redirects them to our mock.
 */

'use strict'

const Module = require('module')
const path = require('path')

// Store the original _resolveFilename
const originalResolveFilename = Module._resolveFilename

// Override module resolution
Module._resolveFilename = function (request, parent, isMain, options) {
  // Intercept 'electron' module
  if (request === 'electron') {
    // Return the path to our mock module
    return path.resolve(__dirname, 'electron-mock-runtime.js')
  }
  // Also intercept 'electron-store' to use our custom implementation
  if (request === 'electron-store') {
    return path.resolve(__dirname, 'store-mock-runtime.js')
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

console.log('[Docker Hook] Electron module interceptor loaded')
