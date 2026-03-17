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

## Usage Quota Data

Usage quota (5h/7d) is fetched from the Anthropic OAuth API. The credential acquisition flow:

1. **macOS Keychain** — Reads OAuth token stored by Claude Code CLI login. This is the primary method.
2. **claude-hud cache fallback** — If the API call fails (rate-limited, network error, etc.), minibar will try to read cached usage data from the [claude-hud](https://github.com/jarrodwatts/claude-hud) plugin (`~/.claude/plugins/claude-hud/.usage-cache.json`). This requires claude-hud to have been installed previously. If you've never installed claude-hud, the usage line won't show until the API call succeeds.
3. **Self cache** — Once a successful API call is made, the result is cached for 5 minutes. Subsequent renders use the cache without hitting the API.

> **Tip**: If you have [Claude Code Desktop](https://claude.ai/download) installed, it stores OAuth credentials in macOS Keychain which minibar can read directly. This is useful when the CLI-stored token is unavailable or expired.

## Requirements

- Claude Code CLI
- Node.js >= 18
- macOS (for usage quota — reads OAuth token from Keychain)

## License

MIT
