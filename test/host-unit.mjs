// Lead-owned offline smoke test for the host half of qqpilot-dsh-plugin.
// Loads lib/index.js with a fake Cordis context (fake webServer + fake llm),
// invokes the registered HTTP routes directly, and asserts the OpenAI-shaped
// responses. Run: node test/host-unit.mjs
//
// This file is owned by the Lead; do not edit it from another task.

import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

// Keep the plugin's settings state inside the workspace so the offline test
// does not need access to the real ~/.dsh.
const STATE_DIR = path.join(process.cwd(), '.tmp-test-state')
rmSync(STATE_DIR, { recursive: true, force: true })
mkdirSync(STATE_DIR, { recursive: true })
process.env.DSH_HOME = STATE_DIR

const { apply } = await import('../lib/index.js')

function makeReq(method, body, url) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  req.destroy = () => {}
  process.nextTick(() => {
    if (body !== undefined) req.emit('data', Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)))
    req.emit('end')
  })
  return req
}

function makeRes() {
  const res = new EventEmitter()
  res.statusCode = 200
  res.headers = {}
  res.chunks = []
  res.writableEnded = false
  res.writeHead = (status, headers) => {
    res.statusCode = status
    res.headers = headers || {}
  }
  res.end = (chunk) => {
    if (chunk) res.chunks.push(Buffer.from(chunk))
    res.writableEnded = true
  }
  res.json = () => JSON.parse(Buffer.concat(res.chunks).toString('utf8'))
  return res
}

function toolCallChunks(id, name, args) {
  return [
    { type: 'block-start', index: 0, blockType: 'tool-call' },
    { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: JSON.stringify(args) },
    { type: 'block-end', index: 0, block: { type: 'tool-call', id, name, arguments: JSON.stringify(args) } },
    { type: 'usage', usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 } },
    { type: 'finish', reason: { kind: 'tool-calls' } },
  ]
}

