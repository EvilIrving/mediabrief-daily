# AGENTS.md - web-mediabrief-daily (MediaBrief Daily)

MediaBrief Daily 是极轻量、免构建、零后端依赖的静态媒体与深度长文速读聚合系统。收录播客音频精要（YouTube / 小宇宙）、精选技术深度长文（Curated Articles）与财新深度调查报道。对外交付免读原文即可掌握核心脉络、关键架构决策与量化细节的高信息密度速读。

---

## 1. 项目核心定位、关键交互逻辑与业务红线（不变式）

- **核心定位与交互逻辑**：
  - 纯前端单页架构驱动，左侧栏支持多维筛选（来源过滤、标题实时搜索、仅未读切换、时间/字数排序、分组折叠）；
  - 右侧阅读区支持多栏切换（财新报道：`速读` + `原文`；外文长文：`总结` + `译文` + `原文`）；
  - 支持音频直链无缝播放与进度持久化；
  - 页面状态全量双向绑定：URL Hash 状态（`#<id>&src=...&q=...`）与 localStorage（已读列表 `mb_read`、最后阅读 `mb_last`、视图配置 `mb_view`、折叠状态 `mb_collapsed`、Tab 偏好 `mb_tab`）实时同步。
- **业务绝对红线**：
  1. **数据三位一体双写硬约束**：
     - 新增条目或重构文本时，必须**同时更新并校验**：`txt/<id>.*.txt` 正文文件、`items.json` 索引库、以及 `index.html` 内嵌紧凑字典 `const RAW = [...]`。
     - 紧凑字典中的字节大小数组 `n: [len_summary, len_zh, len_orig]` 必须与磁盘上各文本文件的实际字节大小严格一致；缺失的版本必须精确填 `0`。
     - 严禁只修改 `items.json` 而遗漏 `index.html`，否则线上页面无法呈现新增条目。
  2. **外文提炼以英文原文为单一真源**：
     - 外文材料必须以原作者英文原文（`*.orig.txt`）为单一事实依据，坚决禁止基于机器翻译（`*.zh.txt`）进行二次转述或主观臆测。
  3. **首部净空法则（零套话导语）**：
     - 严禁在正文头部堆砌 `标题 | 作者 | 来源` 或裸 URL 等元数据导语；
     - 首句必须直接陈述核心事实、架构机制或背景问题，彻底剔除「本文介绍了……」「总的来说……」等无信息量过渡句。
  4. **硬核细节与技术参数保真**：
     - 提炼重构必须完整保留关键技术参数、数据指标、架构机制与因果决策推导，严禁为了压缩篇幅而抽象化、模糊化核心硬事实。
  5. **动态篇幅梯度约束**：
     - 短篇轻量文章：800–1100 汉字；
     - 中长篇技术与行业长文：1100–1800 汉字；
     - 全景深度调查与长音视频特稿：1500–2000 汉字；杜绝机械模板化。
  6. **打包产物严禁入库**：
     - `tools/bundle-standalone.mjs` 产出的 `dist/` 目录属于离线单文件导出包，已加入 `.gitignore`，严禁提交入 Git 仓库。

---

## 2. 架构拓扑与分层职责

### 目录与系统拓扑
```
web-mediabrief-daily/
 ├─ index.html           静态前端页面（UI 视图 + 内置紧凑字典 const RAW = [...]）
 ├─ items.json           全量文章结构化元数据集合（对外导出与格式校验）
 ├─ sw.js                Service Worker 离线缓存控制器（版本 mb-v1）
 ├─ fonts/               本地字体资源（Pretext 字体等）
 ├─ txt/                 文章正文文本池（以条目 id 命名: .txt / .zh.txt / .orig.txt）
 ├─ tools/
 │   └─ bundle-standalone.mjs  离线单文件 HTML 打包工具
 └─ dist/                [未跟踪] 打包产物目录（mediabrief-standalone.html / mediabrief-lite.html）
```

