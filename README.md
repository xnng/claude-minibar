# claude-minibar

Minimal 2-line statusline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

```
[Opus 4.6 (1M context) | High] Context 12% | 5 files +925 -120
Usage ░░░░░░░░░░ 3% (3h 52m / 5h) | ██░░░░░░░░ 23% (3d / 7d)
```

## Features

- **Model & Effort** — Shows current model name and thinking effort level (High/Med/Low)
- **Context** — Context window usage percentage with color coding (green → yellow → red)
- **File Changes** — Real-time session diff stats (files changed, lines added/removed) via incremental transcript parsing
- **Usage Quota** — 5-hour and 7-day usage with progress bars and reset countdown (Pro/Max/Team)
- **Zero Dependencies** — Pure Node.js, no build step, no external packages
- **Fast** — Incremental parsing with file-based caching; only new transcript entries are processed

## Install

```bash
/install-plugin xnng/claude-minibar
```

## How It Works

| Feature | Data Source |
|---------|------------|
| Model name | stdin JSON from Claude Code |
| Effort level | `~/.claude/settings.json` |
| Context % | stdin `context_window.used_percentage` |
| File changes | Incremental parsing of session transcript JSONL |
| Usage quota | Anthropic OAuth API via macOS Keychain credentials |

## Requirements

- Claude Code CLI
- Node.js >= 18
- macOS (for usage quota — reads OAuth token from Keychain)

## License

MIT
