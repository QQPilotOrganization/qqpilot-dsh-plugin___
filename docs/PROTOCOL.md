# QQPilot ↔ OpenAI Chat Completions 协议契约

本文是 `qqpilot-dsh-plugin` 必须满足的**精确**协议契约，全部结论直接来自 QQPilot Rust 源码
（`C:\Users\Develop\QQPilots\QQPilot\qqpilot5\src`，相对路径 + 行号）。QQPilot 侧**不做**任何
OpenAI SDK 校验，它只是一段手写的 `reqwest` 请求 + `serde_json::Value` 取值，所以契约比
"标准 OpenAI"更窄，也更宽松：字段少、但响应取值路径和类型是硬性的。

---

## 1. 请求：URL / Header / Body

### 1.1 调用链

| 步骤 | 位置 |
| --- | --- |
| `Answer::new()` 读取配置，确定后端 | `answer.rs:62-100` |
| 主循环调用 `model.get_answer(&chat_contents)` | `main.rs:333-336` |
| `get_answer` → `get_answer_with(text, "auto")` | `answer.rs:107-116` |
| 组装 messages / body、POST、解析响应 | `answer.rs:112-216` |
| 拼 URL、鉴权、发送 | `answer.rs:348-370` |

### 1.2 后端判定（决定是否走本插件）

`answer.rs:69-77`：

- `forceollamaapi = true` → 走 Ollama `/api/chat`（`answer.rs:69-71`），**不适用本插件**。
- `server_url` 大小写不敏感等于 `ollama` → `http://localhost:11434/api/chat`（`answer.rs:72-74`）。
- `server_url` 大小写不敏感等于 `builtin` → 内置 Jaccard 问答（`answer.rs:75-77`）。
- 其它任意值 → OpenAI 兼容模式：`{server_url}/chat/completions`（`answer.rs:183-189, 348-353`）。

`server_url` 的默认值是 `builtin`（`config.rs:115`），所以必须显式配置成插件地址，例如
`server_url = http://127.0.0.1:55068/qqpilot/v1`。**末尾不能带 `/`**，因为 URL 是直接
字符串拼接（`answer.rs:352`），带斜杠会变成 `//chat/completions`。

### 1.3 请求 URL 与 Header

```rust
// answer.rs:348-353
format!("{}/chat/completions", self.server_url)

// answer.rs:356-360
.header("Content-Type", "application/json; charset=utf-8")

// answer.rs:362-367：只有 api_key 非空，且 server_url 不含 "localhost" / "127.0.0.1" 才带鉴权
Authorization: Bearer {api_key}
```

要点：

- `Content-Type` **带 `; charset=utf-8` 参数**，插件的 HTTP body 解析必须容忍该参数。
- `server_url.contains("localhost")` / `.contains("127.0.0.1")` 是**区分大小写的字符串包含**，
  所以本地部署（`http://127.0.0.1:...`）即使配了 `api_key` 也**不会**发 `Authorization`。
  反过来写 `LOCALHOST` 会发。插件对本地端点不应强制鉴权。
- 超时来自 `remote_server_timeout` 秒（`answer.rs:80-83`；`config.rs:166-171`，默认 300 秒，最小 1）。
  整条 HTTP 请求（连接 + 读完响应体）都受这个超时约束。

### 1.4 请求体

`answer.rs:144-148` 固定三字段，然后合并 `extra.json`：

```json
{
  "model": "<config.ini modelname>",
  "messages": [ ... ],
  "stream": false
}
```

- 键插入顺序固定为 `model`、`messages`、`stream`（`answer.rs:145-147`），但 JSON 顺序无关。
- `extra.json` 的**顶层键**整体覆盖/追加（`answer.rs:428-436`）：值非 null 时 `insert`，值为
  JSON `null` 时**删除该键**（用于去掉服务商不认的 `think` / `max_tokens` 等）。因为合并在
  固定三字段之后（`answer.rs:148`），`extra.json` 甚至可以覆盖 `model`/`messages`/`stream`。
- 请求体在发送前会写到当前目录的 `dest.json`（`answer.rs:150-153`），联调时可查看实际 body。
- `model` 只是从 `config.ini` 抄过来的字符串（本机示例是 `qwen3.5:0.8b`）。插件**不要**按
  OpenAI 模型名校验/拒绝，否则 QQPilot 会拿到 4xx 并静默失败。

### 1.5 system 提示词的选择

`answer.rs:131-135`：

- `system_prompt == "auto"`（正常路径 `answer.rs:108` 总是传 `"auto"`）→ 使用 `system.txt`
  的内容（`config.rs:31, 286-292`：读取时去掉 UTF-8 BOM，**不做 trim**，文件缺失则为空串）。
