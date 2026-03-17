# claude-minibar

Minimal 2-line statusline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

![preview](preview.png)

## Features

- **Model & Effort** — Current model name and thinking effort level (High/Med/Low)
- **Context** — Context window usage with color coding (green → yellow → red)
- **File Changes** — Real-time session diff stats (files changed, lines +/-) via incremental transcript parsing
- **Usage Quota** — 5h / 7d usage with progress bars and reset countdown (Pro/Max/Team)
- **Zero Dependencies** — Pure Node.js, no build step, no external packages
- **Fast** — Incremental parsing with file-based caching; only new transcript entries are processed

## Install

```bash
/install-plugin xnng/claude-minibar
```

After installing, run the setup command in Claude Code:

```
/claude-minibar:setup
```

This will configure your `statusLine` in `settings.json` automatically.

## How It Works

| Feature | Data Source |
|---------|------------|
| Model name | stdin JSON from Claude Code |
| Effort level | `~/.claude/settings.json` |
| Context % | stdin `context_window.used_percentage` |
| File changes | Incremental parsing of session transcript JSONL |
| Usage quota | Anthropic OAuth API via macOS Keychain credentials |

### Usage Quota Credentials

By default, claude-minibar reads OAuth credentials from macOS Keychain (stored by Claude Code CLI).

If you have [Claude Code Desktop](https://claude.ai/download) installed, you can configure minibar to use its credentials instead — useful when the CLI keychain entry is unavailable or expired:

```
/claude-minibar:configure
```

## Requirements

- Claude Code CLI
- Node.js >= 18
- macOS (for usage quota — reads OAuth token from Keychain)

## License

MIT