function textChunks(text) {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'usage', usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

// Each scenario supplies a script: an array of steps; every model call consumes one step.
function makeLlm(script) {
  const state = { calls: [], index: 0 }
  return {
    state,
    listProviders() {
      return [
        { id: 'deepseek-official', name: 'DeepSeek' },
        { id: 'llamacpp', name: 'llama.cpp' },
      ]
    },
    listModels(provider) {
      if (provider === 'llamacpp') return Promise.resolve([{ provider, id: 'MiniCPM5-1B-F16.gguf', name: 'MiniCPM5' }])
      return Promise.resolve([{ provider, id: 'deepseek-flash', name: 'DeepSeek Flash' }])
    },
    stream(options) {
      state.calls.push(options)
      const step = script[Math.min(state.index, script.length - 1)]
      state.index += 1
      return (async function* () {
        for (const chunk of step) yield chunk
      })()
    },
  }
}

async function loadPlugin(script, initialState) {
  // Each scenario starts from clean persisted state.
  rmSync(STATE_DIR, { recursive: true, force: true })
  mkdirSync(STATE_DIR, { recursive: true })
  if (initialState) {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(path.join(STATE_DIR, 'qqpilot-dsh-plugin.json'), JSON.stringify(initialState), 'utf8')
  }
  const llm = makeLlm(script)
  const toolExecutions = []
  const agentCreations = []
  const workspaceSets = []
  const fakeWorkingDirectory = {
    defaultDirectory: process.cwd(),
    get() {
      return process.cwd()
    },
    set(agent, target) {
      workspaceSets.push({ agent, target })
      return Promise.resolve(target)
    },
  }
  const fakeAgents = {
    get() {
      return undefined
    },
    async create(options) {
      agentCreations.push(options)
      return { agent: { id: options.sessionId } }
    },
    async resume() {
      return { agent: { id: 'qqpilot-bridge' } }
    },
  }
  const fakeTools = {
    schemas(scope) {
      return [
        {
          name: 'web_search',
          description: 'Search the web',
          parameters: { type: 'object', properties: { queries: { type: 'array', items: { type: 'string' } } }, additionalProperties: false },
        },
        {
          name: 'read',
          description: 'Read a file',
          parameters: { type: 'object', properties: { file_path: { type: 'string' } }, additionalProperties: false },
        },
        {
          name: 'pwsh',
          description: 'Run shell (denied by default)',
          parameters: { type: 'object', properties: { command: { type: 'string' } }, additionalProperties: false },
        },
      ]
    },
    execute(input) {
      if (Array.isArray(input.calls)) {
        const call = input.calls[0]
        toolExecutions.push({ ...call, arguments: JSON.parse(call.arguments), agent: input.agent })
        return {
          results: [
            {
              callId: call.id,
              result: {
                isError: false,
                value: { ok: true },
                content: [{ type: 'text', text: `搜索结果(${call.name}): 今日新闻标题` }],
              },
            },
          ],
          additionalContexts: [],
          concluded: false,
        }
      }
      toolExecutions.push(input)
      return { isError: false, value: { ok: true }, content: [{ type: 'text', text: `搜索结果(${input.name}): 今日新闻标题` }] }
    },
    setExecutor() {
      return () => {}
    },
  }
  const routes = new Map()
  const ctx = {
    get(name) {
      if (name === 'llm') return llm
      if (name === 'tools') return fakeTools
      if (name === 'agents') return fakeAgents
      if (name === 'workingDirectory') return fakeWorkingDirectory
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-flash' }) }
      return undefined
    },
    webServer: {
      getOrigin: () => 'http://127.0.0.1:12345',
      register: (route) => {
        assert.ok(!routes.has(route.path), `duplicate route ${route.path}`)
        routes.set(route.path, route.handler)
        return () => routes.delete(route.path)
      },
    },
    effect: (fn) => {
      const disposer = fn()
      assert.equal(typeof disposer, 'function')
      return disposer
    },
  }
  apply(ctx, {})
  return { llm, routes, toolExecutions, agentCreations, workspaceSets }
}

async function post(routes, path, body) {
  const handler = routes.get(path)
  assert.ok(handler, `route ${path} registered`)
  const req = makeReq('POST', body)
  const res = makeRes()
  await handler(req, res)
  return { status: res.statusCode, body: res.json() }
}

async function get(routes, path, query) {
  const handler = routes.get(path)
  assert.ok(handler, `route ${path} registered`)
  const req = makeReq('GET', undefined, query ? `${path}?${query}` : path)
  const res = makeRes()
  await handler(req, res)
  return { status: res.statusCode, body: res.json() }
}

function qqpilotBody(userText) {
  return {
    model: 'qwen3.5:0.8b',
    stream: false,
    messages: [
      { role: 'system', content: '你的名字是猫娘 neko，只输出发言内容。' },
      { role: 'user', content: '[time]\n2026-07-12T10:54:54+08:00\n\n[username]\nAlice\n\n[content]\n' + userText },
    ],
  }
}

function multiUserBody() {
  return {
    model: 'qwen3.5:0.8b',
    stream: false,
    messages: [
      { role: 'system', content: '你的名字是猫娘 neko，正在与多位用户同时交互。' },
      { role: 'user', content: '[time]\n11-09 20:19:59\n\n [username] \n 绿叶 \n\n [content] \n 万一呢' },
      { role: 'assistant', content: '别试，容易被骗' },
      { role: 'user', content: '[time]\n11-09 20:41:13\n\n [username] \n baiyan \n\n [content] \n [凑近]' },
      { role: 'assistant', content: '干嘛' },
      { role: 'user', content: '[time]\n11-09 20:46:13\n\n [username] \n 123 \n\n [content] \n @neko 群里禁止乞讨' },
    ],
  }
}

let failures = 0
async function scenario(name, fn) {
  try {
    await fn()
    console.log(`PASS  ${name}`)
  } catch (err) {
    failures += 1
    console.log(`FAIL  ${name}`)
    console.log(err && err.stack ? err.stack : err)
  }
}

await scenario('routes registered and models route works', async () => {
  const { routes } = await loadPlugin([textChunks('ok')])
  for (const path of [
    '/qqpilot/v1/chat/completions',
    '/qqpilot/v1/models',
    '/qqpilot/api/config',
    '/qqpilot/api/test',
    '/qqpilot/api/status',
    '/qqpilot/api/activity',
    '/qqpilot/api/models',
  ]) {
    assert.ok(routes.has(path), `missing ${path}`)
  }
  const models = await get(routes, '/qqpilot/v1/models')
  assert.equal(models.status, 200)
  assert.equal(models.body.data[0].id, 'deepseek-flash')
  const cfg = await get(routes, '/qqpilot/api/config')
  assert.equal(cfg.body.config.mode, 'agent')
  assert.equal(typeof cfg.body.startedAt, 'number')
  assert.equal(typeof cfg.body.uptimeMs, 'number')
})

await scenario('tool mode: reply tool call becomes OpenAI completion text', async () => {
  const { routes, llm } = await loadPlugin([toolCallChunks('call_1', 'qqpilot_reply', { text: '你好呀喵～' })])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('在吗'))
  assert.equal(result.status, 200)
  assert.equal(result.body.object, 'chat.completion')
  assert.equal(result.body.choices[0].message.role, 'assistant')
  assert.equal(result.body.choices[0].message.content, '你好呀喵～')
  assert.equal(result.body.choices[0].finish_reason, 'stop')
  assert.equal(result.body.usage.total_tokens, 18)
  assert.equal(llm.state.calls.length, 1, 'one model call for a single tool decision')
  assert.ok(Array.isArray(llm.state.calls[0].tools), 'tools passed to the model')
  const pushedTools = llm.state.calls[0].tools.map((t) => t.name)
  assert.ok(pushedTools.includes('qqpilot_reply'))
  assert.ok(pushedTools.includes('qqpilot_do_not_reply'))
  // Instruction and QQPilot persona share ONE system message.
  const systems = llm.state.calls[0].messages.filter((m) => m.role === 'system')
  assert.equal(systems.length, 1, 'a single system message')
  assert.ok(systems[0].content[0].text.includes('qqpilot_reply'))
  assert.ok(systems[0].content[0].text.includes('猫娘 neko'))
  // User message carried through with the QQPilot framing.
  const user = llm.state.calls[0].messages.find((m) => m.role === 'user')
  assert.ok(user.content[0].text.includes('在吗'))
})

