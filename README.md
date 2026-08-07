# Fabre - Flow-based Agent Builder & Runtime Engine

**Fabre** is a zero-dependency, pure-vanilla JavaScript web application for visually designing, executing, and debugging LLM AI agent workflows through a serverless, node-based canvas interface.

The name is inspired by Jean-Henri Fabre, the famous entomologist, as this environment serves as an observation and debugging harness for autonomous agent behaviors and software "bugs".

---

## ✨ Key Features

- 🚀 **Serverless & Pure Vanilla Frontend (Zero-Dependency)**
  - Runs entirely in the browser using HTML, CSS, and modern Vanilla JavaScript with no backend build tools or external server dependencies required.
- 🎨 **Visual Node-Based Canvas Workflow Editor**
  - Smooth Bezier curve wire connections, canvas panning and zooming, live execution signal animations (visualizing data and flow execution), and structured runtime debug logs.
- 🧠 **First-Class Conversation Memory (Session Manager)**
  - Structured canonical message history management (`role: 'user' | 'assistant' | 'system' | 'tool'`).
  - Sliding window turn trimming (`maxHistoryTurns`) and per-session LLM model/endpoint configuration overrides.
- 🛠️ **Native Tool Calling & MCP (Model Context Protocol) Integration**
  - OpenAI Function Calling schema compatibility via `tool-call-out` ports.
  - Environment node (`tool_config`) to configure built-in tools (JS Sandbox, local filesystem tools `read_file`/`write_file`/`list_files`, mock web search) and external MCP servers.
- 🤖 **Flexible LLM Provider Support**
  - Out-of-the-box integration with Ollama, OpenAI-compatible REST APIs, and Chrome Built-in AI (`window.ai` / Gemini Nano).
- ✏️ **AI-Assisted Prompt Optimization**
  - Built-in Prompt node features for automated prompt template refining ("Refine Prompt") and user-guided prompt editing ("Revise Prompt").
- 📁 **Browser-Native File System Access API Integration**
  - Connect local working directories directly through the browser's native File System Access API with a live sidebar file tree explorer.
- 🌐 **Full Internationalization (i18n)**
  - One-click language toggling between English and Japanese.

---

## 📦 Bundled Sample Workflows

You can load and explore pre-built agent workflows via the "Load Sample Workflow" menu or from the `samples/` directory:

1. **Tool Calling Agent (`tool-calling-agent.fabre`)**
   - 2-Pass Native Function Calling workflow: LLM emits structured tool calls via `tool-call-out` -> JS Sandbox executes -> Session Manager records tool output -> 2nd LLM synthesizes natural language answer.
2. **End-to-End Infinite Chat (`e2e-infinite-chat.fabre`)**
   - Multi-turn conversational agent equipped with Session Manager memory, Tool Config environment, and Stream View timeline rendering.
3. **JS Sandbox Browser Alert Agent (`js-sandbox-alert-agent.fabre`)**
   - Code generation, markdown extraction, browser JS execution, and `flow-error` fallback handling.
4. **Self-Debugging Agent Loop (`self-fixing-loop.fabre`)**
   - Autonomous error-correction loop that detects execution errors via Condition branching and feeds error messages back into the LLM prompt.
5. **Condition Branching & Flow (`condition-branching.fabre`)**
   - Basic control flow branching based on text evaluation rules (`PASS` / `FAIL`).

---

## 🚀 Quick Start

No backend installation or compilation is needed. Host the repository root with any static web server or open `index.html` directly in your browser.

**Using Python:**
```bash
python3 -m http.server 8080
```
Open `http://localhost:8080` in your browser.

**Using Node.js (npx):**
```bash
npx servor . 8080
```

---

## 🧪 Testing

Run the comprehensive unit and integration test suite via the Node.js standard test runner:

```bash
npm test
```

All 38 test suites evaluate model mutations, state hydration, node executions, and sample workflow flows against mock LLM providers.

---

## 📚 Documentation

- [Node Reference Guide (docs/nodes.md)](file:///home/toyoshim/Work/self/docs/nodes.md) - Complete reference for all 11 node types, ports, properties, and data schemas.

---

## 📄 License

MIT License
