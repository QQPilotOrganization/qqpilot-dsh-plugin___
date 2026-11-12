// Client-half render smoke test: loads lib/client.js with a minimal React shim
// and renders the settings card for every tab. This catches prop/variable typos
// (e.g. `roundsDraft is not defined` / `helperPrograms is not defined`) without
// needing a browser.
//
// Run: node test/client-render.mjs

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
let captured = null
const sandbox = {
  window: {
    __ModuleLoader__: {
      load(module) {
        captured = module
      },
    },
    addEventListener() {},
    removeEventListener() {},
  },
  document: {
    head: { appendChild() {} },
    documentElement: {},
    createElement() {
      return { setAttribute() {}, parentNode: null }
    },
  },
  console,
}
vm.createContext(sandbox)
vm.runInContext(code, sandbox)
assert.ok(captured, 'client module registered itself')

const config = {
  mode: 'agent',
  compatibilityMode: false,
  provider: 'deepseek-official',
  model: 'deepseek-flash',
  providerOverride: '',
  modelOverride: '',
  reasoningEffort: '',
  modelSource: 'default',
  maxToolRounds: 4,
  extraInstructions: '',
  fallbackToCompat: true,
  dshTools: 'safe',
  maxDshToolCalls: 6,
  workspaceRoot: 'C:\\QQPilot\\data',
  effectiveWorkspace: 'C:\\QQPilot\\data',
  contextMode: 'all',
  enableGetChatName: false,
  enableUploadFiles: false,
}
const helperPrograms = {
  dir: 'C:\\QQPilot\\data',
  getChatName: { enabled: false, found: true, program: 'get_chat_name.exe' },
  uploadFiles: { enabled: false, found: false, program: 'UploadFiles.exe' },
}
const stats = { requests: 2, replies: 1, silences: 1, errors: 0, lastError: null, lastRequestAt: Date.now() }
const modelCatalog = {
  providers: [{ id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'deepseek-flash', name: 'Flash' }] }],
  defaultSelection: { provider: 'deepseek-official', model: 'deepseek-flash' },
  errors: [],
}

// Hook order of SettingsCard, including its final useRef.
const hookOrder = [
  'config', 'status', 'error', 'endpoint', 'stats', 'uptimeMs',
  'draft', 'saved', 'saving', 'notice', 'copied',
  'testText', 'testing', 'testResult', 'testError',
  'availableDshTools', 'toolsTest', 'toolsTesting', 'toolsError',
  'modelCatalog', 'modelProvider', 'modelModel', 'modelFollow', 'modelNotice',
  'helperPrograms', 'helperConfirm', 'helperNotice',
  'roundsDraft', 'workspaceDraft', 'workspaceNotice',
  'activeTab', 'activity', 'paused', 'activityStatus', 'activityError',
  'ref',
]

function renderSettings(tab) {
  let hookIndex = 0
  const values = {
    config,
    status: 'ok',
    error: null,
    endpoint: 'http://127.0.0.1:1/qqpilot/v1',
    stats,
    uptimeMs: 1000,
    draft: '',
    saved: '',
    saving: false,
    notice: null,
    copied: false,
    testText: '在吗',
    testing: false,
    testResult: null,
    testError: null,
    availableDshTools: ['read', 'web_search'],
    toolsTest: null,
    toolsTesting: false,
    toolsError: null,
    modelCatalog,
    modelProvider: 'deepseek-official',
    modelModel: 'deepseek-flash',
    modelFollow: true,
    modelNotice: null,
    helperPrograms,
    helperConfirm: null,
    helperNotice: null,
    roundsDraft: '4',
    workspaceDraft: '',
    workspaceNotice: null,
    activity: [],
    paused: false,
    activityStatus: 'ok',
    activityError: null,
  }
  const React = {
    createElement(type, props) {
      const children = Array.prototype.slice.call(arguments, 2)
      const merged = Object.assign({}, props || {})
      if (children.length === 1) merged.children = children[0]
      else if (children.length > 1) merged.children = children
      if (typeof type === 'function') return type(merged)
      return { type, props: merged }
    },
    useState(initial) {
      const key = hookOrder[hookIndex]
      hookIndex += 1
      const value = key === 'activeTab' ? tab : values[key]
      return [value === undefined ? initial : value, () => {}]
    },
    useEffect() {},
    useRef(initial) {
      hookIndex += 1
      return { current: initial }
    },
  }
  const registrations = []
  const exportsObj = captured.factory(function () {
    return React
  })
  exportsObj.apply({
    effect(fn) {
      return fn()
    },
    get() {
      return undefined
    },
    slots: {
      inject(name, callback) {
        return callback()
      },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      },
    },
  })
  const settings = registrations.find((entry) => entry.options.name === 'settings.section')
  assert.ok(settings, 'settings.section registered')
  return settings.component({})
}

const rendered = {}
for (const tab of ['overview', 'activity', 'settings']) {
  rendered[tab] = JSON.stringify(renderSettings(tab))
}
assert.ok(rendered.overview.includes('QQPilot 接入'), 'overview renders its header')
assert.ok(rendered.settings.includes('工具与工作区'), 'settings tab renders workspace card')
assert.ok(rendered.settings.includes('QQPilot 辅助程序（DLC）'), 'settings tab renders DLC card')
assert.ok(rendered.settings.includes('OCR 读取群名'), 'DLC card renders OCR row')
assert.ok(rendered.settings.includes('上传文件'), 'DLC card renders upload row')
console.log('CLIENT RENDER SMOKE PASS (overview / activity / settings)')