### 核心模块分工矩阵
| 模块 / 文件 | 职责与约束 |
|---|---|
| `index.html` | 核心视图与数据驱动中心。直接包含单行 JSON 字典 `const RAW = [...]`，初始化时将其展开映射为 `ITEMS`。通过原生 Fetch 异步按需加载 `txt/` 正文。 |
| `items.json` | 完整文章属性库，提供标准 JSON 格式供外部脚本与自动化流水线消费。 |
| `txt/` 文本库 | 正文物理存储池。采用标准 Markdown 格式，纯文本无多余 HTML 标记。包含三种后缀：<br>• `<id>.txt`：中文高质量深度速读/总结（重构版本标 `rw: 1`）；<br>• `<id>.zh.txt`：全文对照机翻（财新条目不生成）；<br>• `<id>.orig.txt`：英文或原始文本存档。 |
| `sw.js` | Service Worker 离线缓存策略：字体 `cache-first`，正文 `stale-while-revalidate`，HTML `network-first`。 |
| `tools/bundle-standalone.mjs` | 离线单文件生成脚本。将 `RAW` 与 `txt/` 正文全量内联为 `TEXTS` 常量，将网络 `fetch` 转换为内存字典查找 `TX(u)`，产出离线可用的单个 HTML。 |

---

## 3. 运行时环境与数据清洗物理硬约束

### 即时抓取与数据清洗策略
- **抓取通道优先级**：
  - 外部网页与长文采集优先使用结构化正文抽取接口；
  - 遇到动态 SPA 渲染、防爬防护或特殊版面时，启用无头 Chrome CDP 通道获取真实渲染文本。
- **上下文纯净准则**：
  - 严禁将整页未清洗的 HTML DOM、内联 JavaScript、CSS 样式或广告外链灌入主流程上下文；
  - 必须在子任务沙箱内完成降噪、正文提取、去除乱码与 Markdown 结构化清洗。
- **反爬防御与边界处理**：
  - 遭遇 Cloudflare 5秒盾、验证码或付费墙拦截时，严禁盲目发起高频请求重试，必须由人工或离线途径获取已归档原文。

### 浏览器环境与离线协议兼容性
- **Service Worker 拦截规则**：仅拦截 GET 请求，仅对 `/fonts/`、`/txt/` 及顶层 navigate 导航模式生效。
- **本地 `file://` 协议兼容守卫**：
  - 在浏览器以 `file://` 协议打开本地文件时，Service Worker 注册与外部 ES Module 动态 import（如 Pretext 排版引擎）会触发浏览器安全跨域拦截。
  - 在 `bundle-standalone.mjs` 中已注入 `location.protocol !== 'file:'` 守卫，本地直接双击打开离线包时自动降级跳过，确保单文件阅读正常。

---

## 4. 真实可运行的构建、静态检查与自检指令

```bash
# 1. 启动本地开发与预览服务（任选一种，访问 http://localhost:8080）
python3 -m http.server 8080
# 或
npx serve .

# 2. 离线单文件全量打包与数据自检（产出 standalone 与 lite 两个独立单文件）
node tools/bundle-standalone.mjs
# 产物自检标准：必须显示 missing=0，无缺失文本文件

# 3. 数据完整性与条目数校验
python3 -c "import json; d=json.load(open('items.json')); print('items.json 数量:', len(d))"
node -e "const fs=require('fs'); const html=fs.readFileSync('index.html','utf8'); const s=html.indexOf('const RAW=')+10; const e=html.indexOf('];',s)+1; const raw=JSON.parse(html.slice(s,e)); console.log('index.html RAW 数量:', raw.length);"
# 判定标准：items.json 数量必须与 index.html 中的 RAW 数量完全相等
```

---

## 5. 配置文件与多端联动约束