- `""` 或 `"None"` → 不加 system 消息。
- 其它值 → 原样作为 system prompt。

只有内容非空时才 push `{"role":"system","content":...}`（`answer.rs:139-141`）。

---

## 2. messages 的形状

### 2.1 组装顺序

`answer.rs:137-142`：先 system（可选），再把聊天记录逐条转换，**顺序与聊天记录一致**
（旧 → 新），最新一条用户消息在最后。QQPilot 不裁剪历史，聊天窗口里能解析到的消息都会带上。

### 2.2 role 判定

`answer.rs:315-319`：`item.own_by_myself ? "assistant" : "user"`。
`own_by_myself` 由 `conversation.rs:139` 判定：聊天记录里的用户名（trim 后）等于
`config.ini` 的 `name`（自己的角色名）即为自己的消息。

### 2.3 文本内容格式

非自己（`user`）消息由 `ChatContent::Display`（`chat_content.rs:99-103`）拼成：

```
[time]
<时间>\n\n [username] \n <用户名> \n\n [content] \n <正文>\n
```

即真实文本是类似（`\n` 为实际换行，`time` 为空时用当前本地时间 `%m-%d %H:%M:%S`，
`chat_content.rs:93-97`）：

```
[time]
08-10 17:18:30 

 [username] 
 蓝色鲸鱼 

 [content] 
 又发图喵？
话说你们说本喵被neko教坏了
```

自己的（`assistant`）消息不做这种包装，**原样输出自己的文本，并去掉最后一个字符**
（`chat_content.rs:86-91`，对应 C# `content[..^1]`，通常用来吃掉 QQ 复制时多出的换行）。
所以历史里的 assistant 内容是模型上一轮输出（可能带 `[[NEXT]]`、多行文本）。

聊天记录解析规则（`conversation.rs:10-13, 101-152`）：消息头正则
`^(.+?):\s+(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$`；`<img src="file://...">` 标签会被抽成
本地图片路径（`conversation.rs:27-42`），并从正文里删除。

### 2.4 纯文本消息

没有附图的用户消息 / assistant 消息：

```json
{"role": "user", "content": "[time]\n...\n\n [username] \n ...\n\n [content] \n ...\n"}
{"role": "assistant", "content": "喵～上一轮回复"}
```

### 2.5 带图消息（vision）

- 仅当 `config.ini` 的 `isvisionmodel = true` 时才收集图片（`answer.rs:249-253`，默认 true，
  `config.rs:112`）。
- 从**最新消息往前**收集（`answer.rs:255` 的 `iter().rev()`），最多 `maximagecount` 张
  （默认 12，`config.rs:113`）；只收集对手发来的图，自己的消息附带的图不发送
  （`answer.rs:256, 305`）；文件不存在则跳过并告警（`answer.rs:259-270`）。
- 图片编码为 `data:{mime};base64,{base64}`（`answer.rs:298-301`），mime 按扩展名推断
  （`answer.rs:439-456`，兜底 `image/jpeg`）。
- 带图时 `content` 变成**分段数组**，顺序固定：先 text 段（文本即使为空也保留 `""`），
  再每张图一个 `image_url` 段（`answer.rs:330-339`）：

```json
{
  "role": "user",
  "content": [
    {"type": "text", "text": "[time]\n... [content] \n 这张图好看吗\n"},
    {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBORw0KGgo..."}}
  ]
}
```

- 既无文字又无可用图片的消息整条丢弃（`answer.rs:304-308`）。带图消息一定不会出现在
  assistant 侧（`answer.rs:305` 的 `!item.own_by_myself`）。
- 插件收到的 body 可能很大（最多 12 张 base64 图），Host 侧 body 大小限制要够用。

---

## 3. 响应：QQPilot 只认这几条路径

### 3.1 传输层

- HTTP 状态必须 `2xx`（`answer.rs:163-168`，`Status::is_success`），否则记日志、
  `get_answer_with` 返回 `None` → 主循环按"空回复"处理（静默，不发送任何东西）。
- 响应体按纯文本读取（`answer.rs:164`），然后 `serde_json::from_str` 解析（`answer.rs:173-179`）；
  非法 JSON 同样返回 `None` → 静默。
- **不支持流式**：请求固定 `stream:false`（`answer.rs:147`），响应必须是单个完整 JSON，
  `Content-Type` 可以是 `application/json`。SSE/分块文本会被当成解析失败。