await scenario('tool mode: silence tool call returns empty content', async () => {
  const { routes } = await loadPlugin([toolCallChunks('call_2', 'qqpilot_do_not_reply', { reason: '闲聊' })])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('哈哈哈'))
  assert.equal(result.status, 200)
  assert.equal(result.body.choices[0].message.content, '')
})

await scenario('tool mode: plain text fallback still surfaces a reply', async () => {
  const { routes } = await loadPlugin([textChunks('直接说一句')])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('你好'))
  assert.equal(result.status, 200)
  assert.equal(result.body.choices[0].message.content, '直接说一句')
})

await scenario('tool mode: reply with data URL image returns images array', async () => {
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const { routes } = await loadPlugin([toolCallChunks('call_3', 'qqpilot_reply', { text: '给你图', images: [png] })])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('来张图'))
  assert.equal(result.status, 200)
  const message = result.body.choices[0].message
  assert.equal(message.content, '给你图')
  assert.equal(message.images.length, 1)
  assert.ok(message.images[0].image_url.url.startsWith('data:image/png;base64,'))
})

await scenario('agent mode exposes safe DSH tools and executes them', async () => {
  const { routes, llm, toolExecutions, agentCreations } = await loadPlugin([
    toolCallChunks('call_ws', 'web_search', { queries: ['今日新闻'] }),
    toolCallChunks('call_r', 'qqpilot_reply', { text: '根据搜索：今日新闻标题' }),
  ])
  const cfg = await get(routes, '/qqpilot/api/config')
  assert.deepEqual([...cfg.body.availableDshTools].sort(), ['read', 'web_search'])
  assert.equal(cfg.body.config.dshTools, 'safe')
  assert.equal(agentCreations.length, 1, 'a dedicated bridge agent supplies the tool scope')
  assert.equal(agentCreations[0].sessionId, 'qqpilot-bridge')
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('搜一下今日新闻'))
  assert.equal(result.status, 200)
  assert.equal(result.body.choices[0].message.content, '根据搜索：今日新闻标题')
  assert.equal(llm.state.calls.length, 2, 'one tool round plus the reply round')
  const toolNames = llm.state.calls[0].tools.map((tool) => tool.name)
  assert.ok(toolNames.includes('qqpilot_reply'))
  assert.ok(toolNames.includes('qqpilot_do_not_reply'))
  assert.ok(toolNames.includes('web_search'))
  assert.ok(toolNames.includes('read'))
  assert.ok(!toolNames.includes('pwsh'), 'dangerous tool denied by default')
  assert.equal(toolExecutions.length, 1)
  assert.equal(toolExecutions[0].name, 'web_search')
  assert.deepEqual(toolExecutions[0].arguments, { queries: ['今日新闻'] })
  assert.ok(toolExecutions[0].agent && toolExecutions[0].agent.id === 'qqpilot-bridge', 'tool runs in the bridge agent scope')
  const secondMessages = llm.state.calls[1].messages
  const toolMessage = secondMessages.find((message) => message.role === 'tool')
  assert.ok(toolMessage, 'tool result was fed back to the model')
  assert.ok(toolMessage.content[0].text.includes('搜索结果'))
  const feed = await get(routes, '/qqpilot/api/activity', 'since=0')
  assert.deepEqual(feed.body.activity[0].tools, ['web_search'])
})