### 紧凑字典字段契约（`index.html` 中的 `RAW` 数组）
| 字段键名 | 展开属性 | 类型与取值规范 |
|---|---|---|
| `i` | `id` | 唯一字符串 ID（如 `cx-182-zhiye-dajia`、`cur-00178af6438d...`、`6aea205e...`） |
| `t` | `title` | 文章标题（中文或主标题） |
| `z` | `title_zh` | 中文译名（外文条目可选） |
| `s` | `source` | 媒体来源（如 `财新`、`中信证券`、`YouTube 总结`、`Anthropic Engineering` 等） |
| `d` | `date` | 发布时间（如 `2026-11-08T20:34+08:00` 或 `2026-11-08`） |
| `k` | `kind` | 类别枚举：`summary`（音视频总结） \| `curated`（精选长文） |
| `l` | `link` | 原文出处链接 |
| `a` | `audio` / `image` | 音频直链（`.m4a`）或文章封面图片 URL |
| `n` | `size` | 长度数组：`[size_summary, size_zh, size_orig]`，单位为字节数。无此项填 `0` |
| `x` | `added_at` | 入库处理时间戳 |
| `y` | `type` | 媒体子类型：`article` \| `video` \| `audio` \| `caixin` \| `podcast` |
| `rw`| `reconstructed` | 深度打磨标记（统一定为 `1`） |
| `au`| `author` | 原文作者（财新文章专有） |
| `is`| `issue` | 刊期来源（如 `财新周刊2026年第43期`） |

### 动态 Tab 渲染分支
- **财新报道（`r.s === '财新'`）**：
  - 仅渲染 2 栏：`速读` 与 `原文`；
  - 对应底层物理文件：`txt/<id>.txt` 与 `txt/<id>.orig.txt`；
  - 禁用 Tab 偏好记忆自动切换，防止外文设置覆盖财新视图。
- **其他精选长文与音视频总结**：
  - 渲染 3 栏：`总结`、`译文`、`原文`；
  - 对应底层物理文件：`txt/<id>.txt`、`txt/<id>.zh.txt`、`txt/<id>.orig.txt`；
  - 依据 `localStorage('mb_tab')`（`s` / `z` / `o`）自动激活用户偏好 Tab。

---

## 6. 已知踩坑经验与故障归因

1. **单边更新事故（条目未上屏）**：
   - 现象：在 `items.json` 中添加了新文章，但在前端网页列表中无法搜到。
   - 根因：`index.html` 采用内嵌 `const RAW = [...]` 进行首屏渲染，未执行内联更新。
   - 处置：每次新增或修改条目，必须同步重写 `index.html` 的 `RAW` 数组。
2. **`n` 数组字节偏差导致 Tab 丢失或 404**：
   - 现象：前端阅读界面对应 Tab 按钮消失，或点击后报 `404 Not Found`。
   - 根因：前端依赖 `r.n[k]` 是否大于 0 动态装配 `ITEMS.txt` 数组。若磁盘上有文件但 `n` 填 0，前端会直接滤除该 Tab；若磁盘无文件但 `n` 填了非零值，会触发无效网络 fetch。
   - 处置：运行 `node tools/bundle-standalone.mjs`，该脚本会全量扫描文件并输出 `missing` 计数。凡出现 `missing > 0` 立即终止提交并修正。
3. **AI 导语与机翻腔污染**：
   - 现象：正文开头出现「本文针对……进行总结」「核心要点如下：」等 AI 生成特征套话，或顶部带有复合原链接。
   - 处置：严格执行「首部净空法则」，首句必须承载实质性事实，行文遵循客观技术分析风格。
4. **离线单文件体积失控**：
   - 现象：全量单文件导出体积过大（已超 27MB），移动端浏览器加载缓慢。
   - 处置：`bundle-standalone.mjs` 支持构建 `lite` 模式（`mediabrief-lite.html`），该模式自动剔除体积极大的英文原文（`orig.txt`），将单文件体积控制在 10MB 以内，满足轻量离线传输需求。
