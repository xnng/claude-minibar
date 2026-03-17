# claude-minibar

[English](./README.md) | [中文](./README.zh-CN.md)

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) 极简两行状态栏。

![preview](preview.png)

## 功能

- **模型 & 思考强度** — 当前模型名称和思考强度（High/Med/Low）
- **上下文** — 上下文窗口使用率，带颜色指示（绿 → 黄 → 红）
- **会话时长** — 当前会话已持续的时间
- **文件变更** — 本次会话的实时 diff 统计（文件数、增删行数），通过增量解析 transcript 实现
- **用量配额** — 5 小时 / 7 天用量，带进度条和重置倒计时（Pro/Max/Team）
- **零依赖** — 纯 Node.js，无需构建，无外部依赖
- **高性能** — 增量解析 + 文件缓存，只处理新增的 transcript 条目

## 安装

在 Claude Code 中执行：

```
/plugin marketplace add xnng/claude-minibar
/plugin install claude-minibar@claude-minibar
```

重启 Claude Code，然后执行 setup 命令：

```
/claude-minibar:setup
```

该命令会自动配置 `settings.json` 中的 `statusLine`。再次重启 Claude Code 即可看到状态栏。

## 工作原理

| 功能 | 数据来源 |
|------|---------|
| 模型名称 | Claude Code 通过 stdin 传入的 JSON |
| 思考强度 | `~/.claude/settings.json` |
| 上下文 % | stdin `context_window.used_percentage` |
| 会话时长 | 会话 transcript JSONL 的第一条时间戳 |
| 文件变更 | 增量解析会话 transcript JSONL |
| 用量配额 | Anthropic OAuth API（通过 macOS Keychain 凭据） |

## 用量配额

用量配额（5h/7d）需要 Pro/Max/Team 订阅。API key 用户不会显示此行。

```mermaid
sequenceDiagram
    participant M as Minibar
    participant C as 缓存
    participant F as 文件凭据<br/>~/.claude/.credentials.json
    participant API as Anthropic Usage API
    participant K as Keychain 凭据<br/>Claude Code Desktop

    M->>C: 读取缓存
    alt 缓存有效（< 5分钟）
        C-->>M: 返回缓存数据
    else 过期或为空
        M->>F: 读取 CLI token
        F-->>M: token（或为空）
        opt 有 token
            M->>API: GET /api/oauth/usage
            alt 200 OK
                API-->>M: 用量数据
                M->>C: 写入缓存（TTL 5分钟）
            else 429 限流
                Note over M: 降级到 Desktop 凭据
                M->>K: 读取 Keychain token
                K-->>M: token（或为空）
                opt 有 token
                    M->>API: GET /api/oauth/usage
                    alt 200 OK
                        API-->>M: 用量数据
                        M->>C: 写入缓存（TTL 5分钟）
                    else 失败
                        M->>C: 写入失败缓存（TTL 60秒）
                    end
                end
            else 其他错误
                M->>C: 写入失败缓存（TTL 60秒）
            end
        end
    end
```

- **主路径**：文件凭据，CLI 登录时写入（`~/.claude/.credentials.json`）
- **降级策略**：API 返回 429 时，使用 [Claude Code Desktop](https://claude.ai/download) 写入 Keychain 的凭据重试
- **刷新频率**：成功缓存 5 分钟，失败缓存 60 秒。状态栏在每次工具调用后渲染，缓存过期时自动刷新
- 如果持续遇到 429 错误，安装 Claude Code Desktop 可提供备用凭据源

## 系统要求

- Claude Code CLI
- Node.js >= 18
- macOS（用量配额需要从 Keychain 读取 OAuth token）

## 许可证

MIT
