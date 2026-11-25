# note.md — 开发踩坑记录

> 与 README 的「轮次记录」互补：README 记结果，这里记过程里真正花时间、最容易再犯的坑。
> 新增坑请追加到对应轮次下，写清「现象 → 原因 → 做法」。

## 第十轮：扩展插件请求工具传递（0.1.8）

### 1. 链路方向决定一切：扩展必须在 QQPilot 与本插件之间

```
QQPilot ──▶ 扩展（qqpilot-easy-audio, tool 模式）──▶ 本插件 ──▶ DSH 模型
```

- 只有这个顺序，扩展注入的 `tools` 才会出现在**本插件收到的请求体**里。
- 反过来（QQPilot → 本插件 → easy-audio 作为“上游 LLM”）不行：easy-audio 会自己拦截并消费
  `text_to_speech`，本插件根本看不到这次调用；它返回的 `audios[]` 也不在 DSH `llm.stream` 的字段里，
  最终表现为“模型沉默”。
- 接线时：QQPilot 的「服务器」填 `http://127.0.0.1:10201/v1`（easy-audio），easy-audio 的
  `upstream.server` 填 `http://127.0.0.1:<DSH端口>/qqpilot`。`join_url` 会拼成
  `/qqpilot/v1/chat/completions`，正好是本插件的路由。

### 2. easy-audio 的改写条件很窄，回传形状必须完全对上

`qqpilot-easy-audio/src/chat.rs::rewrite_tool` / `take_tool_text`：

- 按 `message.tool_calls[].function.name == "text_to_speech"` **精确匹配**，只取**第一个**匹配项；
- `arguments` 可以是 JSON 字符串或对象，但必须能取出 `text` 且非空；
- 合成成功后：删除该 tool_call（数组空了就删 `tool_calls` 字段）、`content` 置空、追加
  `message.audios[]`、`finish_reason` 改成 `stop`；
- 合成失败：删除 tool_call 后，只有 `content` 为空才用参数文本回填。

所以本插件回传时：`tool_calls` 必须是数组、每项 `{id,type:"function",function:{name,arguments}}`，
`id` 不能丢（easy-audio 不校验，但 OpenAI 客户端可能会），`finish_reason` 用 `"tool_calls"`，
并且 `content` 仍保持**字符串**（模型文字），作为合成失败时的兜底。

### 3. QQPilot 根本不读 `tool_calls`

`qqpilot5/src/answer.rs` / `upload_content.rs` 只取 `choices[0].message` 的
`content` / `images` / `audios` / `files`。所以：

- 回传 `tool_calls` 只对**链路里的扩展**有意义；直连 QQPilot 时它会被忽略，用户看到的是 `content`。
- 因此即使模型忘了调扩展工具，只要 `content` 有文字，消息也不会丢。
- 不要把 `content` 写成 `null` 或分段数组（QQPilot 用 `Value::as_str`，会静默丢弃）。

### 4. `tool_choice` 不生效，别指望 `required`

easy-audio 会往请求里塞 `tool_choice: auto|required`，但本插件不读它，DSH 的模型调用也不带
`tool_choice`。结果：模型是否调用 `text_to_speech` 完全由模型自己决定。想稳定触发，只能：

- 用支持 function calling 的模型；
- 靠 easy-audio 工具描述里的“每次回复前先调用本工具”；
- 或在 `extraInstructions` 里补一句要求。

### 5. 工具名过滤是必须的，不是洁癖

- 保留名（`qqpilot_reply` / `qqpilot_do_not_reply` / `qqpilot_get_chat_name` / `qqpilot_upload_files`）
  被扩展同名工具覆盖会直接破坏回复/沉默语义，必须丢弃。
- 与 DSH 工具重名（如 `read`）时让 DSH 工具赢（分派顺序里 DSH 在前），否则用户以为在调 DSH 工具、
  实际被回传给了扩展。
- 非法名字（含空格、`../`）直接丢，避免把奇怪的函数名送进模型/上游。
- `maxRequestTools` 限 8 个，防止扩展塞一堆工具把提示词撑爆。

### 6. 回传即结束本轮，不要再等工具结果

模型调用扩展工具后，本插件**不执行、不回喂 tool result**，而是立刻结束循环并把调用回传。如果把它当普通
工具塞回对话继续下一轮，模型会等一个永远不会到来的工具结果，最后超时/沉默。

### 7. 编辑大文件：`ReplaceFileW EIO (Win32 1175)`

现象：`edit` 工具偶尔报 `cannot write ... ReplaceFileW EIO (Win32 1175)`。

原因：DSH 热重载 / 文件被占用，替换瞬间失败；失败的这次**不会写入**（不要以为半写了）。

做法：

1. 先 `Select-String` / `read` 确认文件当前内容，再原样重试一次；通常第二次就成功。
2. 不要因为一次失败就“整个文件重写”（会丢改动、也会再次触发占用）。
3. 连续失败时先 `Start-Sleep 2-3` 再试。

### 8. 改一行不要顺手吃掉相邻变量

这次在 `ActivityRow` 里用 `old_string` 匹配两行时只保留了第一行，把 `var meta = [];` 删掉了，
导致渲染直接 `meta is not defined`。规矩：`old_string` 至少带上下一行作为锚点，替换后立刻跑
`node test/client-render.mjs`。该测试用假 React 直接调用函数组件，任何未定义变量都会当场炸出来。

### 9. 新增渲染分支必须让测试真的走到

`kind === 'extension'` 只在 `ActivityRow` 里，而 `ActivityTab` 在 `entries=[]` 时不会渲染任何行。
所以 client-render 夹具里必须放一条 `kind:"extension"` 的样例，否则新分支永远是“没测过”。
DockRow 同理（目前主要由真实页面验证）。

### 10. 往 host-unit 里插 scenario 时小心吃掉下一行

`await scenario('...', async () => {` 是插入锚点；`old_string` 只写这一行时，替换后忘了把它加回
新内容末尾，就会把下一个 scenario 的头部吞掉（语法错误）。插入后 `Select-String -Pattern 'await scenario'`
数一下数量和最后一条是否完整。

### 11. 版本与文档一起动

- `package.json` 升版本（本轮 0.1.7 → 0.1.8）；
- `cordis.patch.yml` 同步新默认值（`acceptRequestTools: true`）；
- README「功能 / 配置项 / HTTP 接口 / 输出约定 / 轮次记录」与 `docs/PROTOCOL.md`（§5.2 例外 + §5.9）同步，
  否则下一个人会以为 `tool_calls` 回传违反协议。

### 12. 语音链路的额外前提

- QQPilot 必须勾选「下载远程音频」（`config.ini` 的 `remote_audios = true`），否则 easy-audio 清空文本后
  音频会被 QQPilot 丢掉，表现为“消息没发出去”。
- 音频由 easy-audio 合成并写成 `data:audio/wav;base64,...`；本插件只负责把 `tool_calls` 交回去，
  不碰 `audios`，也不要在响应里伪造音频。
- 想看实际链路：`node test/mock-qqpilot.mjs --url http://127.0.0.1:<DSH端口>/qqpilot/v1`（离线单测
  不依赖真实模型，联调再跑这个）。
