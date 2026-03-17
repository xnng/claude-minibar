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

Usage quota (5h/7d) requires a Pro/Max/Team subscription. The data flow:

1. **Read credentials** — OAuth token from macOS Keychain, stored by Claude Code CLI or [Claude Code Desktop](https://claude.ai/download)
2. **Call API** — Fetches usage from Anthropic OAuth API
3. **Cache** — Successful results are cached for 5 minutes. If the API is temporarily unavailable (rate-limited, network error), the last successful result is shown until the next successful refresh

API key users (no OAuth login) won't see the usage line — this is expected.

## Requirements

- Claude Code CLI
- Node.js >= 18
- macOS (for usage quota — reads OAuth token from Keychain)

## License

MIT