- `dest.json`、`/models` 等其它接口 QQPilot 不会调用，只是给人调试用。

### 3.2 正文（硬性）

```rust
// answer.rs:183-196（OpenAI 分支）
document.pointer("/choices/0/message/content").and_then(Value::as_str)
```

- `choices[0].message.content` **必须是 JSON 字符串**。`null`、数组（例如标准 OpenAI 的
  content-parts 数组）、数字、对象都取不到值 → 返回 `None` → 静默。
- 取到后**先 trim**（`answer.rs:212-215`），主循环再 trim 一次（`main.rs:356`）。
- `choices` 为空数组 / 不是数组 / 没有 `message`，结果同样是静默失败。
- `role`、`finish_reason`、`object`、`model`、`id` QQPilot **完全不校验**；但测试脚本会按
  OpenAI 习惯校验 `object: "chat.completion"`、`role: "assistant"`。

### 3.3 图片（可选扩展，非标准字段）

只在 OpenAI 兼容分支收集（`answer.rs:198-202` → `collect_response_images`，
`answer.rs:459-494`），路径是 `choices[0].message.images`，必须是数组。注意 `message.images`
是**非标准扩展字段**，标准 OpenAI 没有它。

每一项尝试两种取法：

1. `images[i].image_url.url` 字符串：
   - 期望是 data URL：`data:image/<ext>;base64,<payload>`。
   - 取到后打印前 50 字符，然后 `save_to_temp(url)`。
2. `images[i].b64_json` 字符串：取到后 `save_to_temp(encoded)`。

`save_to_temp`（`answer.rs:497-518`）的实际要求（比注释/上游 C# 更严格）：

- 字符串必须包含 `,`（`split_once(',')`，`answer.rs:502`），否则报
  `error.image.badformat` 并丢弃。
- `,` 之前的部分必须包含 `data:image/` 前缀（`answer.rs:501, 507`），否则报
  `error.image.unknownmime` 并丢弃。
- 扩展名 = `data:image/` 之后、`;` 之前的字符串（`answer.rs:501, 507-510`）。
- 通过后 base64 解码写入 `./temp/<md5(payload)>.<ext>`（`answer.rs:512-516`）。