await scenario('dshTools off withholds every DSH tool', async () => {
  const { routes, llm } = await loadPlugin([textChunks('直接回答')])
  const set = await post(routes, '/qqpilot/api/config', { dshTools: 'off' })
  assert.equal(set.body.config.dshTools, 'off')
  assert.deepEqual(set.body.availableDshTools, [])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('你好'))
  assert.equal(result.body.choices[0].message.content, '直接回答')
  assert.deepEqual(
    llm.state.calls[0].tools.map((tool) => tool.name),
    ['qqpilot_reply', 'qqpilot_do_not_reply'],
  )
})

await scenario('unknown tool calls are rejected without execution', async () => {
  const { routes, toolExecutions } = await loadPlugin([
    toolCallChunks('call_bad', 'not_a_real_tool', {}),
    toolCallChunks('call_r2', 'qqpilot_reply', { text: '好的' }),
  ])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('试试'))
  assert.equal(result.body.choices[0].message.content, '好的')
  assert.equal(toolExecutions.length, 0)
})

await scenario('tool mode: empty [[NEXT]] segments are collapsed', async () => {
  const { routes } = await loadPlugin([
    toolCallChunks('call_next', 'qqpilot_reply', { text: '第一句[[NEXT]][[NEXT]]  第二句[[NEXT]]' }),
  ])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('分两条'))
  assert.equal(result.body.choices[0].message.content, '第一句[[NEXT]]第二句')
})

await scenario('tool mode: reply containing only [[NEXT]] becomes silence', async () => {
  const { routes } = await loadPlugin([toolCallChunks('call_empty', 'qqpilot_reply', { text: '[[NEXT]]' })])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('在吗'))
  assert.equal(result.body.choices[0].message.content, '')
})

await scenario('model catalog and provider/model override', async () => {
  const { routes, llm } = await loadPlugin([textChunks('指定模型回复')])
  const catalog = await get(routes, '/qqpilot/api/models')
  assert.equal(catalog.status, 200)
  assert.deepEqual(
    catalog.body.providers.map((provider) => provider.id).sort(),
    ['deepseek-official', 'llamacpp'],
  )
  assert.equal(catalog.body.defaultSelection.provider, 'deepseek-official')
  const set = await post(routes, '/qqpilot/api/config', { provider: 'llamacpp', model: 'MiniCPM5-1B-F16.gguf' })
  assert.equal(set.body.config.providerOverride, 'llamacpp')
  assert.equal(set.body.config.modelOverride, 'MiniCPM5-1B-F16.gguf')
  assert.equal(set.body.config.modelSource, 'override')
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('你好'))
  assert.equal(result.body.choices[0].message.content, '指定模型回复')
  assert.equal(llm.state.calls[0].provider, 'llamacpp')
  assert.equal(llm.state.calls[0].model, 'MiniCPM5-1B-F16.gguf')
  const reset = await post(routes, '/qqpilot/api/config', { provider: '', model: '' })
  assert.equal(reset.body.config.modelSource, 'default')
  assert.equal(reset.body.config.provider, 'deepseek-official')
})

