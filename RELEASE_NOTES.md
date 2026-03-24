## v0.4.0

### Features

- **AI chat agent**: Talk to your financial data in the dashboard using a local LLM. Download and run GGUF models (Qwen, Gemma, Llama) with Vulkan/CUDA/CPU auto-detection — no cloud API keys required. The agent can query your database, run CLI commands, search transactions, analyze spending, and load domain-specific skills, all with real-time streaming, markdown rendering, and tool call visualization.
- **AI model management**: Download, switch, and configure models from the dashboard. Tier-based inference profiles automatically scale context window, available tools, and iteration limits to match model capability. Toggle thinking mode and resize context per-session.
- **Sync cancellation**: Cancel in-progress bank syncs from the dashboard.
- **Category rules from transactions**: Create categorization rules directly from individual transactions.
- **Translation pagination**: Server-side pagination for translation rule lists.
- **Currency normalization**: Automatically normalize currency symbols (₪, $, €, etc.) to ISO 4217 codes during sync.

### Bug Fixes

- **Aborted stream handling**: Properly handle aborted SSE streams and filter empty assistant messages that caused the LLM to loop on tool calls.
- **Stale chat history**: Fixed race condition where rapid messages during active streaming would send incomplete conversation history to the model.

### Security

- **SQL injection hardening**: Block write keywords (INSERT, UPDATE, DELETE, DROP, etc.) even inside CTEs that bypass the read-only prefix check. Secondary defense via `columnNames` check retained.
- **Subprocess credential isolation**: Subprocess environment uses a denylist to strip secrets (API keys, tokens, passwords, cloud credentials) while keeping system vars needed for module resolution.
- **Subprocess timeout**: CLI commands spawned by the agent are killed after 60 seconds to prevent hung processes from blocking inference indefinitely.
- **Inference concurrency lock**: Prevents concurrent access to the shared LLM sequence/context singletons, avoiding KV cache corruption and native crashes.
- **Context warmup isolation**: Warmup exchanges are cleared from the sequence after completion and gated behind the inference lock to prevent overlap with real requests.
- **GPU memory leak fix**: Properly dispose the native Vulkan/CUDA runtime (`llamaInstance`) on model unload — was previously only nulled, leaking GPU memory on every model switch.
- **Windows device name guard**: Block reserved device names (CON, NUL, PRN, AUX, COM0-9, LPT0-9) in config file path validation to prevent hang-on-read DoS.

### Other

- Removed underperforming local models from the registry.
- Added email/GitHub fields and OS tracking to the issue feedback form.
- Added uninstall command documentation.