因此：

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "给你一张图喵～",
      "images": [
        {"image_url": {"url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."}}
      ]
    }
  }]
}
```

是**唯一稳妥的图片返回形式**。裸 base64 写进 `b64_json`（不带 `data:image/...,`）在 Rust 版里
会因为缺少逗号/前缀被丢弃——虽然 `b64_json` 的代码路径存在（`answer.rs:486-491`），
但只有 `b64_json` 的值本身也是 data URL 时才能保存成功。

- 图片保存到 `./temp`（`answer.rs:26, 85`），由 `main.rs:391-395` 在**文本发送之后**上传。
  图片不会单独发送：**content 为空时整个回复被跳过，图片也不会被上传**（`main.rs:357-384`）。

### 3.4 usage / reasoning_content（可观测性）

`answer.rs:373-411`：

- 若存在顶层 `usage`：读 `prompt_tokens`、`completion_tokens`、`total_tokens`，按 i64 读取，
  缺失/非整数按 0；三者都会打印到 QQPilot 控制台，`total_tokens` 会累加到
  `tokencount.txt`（`main.rs:343-352`）。没有 `usage` 也能正常工作，只是不打印。
- 若存在 `choices[0].message.reasoning_content`（字符串），会以 `<think>...</think>` 形式打印，
  纯日志用途，不影响最终回复。有 reasoning 时建议保持，便于本地排查。

### 3.5 最小可用响应

```json
{
  "id": "chatcmpl-qqpilot-1",
  "object": "chat.completion",
  "model": "ignored-by-qqpilot",
  "choices": [
    {"index": 0, "message": {"role": "assistant", "content": "2"}, "finish_reason": "stop"}
  ],
  "usage": {"prompt_tokens": 10, "completion_tokens": 1, "total_tokens": 11}
}
```

---

## 4. QQPilot 侧的行为规则（插件必须知道的上层后果）

### 4.1 空内容 = 完全不回复

`main.rs:356-384`：

```rust
let result = result.trim().to_string();
if result.replace("\n\n", "").is_empty() || result.is_empty() { ... continue; }
```

- 只有空白（空格/换行/制表符）、或只由 `\n\n` 构成的内容 → 视为"这次不回复"。
- 分支里 QQPilot 会**直接 `continue`**：不调用 `send_text`，不执行 `main.rs:391-395` 的图片上传。
  所以 `content` 为空 + `images` 非空 → 图片被丢弃。
- 想"不说话"就返回 `content: ""`（或全空白字符串）；不要返回 `content: null` /
  缺字段，那会走 `None` 分支（同样静默，但会打 ERROR 日志、无 usage 处理）。
- `withimage` / `sendimagepossibility`（`config.rs:155, 159`）只影响 QQPilot 自己从
  `Images/` 目录随机发图（`main.rs:397-403`），与接口返回的图片无关。

### 4.2 长度截断：最多 500 个字符

`main.rs:337-341`：

```rust
let mut result = results.text.clone().unwrap_or_default();
let images_to_upload = results.absolute();
if result.chars().count() > 500 { result = result.chars().take(500).collect(); }
```

- 按 **Unicode 标量（chars）** 计，超过 500 会被**硬截断**（不做智能断句，可能截断
  `[[NEXT]]`、代码块、URL）。
- 截断发生在 trim 之前（`main.rs:339-341` vs `main.rs:356`），所以实际发出长度 ≤ 500。
- 插件在 compatibility 模式下最好自己把回复控制在 ~500 字符内，避免被截断成半句。

### 4.3 `[[NEXT]]` 与换行：直接决定 QQ 里发几条消息

`gui_operation.rs:152-176`（`send_text`）：

```rust
for item in text.split("[[NEXT]]") {
    let inputs: Vec<&str> = item.split('\n').collect();
    for line in &inputs[..inputs.len() - 1] {  // 除最后一行外：逐行粘贴 + 回车单独发送
        paste_text_to_section(line, comment_section);
        press_key("ENTER");
        ...
    }
    paste_text_to_section(inputs[inputs.len() - 1], comment_section); // 最后一行
    click_center(comment_section);
    hot_key("ctrl", "enter");                                        // 发送本条
}
```

- `[[NEXT]]` 把回复拆成多段，每段单独按一次 `Ctrl+Enter` 发送（每段可以再有多行）。
- 段内每个 `\n` 都会**单独发一条 QQ 消息**（除段内最后一行外），因此换行 = 多条消息，
  不是一条消息里的换行。
- 因此插件返回的 `content` 应是**纯文本**；不要输出 Markdown 表格/代码块这类强依赖换行的
  格式（会被拆成多条消息或截断），也不要在末尾留 `[[NEXT]]`（末段为空会导致一次空发送）。
- 图片在文本之后上传，不占用文本消息；文本多段 + 图片混排时以 QQPilot 的节奏为准。

### 4.4 端到端时序

```
main.rs:333-336  get_answer（HTTP，受 remote_server_timeout=300s 限制）
main.rs:337-341  clone 文本 + 500 字符截断
main.rs:343-352  累加 usage.total_tokens 写 tokencount.txt
main.rs:354-384  trim → 空则静默 continue
main.rs:388-395  send_text([[NEXT]]/\n 拆分) → 上传返回的图片
main.rs:397-403  按概率发送本地 Images/ 图片
main.rs:405-408  再等 4 秒后 Ctrl+Enter（聊天框里的最终发送）
```

---

## 5. 插件侧兼容性结论（compatibility vs tool 模式）

1. **兼容模式（直出文本）**：把模型最终文本放进 `choices[0].message.content` 字符串即可，
   `object:"chat.completion"`、`model`、`usage` 都只是锦上添花；不要包 content-parts 数组。
2. **工具模式（reply/silence 工具循环）**：插件内部可以自由调 LLM、解析 tool_calls，但
   对 QQPilot 的**出口必须收敛成同一形状**：一个字符串 `content` + 可选 `message.images[]`
   数组。绝不能把 `tool_calls`、`content:null` 或分段数组直接透传给 QQPilot
   （唯一例外是链路里插入了扩展插件，见 5.9）。
3. **静默**：工具模式判定"不说话"时返回 `content: ""`（字符串），QQPilot 会跳过发送。
4. **图片**：工具模式拿到的图片（`ctx.attachments` 等）要归一化成
   `data:image/<ext>;base64,<payload>` 放进 `message.images[i].image_url.url`；
   同时 content 必须非空，否则图片被丢弃。
5. **鉴权**：本地端点不要强制 Bearer（QQPilot 对 127.0.0.1/localhost 不发 Authorization）。
6. **模型名**：不要校验/重写 QQPilot 传来的 `model`（它是 `qwen3.5:0.8b` 这类本地配置值）。
7. **体积**：请求可能含最多 12 张 base64 图片；响应要单次 JSON、300 秒内返回。
8. **错误处理**：任何 4xx/5xx/非法 JSON 都会让 QQPilot 静默失败（用户侧表现为"机器人不理人"），
   所以插件应尽量 200 + 明确 content 或空 content，把错误写进日志。

### 5.9 扩展插件请求工具（tool_calls 回传）

QQPilot 的请求体固定只有 `model` / `messages` / `stream`，外加 `extra.json` 的顶层覆盖；它**不会**发送
`tools`。但扩展插件可以在 QQPilot 与本插件之间再插一跳（QQPilot → 扩展 → 本插件），扩展在转发时注入
`tools`（例如 qqpilot-easy-audio 的 `text_to_speech`）。本插件的约定：

- 只有工具模式读取 `body.tools`；兼容 / 静默模式忽略。
- 工具名与 `qqpilot_*` 或 DSH 工具名冲突时被丢弃；单次最多 8 个。
- 模型调用扩展工具**不执行**，响应为
  `choices[0].message = { role:"assistant", content:"<字符串>", tool_calls:[{id,type:"function",
  function:{name,arguments}}] }`，`finish_reason:"tool_calls"`。
- QQPilot 侧只读 `content` / `images` / `audios` / `files`，`tool_calls` 会被忽略；消费它的是链路里的扩展
  插件。easy-audio 的 `chat.rs::rewrite_tool` 会按 `function/name == "text_to_speech"` 精确匹配第一个调用，
  合成后删除该 tool_call、把 `content` 置空并写入 `message.audios[]`。
- 因此扩展工具调用与 `qqpilot_reply` 不能在同一个响应里同时生效：扩展优先，文本作废（`content` 仍保留
  模型文字，作为合成失败时的回退）。

---

## 6. 测试脚本

```powershell
# 单次真实 QQPilot 风格请求 + 严格响应校验
node test/mock-qqpilot.mjs --url http://127.0.0.1:55068/qqpilot/v1