await scenario('tool mode: text array becomes multiple [[NEXT]] messages', async () => {
  const { routes } = await loadPlugin([
    toolCallChunks('call_multi', 'qqpilot_reply', { text: ['第一句话', '第二句话', '第三句话'] }),
  ])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('多说几句'))
  assert.equal(result.status, 200)
  assert.equal(result.body.choices[0].message.content, '第一句话[[NEXT]]第二句话[[NEXT]]第三句话')
  const feed = await get(routes, '/qqpilot/api/activity', 'since=0')
  assert.equal(feed.body.activity[0].messages, 3)
})

await scenario('tool mode: mixed array and [[NEXT]] markers flatten to messages', async () => {
  const { routes } = await loadPlugin([
    toolCallChunks('call_mix', 'qqpilot_reply', { text: ['第一段[[NEXT]]第二段', '   ', '第三段'] }),
  ])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('再来'))
  assert.equal(result.status, 200)
  assert.equal(result.body.choices[0].message.content, '第一段[[NEXT]]第二段[[NEXT]]第三段')
  const feed = await get(routes, '/qqpilot/api/activity', 'since=0')
  assert.equal(feed.body.activity[0].messages, 3)
})

await scenario('tool mode: array reply keeps images', async () => {
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const { routes } = await loadPlugin([
    toolCallChunks('call_multi_img', 'qqpilot_reply', { text: ['先发文字', '再发一条'], images: [png] }),
  ])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('多图多文'))
  assert.equal(result.status, 200)
  assert.equal(result.body.choices[0].message.content, '先发文字[[NEXT]]再发一条')
  assert.equal(result.body.choices[0].message.images.length, 1)
})

await scenario('tool mode: JSON-array string from weaker models is split', async () => {
  const { routes } = await loadPlugin([
    toolCallChunks('call_jsonarr', 'qqpilot_reply', { text: '["Hello!", "晚安!", "萌!"]' }),
  ])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('说三条'))
  assert.equal(result.body.choices[0].message.content, 'Hello![[NEXT]]晚安![[NEXT]]萌!')
  const feed = await get(routes, '/qqpilot/api/activity', 'since=0')
  assert.equal(feed.body.activity[0].messages, 3)
})

await scenario('tool mode: nested JSON-array string is flattened', async () => {
  const { routes } = await loadPlugin([
    toolCallChunks('call_jsonarr2', 'qqpilot_reply', { text: '[["打招呼", "说晚安", "卖萌"]]' }),
  ])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('再来三条'))
  assert.equal(result.body.choices[0].message.content, '打招呼[[NEXT]]说晚安[[NEXT]]卖萌')
  const feed = await get(routes, '/qqpilot/api/activity', 'since=0')
  assert.equal(feed.body.activity[0].messages, 3)
})

await scenario('tool mode: ordinary bracketed text is not JSON-split', async () => {
  const { routes } = await loadPlugin([
    toolCallChunks('call_brackets', 'qqpilot_reply', { text: '[图片] 我来了喵' }),
  ])
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('你好'))
  assert.equal(result.body.choices[0].message.content, '[图片] 我来了喵')
})

