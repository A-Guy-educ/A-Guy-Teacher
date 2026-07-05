# Renderers

Schema definitions for the structured view renderers the Aguy in-app chat understands. Each JSON file describes one renderer rule (`purpose` + `data` shape). The renderer implementation in [`src/ui/web/chat/ChatMessageView/`](../../src/ui/web/chat/ChatMessageView/) mirrors these shapes.

The three renderers today:

- **approval-card** — body + multiple action buttons; the user picks one. Posts that action's `response`.
- **selection-list** — choose exactly one item. Posts the item's `id` (or `label` fallback).
- **multi-select-list** — choose zero or more items. Posts the joined labels.

A renderer fires when the message content contains a JSON payload matching the renderer shape:

1. The whole message content is a JSON object whose top-level `purpose` is one of the renderer names; or
2. The message contains a JSON-fenced code block (`​```json … ```​`) whose body is a JSON object whose top-level `purpose` is one of the renderer names.

If no renderer matches, the message falls back to plain markdown. Malformed payloads never crash the chat — they degrade gracefully.
