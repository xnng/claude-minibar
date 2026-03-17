---
description: Configure claude-minibar as your statusline
allowed-tools: Bash, Read, Edit
---

# Setup claude-minibar

Configure claude-minibar as the Claude Code statusline.

## Step 1: Find the plugin install path

```bash
# Find the claude-minibar plugin cache directory
MINIBAR_DIR=$(ls -d ~/.claude/plugins/cache/*/claude-minibar/*/ 2>/dev/null | head -1)
echo "Plugin path: ${MINIBAR_DIR:-NOT FOUND}"
```

If not found, the plugin may not be installed. Tell the user to run `/install-plugin xnng/claude-minibar` first.

## Step 2: Verify the entry point exists

```bash
ls "${MINIBAR_DIR}src/index.mjs" 2>/dev/null && echo "OK" || echo "MISSING"
```

## Step 3: Update settings.json

Read `~/.claude/settings.json` and set the `statusLine` field:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ${MINIBAR_DIR}src/index.mjs"
  }
}
```

Use the `Edit` tool to update the `statusLine` entry. If no `statusLine` field exists, add it.

**Important**: Replace `${MINIBAR_DIR}` with the actual path found in Step 1.

## Step 4: Confirm

Tell the user: "claude-minibar is configured! Restart Claude Code to see it in action."
