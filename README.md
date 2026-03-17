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

Usage quota (5h/7d) requires a Pro/Max/Team subscription. The credential flow with fallback:

1. **File credentials** (`~/.claude/.credentials.json`) — OAuth token stored by Claude Code CLI login. This is the primary source and works for most users.
2. **API call** — Fetches usage from Anthropic OAuth API using the token above.
3. **429 fallback** — If the API returns 429 (rate-limited), minibar retries with credentials from **macOS Keychain** (stored by [Claude Code Desktop](https://claude.ai/download)). This requires the Desktop app to be installed and logged in.
4. **Cache** — Successful results are cached for 5 minutes. During API failures, the last successful result continues to display.

> **Note**: If you experience persistent 429 errors, installing Claude Code Desktop provides an alternative credential source that may resolve the issue.

API key users (no OAuth login) won't see the usage line — this is expected.

## Requirements

- Claude Code CLI
- Node.js >= 18
- macOS (for usage quota — reads OAuth token from Keychain)

## License

MIT
