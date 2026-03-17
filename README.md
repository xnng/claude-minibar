# claude-minibar

Minimal 2-line statusline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

![preview](preview.png)

## Features

- **Model & Effort** — Current model name and thinking effort level (High/Med/Low)
- **Context** — Context window usage with color coding (green → yellow → red)
- **Session Duration** — How long the current session has been running
- **File Changes** — Real-time session diff stats (files changed, lines +/-) via incremental transcript parsing
- **Usage Quota** — 5h / 7d usage with progress bars and reset countdown (Pro/Max/Team)
- **Zero Dependencies** — Pure Node.js, no build step, no external packages
- **Fast** — Incremental parsing with file-based caching; only new transcript entries are processed

## Install

In Claude Code, run:

```
/plugin marketplace add xnng/claude-minibar
/plugin install claude-minibar@claude-minibar
```

Restart Claude Code, then run the setup command:

```
/claude-minibar:setup
```

This will configure your `statusLine` in `settings.json` automatically. Restart Claude Code again to see the statusline.

## How It Works

| Feature | Data Source |
|---------|------------|
| Model name | stdin JSON from Claude Code |
| Effort level | `~/.claude/settings.json` |
| Context % | stdin `context_window.used_percentage` |
| Session duration | First timestamp in session transcript JSONL |
| File changes | Incremental parsing of session transcript JSONL |
| Usage quota | Anthropic OAuth API via macOS Keychain credentials |

## Usage Quota

Usage quota (5h/7d) requires a Pro/Max/Team subscription. API key users won't see this line.

```mermaid
flowchart TD
    A[statusline render] --> B{self cache valid?}
    B -->|"< 5min"| Z[return cached data]
    B -->|"failed cache < 60s\nwith lastGoodData"| Z2[return lastGoodData]
    B -->|expired / empty| C{read file credentials\n~/.claude/.credentials.json}

    C -->|found| D[call Anthropic Usage API]
    C -->|not found| F

    D -->|200 OK| E[write cache, return data]
    D -->|429| F{read Keychain credentials\nClaude Code Desktop}
    D -->|other error| G

    F -->|found| H[call Anthropic Usage API]
    F -->|not found| G

    H -->|200 OK| E
    H -->|failed| G

    G{lastGoodData exists?}
    G -->|yes| I[write failed cache 60s\nreturn lastGoodData]
    G -->|no| J[no Usage line displayed\nretry on next render]

    style F fill:#f9f0ff,stroke:#9b59b6
    style Z fill:#e8f5e9,stroke:#4caf50
    style Z2 fill:#e8f5e9,stroke:#4caf50
    style E fill:#e8f5e9,stroke:#4caf50
    style J fill:#fff3e0,stroke:#ff9800
```

**Refresh**: Successful cache expires after **5 minutes**. Failed cache expires after **60 seconds**. The statusline re-renders on every tool call, triggering a refresh when cache expires.

**Degradation**: File credentials (CLI login) are the primary source. Keychain credentials (Desktop) are only used as a fallback when the API returns 429. If you experience persistent 429 errors, installing [Claude Code Desktop](https://claude.ai/download) provides an alternative credential source.

## Requirements

- Claude Code CLI
- Node.js >= 18
- macOS (for usage quota — reads OAuth token from Keychain)

## License

MIT