await scenario('tool rounds limit and workspace root are editable', async () => {
  const { routes, workspaceSets } = await loadPlugin([textChunks('ok')])
  const rounds = await post(routes, '/qqpilot/api/config', { maxToolRounds: 8 })
  assert.equal(rounds.body.config.maxToolRounds, 8)
  const tooBig = await post(routes, '/qqpilot/api/config', { maxToolRounds: 99 })
  assert.equal(tooBig.body.ok, false)
  assert.ok(tooBig.body.error.includes('32'))
  const bad = await post(routes, '/qqpilot/api/config', { maxToolRounds: 'abc' })
  assert.equal(bad.body.ok, false)

  const workspace = path.join(process.cwd(), '.tmp-test-state', 'custom-ws')
  const setWorkspace = await post(routes, '/qqpilot/api/config', { workspaceRoot: workspace })
  assert.equal(setWorkspace.body.ok, true)
  assert.equal(setWorkspace.body.config.workspaceRoot, path.resolve(workspace))
  assert.equal(setWorkspace.body.config.effectiveWorkspace, path.resolve(workspace))
  assert.ok(workspaceSets.some((entry) => entry.target === path.resolve(workspace)), 'bridge agent working directory updated')
  const cfg = await get(routes, '/qqpilot/api/config')
  assert.equal(cfg.body.config.effectiveWorkspace, path.resolve(workspace))

  const notDir = await post(routes, '/qqpilot/api/config', { workspaceRoot: path.join(process.cwd(), 'package.json') })
  assert.equal(notDir.body.ok, false)
  assert.ok(notDir.body.error)

  const reset = await post(routes, '/qqpilot/api/config', { workspaceRoot: '' })
  assert.equal(reset.body.config.workspaceRoot, '')
  assert.equal(reset.body.config.effectiveWorkspace, path.resolve(process.cwd()))
})

await scenario('compatibility mode: no tools, direct text returned', async () => {
  const { routes, llm } = await loadPlugin([textChunks('兼容模式输出')])
  const set = await post(routes, '/qqpilot/api/config', { compatibilityMode: true })
  assert.equal(set.body.config.compatibilityMode, true)
  assert.equal(set.body.config.mode, 'compat')
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('你好'))
  assert.equal(result.body.choices[0].message.content, '兼容模式输出')
  assert.equal(llm.state.calls[0].tools, undefined, 'no tools in compatibility mode')
  const cfg = await get(routes, '/qqpilot/api/config')
  assert.equal(cfg.body.config.compatibilityMode, true)
})

await scenario('run mode: silent records incoming message without calling the model', async () => {
  const { routes, llm } = await loadPlugin([textChunks('不会被调用')])
  const set = await post(routes, '/qqpilot/api/config', { mode: 'silent' })
  assert.equal(set.body.config.mode, 'silent')
  assert.equal(set.body.config.compatibilityMode, false)
  const result = await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('在吗？'))
  assert.equal(result.status, 200)
  assert.equal(result.body.choices[0].message.content, '')
  assert.equal(llm.state.calls.length, 0, 'silent mode never calls the model')
  const feed = await get(routes, '/qqpilot/api/activity', 'since=0')
  assert.equal(feed.status, 200)
  assert.equal(feed.body.latestId, 1)
  assert.equal(feed.body.activity.length, 1)
  const entry = feed.body.activity[0]
  assert.equal(entry.mode, 'silent')
  assert.equal(entry.kind, 'silence')
  assert.equal(entry.sender, 'Alice')
  assert.ok(entry.text.includes('在吗'))
  // Switching back to agent mode works and is reflected in the config.
  const back = await post(routes, '/qqpilot/api/config', { mode: 'agent' })
  assert.equal(back.body.config.mode, 'agent')
  assert.equal(back.body.config.compatibilityMode, false)
})

await scenario('activity feed exposes parsed reply entries for the visual chat status', async () => {
  const { routes } = await loadPlugin([toolCallChunks('call_feed', 'qqpilot_reply', { text: '收到喵' })])
  await post(routes, '/qqpilot/v1/chat/completions', qqpilotBody('在吗'))
  const feed = await get(routes, '/qqpilot/api/activity', 'since=0&limit=10')
  assert.equal(feed.status, 200)
  assert.equal(feed.body.activity.length, 1)
  const entry = feed.body.activity[0]
  assert.equal(entry.mode, 'agent')
  assert.equal(entry.kind, 'reply')
  assert.equal(entry.sender, 'Alice')
  assert.equal(entry.reply, '收到喵')
  assert.equal(entry.images, 0)
  assert.equal(entry.usage.total_tokens, 18)
  assert.ok(entry.elapsedMs >= 0)
  // since=latestId yields no new entries.
  const empty = await get(routes, '/qqpilot/api/activity', `since=${feed.body.latestId}`)
  assert.equal(empty.body.activity.length, 0)
})