# 多场景验收（基础回复 / 文本路径 / 配置模式探测 / 图片能力）
node test/verify.mjs --url http://127.0.0.1:55068/qqpilot/v1

# 换端口 / 换 origin 均可，脚本接受 base 或完整 /chat/completions 地址
node test/verify.mjs --url http://127.0.0.1:51801/qqpilot/v1
```

更多参数见 `test/README.md`。

---

## 7. Live verification (2026-10-24, host 0.2.1-rc.2)

以下是在**已安装插件的本机环境**（DSH Web `http://127.0.0.1:55068`，插件 host `0.2.1-rc.2`）
跑出的一次性实测证据，**不是协议定义**；端口可变，以实际 origin 为准。

```powershell
node test/mock-qqpilot.mjs --url http://127.0.0.1:55068/qqpilot/v1
node test/verify.mjs --url http://127.0.0.1:55068/qqpilot/v1
```

| 观测项 | 结果 |
| --- | --- |
| `POST /qqpilot/v1/chat/completions` | HTTP 200，`application/json; charset=utf-8` |
| `mock-qqpilot.mjs` | PASS：HTTP 200（约 0.5s），`content="等于2"`，`usage.total_tokens=895` |
| `verify.mjs` 硬场景 | 2/2 PASS（场景 1 `content="等于2"`；场景 2 文本路径 `content="SILENT"`） |
| 兼容模式探测 | `compatibilityMode=false`、`fallbackToCompat=true`（当前为 tool 模式），RESULT: PASS |
| 出站图片 `choices[0].message.images` | tool 模式可返回 `data:image/...` 图片；是否发图取决于模型/提示（Lead 的一次运行返回 1 张 data URL 图；另一次运行模型只回文本，属软检查 WARN，不算协议失败） |
| 静默路径 | 工具模式 `qqpilot_do_not_reply` 映射为 `content=""`，QQPilot 侧跳过发送（本次 stats 记录 silences=1） |
| 入站图片（vision） | 1x1 PNG `image_url` data URL 输入 → 模型回答"粉红色"，入站图片路径正常（手动验证） |
| `POST /qqpilot/api/test` | tool 模式 `{"mode":"tool","reply":{"text":"连接正常，测试通过。"}}`；compat 模式 `{"mode":"compat","reply":{"text":"连接正常。"}}` |
| 配置切换 | `POST /qqpilot/api/config` 切换 `compatibilityMode` 后持久化到 `~/.dsh/qqpilot-dsh-plugin.json` |
| 插件统计 | `requests=8 replies=7 silences=1 errors=0` |

> 结论：请求构造、`content` 字符串、静默、`message.images[]` data URL、`usage` 均与 QQPilot
> 契约一致。`images` 属于模型行为相关能力项，生产验收建议用真实图片再测一次。