await scenario('legacy state file with compatibilityMode upgrades to compat mode', async () => {
  const { routes } = await loadPlugin([textChunks('旧状态')], { compatibilityMode: true, extraInstructions: '' })
  const cfg = await get(routes, '/qqpilot/api/config')
  assert.equal(cfg.body.config.mode, 'compat')
  assert.equal(cfg.body.config.compatibilityMode, true)
})

await scenario('context mode all: every user message reaches the model', async () => {
  const { routes, llm } = await loadPlugin([toolCallChunks('call_multi_user', 'qqpilot_reply', { text: '收到' })])
  const cfg = await get(routes, '/qqpilot/api/config')
  assert.equal(cfg.body.config.contextMode, 'all')
  const result = await post(routes, '/qqpilot/v1/chat/completions', multiUserBody())
  assert.equal(result.status, 200)
  const sent = llm.state.calls[0].messages
  assert.equal(sent.length, 6, 'system + three users + two assistant history messages')
  const users = sent.filter((message) => message.role === 'user')
  assert.equal(users.length, 3, 'all three user messages are preserved')
  assert.ok(users[0].content[0].text.includes('绿叶'))
  assert.ok(users[1].content[0].text.includes('baiyan'))
  assert.ok(users[2].content[0].text.includes('123'))
  const system = sent.find((message) => message.role === 'system')
  assert.ok(system.content[0].text.includes('本次请求包含 3 条用户消息'))
  assert.ok(system.content[0].text.includes('绿叶'))
  assert.ok(system.content[0].text.includes('尚未回复'))
  const feed = await get(routes, '/qqpilot/api/activity', 'since=0')
  const entry = feed.body.activity[0]
  assert.deepEqual(entry.participants, ['绿叶', 'baiyan', '123'])
  assert.equal(entry.userCount, 3)
  assert.equal(entry.pendingCount, 1)
  assert.equal(entry.contextMode, 'all')
  assert.equal(entry.incoming.length, 3)
  assert.equal(entry.incoming[0].sender, '绿叶')
})

await scenario('context mode latest: legacy last-message-only request', async () => {
  const { routes, llm } = await loadPlugin([toolCallChunks('call_latest', 'qqpilot_reply', { text: '只回最后一条' })])
  const set = await post(routes, '/qqpilot/api/config', { contextMode: 'latest' })
  assert.equal(set.body.config.contextMode, 'latest')
  const result = await post(routes, '/qqpilot/v1/chat/completions', multiUserBody())
  assert.equal(result.status, 200)
  const sent = llm.state.calls[0].messages
  assert.equal(sent.length, 2, 'system + only the newest user message')
  const users = sent.filter((message) => message.role === 'user')
  assert.equal(users.length, 1)
  assert.ok(users[0].content[0].text.includes('123'))
  assert.ok(!users[0].content[0].text.includes('绿叶'))
  const feed = await get(routes, '/qqpilot/api/activity', 'since=0')
  assert.deepEqual(feed.body.activity[0].participants, ['123'])
  assert.equal(feed.body.activity[0].userCount, 1)
  assert.equal(feed.body.activity[0].contextMode, 'latest')
  assert.equal(feed.body.activity[0].incoming.length, 1)
})

await scenario('invalid request is refused with 400', async () => {
  const { routes } = await loadPlugin([textChunks('x')])
  const result = await post(routes, '/qqpilot/v1/chat/completions', { model: 'x' })
  assert.equal(result.status, 400)
  assert.ok(result.body.error && result.body.error.message.includes('messages'))
})

await scenario('client error reporting endpoint records diagnostics', async () => {
  const { routes } = await loadPlugin([textChunks('x')])
  const sent = await post(routes, '/qqpilot/api/client-error', { source: 'settings', message: 'boom', stack: 'at test' })
  assert.equal(sent.status, 200)
  assert.equal(sent.body.ok, true)
  const list = await get(routes, '/qqpilot/api/client-errors')
  assert.equal(list.body.ok, true)
  assert.equal(list.body.errors.length, 1)
  assert.equal(list.body.errors[0].source, 'settings')
  assert.equal(list.body.errors[0].message, 'boom')
})

console.log(failures === 0 ? '\nALL HOST-UNIT SCENARIOS PASSED' : `\n${failures} SCENARIO(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
