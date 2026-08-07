# Fabre Node Reference Guide

[← Back to README](../README.md) | [Architecture & Implementation Plan](./plan.md)

In Fabre, workflows are constructed by connecting **Flow Ports (Triangles)** for control flow execution and **Data Ports (Circles)** for value passing.

- 🔺 **Flow Ports**: Dictate execution order and branching logic between nodes.
- 🟢/🔵 **Data Ports**: Pass text, numerical values, structured canonical message objects, or tool configuration payloads.

---

## 📌 Node Categories

- [1. Event & Flow Control](#1-event--flow-control) (`event_wait`, `start`, `condition`)
- [2. LLM & Prompt Engineering](#2-llm--prompt-engineering) (`prompt`, `llm`, `extractor`)
- [3. Memory & Session](#3-memory--session) (`session`, `set_var`)
- [4. Tools & Environment](#4-tools--environment) (`tool_config`, `tool`)
- [5. View & Output](#5-view--output) (`stream_view`, `output`)

---

### 1. Event & Flow Control

#### ⚡ User Event Wait (`event_wait`)
Triggers or resumes workflow execution based on user chat input or UI events. Used in multi-turn agents like [End-to-End Infinite Chat](../samples/e2e-infinite-chat.fabre).
- **Input Ports**:
  - `flow-in` (Flow): Flow input for loop resumption
- **Output Ports**:
  - `flow-out` (Flow): Outgoing flow triggered on event arrival
  - `data-out` (Data): Received input text
- **Inspector Properties**:
  - **Last Event Value**: Default or last received event string.

#### 🚀 Workflow Start (`start`)
Entry point node for starting workflow execution.
- **Output Ports**:
  - `flow-out` (Flow): Initial execution flow
  - `data-out` (Data): Initial text value
- **Inspector Properties**:
  - **Initial Input Value**: Default text passed on workflow start.

#### 🔀 Condition Branch (`condition`)
Evaluates input text against defined rules and routes execution flow to `True` or `False`. Used in [Condition Branching](../samples/condition-branching.fabre) and [Self-Debugging Agent Loop](../samples/self-fixing-loop.fabre).
- **Input Ports**:
  - `flow-in` (Flow): Flow input
  - `text-in` (Data): Input text to evaluate
- **Output Ports**:
  - `flow-true` (Flow): Flow out when evaluation succeeds
  - `flow-false` (Flow): Flow out when evaluation fails
  - `result-out` (Data): Text result (`"true"` or `"false"`)
- **Inspector Properties**:
  - **Rule Type**: `Contains`, `Regex Match`, or `JS Expression`.
  - **Match Value / Pattern**: String or regular expression pattern (e.g., `PASS`).

---

### 2. LLM & Prompt Engineering

#### 📝 Prompt Builder (`prompt`)
Constructs prompt templates supporting template variable interpolation (`{{variable_name}}`).
- **Input Ports**:
  - `flow-in` (Flow): Flow input
  - `data-in` (Data): Data input for variable substitution
- **Output Ports**:
  - `flow-out` (Flow): Flow output on completion
  - `prompt-out` (Data): Compiled prompt text
- **Inspector Properties**:
  - **Prompt Template**: Template string containing placeholders like `{{inputValue}}`.
  - **🪄 Refine Prompt**: Uses LLM to automatically optimize the prompt template.
  - **✏️ Revise Prompt with Comment**: Rewrites the template based on specific instructions (e.g., "Make it concise").

#### 🤖 LLM Call (`llm`)
Sends queries to Large Language Models (LLMs) to perform generation or Function Calling.
- **Input Ports**:
  - `flow-in` (Flow): Flow input
  - `prompt-in` (Data): Input prompt text
  - `session-in` (Data, Optional): Connected `Session Manager` object
  - `tools-in` (Data, Optional): Connected `Tool Config` object
- **Output Ports**:
  - `flow-success` (Flow): Flow triggered on successful response
  - `flow-error` (Flow): Flow triggered on error (API failure, CORS, network timeout)
  - `response-out` (Data): Natural language response text
  - `tool-call-out` (Data): Emitted Function Calling payload (`tool_calls`)
- **Inspector Properties**:
  - **System Instruction**: System prompt defining the AI persona/role.
  - **Temperature**: Randomness slider (0.0 to 1.0).
  - **Enable Tools**: Toggle native tool calling / function calling.
  - **Provider / Model / Endpoint Overrides**: Local configuration overrides.

#### ✂️ Content Extractor (`extractor`)
Parses and extracts structured data or code snippets from LLM outputs. Used in [JS Sandbox Browser Alert Agent](../samples/js-sandbox-alert-agent.fabre).
- **Input Ports**:
  - `flow-in` (Flow): Flow input
  - `text-in` (Data): Raw text to parse
- **Output Ports**:
  - `flow-out` (Flow): Flow output on completion
  - `extracted-out` (Data): Extracted target text
- **Inspector Properties**:
  - **Extractor Type**:
    - `code_block`: Extracts code within markdown blocks (e.g., ```js ... ```).
    - `json_key`: Parses JSON string and retrieves value for a specific key.
    - `regex`: Extracts regex capture group matches.
    - `delimiter`: Extracts text between specified start and end delimiter strings.

---

### 3. Memory & Session

#### 🧠 Session Manager (`session`)
Central authority for structured multi-turn conversation memory (`Canonical Messages`). Used in [Tool Calling Agent](../samples/tool-calling-agent.fabre) and [End-to-End Infinite Chat](../samples/e2e-infinite-chat.fabre).
- **Input Ports**:
  - `flow-in` (Flow): Flow input
  - `user-in` (Data): User turn text
  - `tool-result-in` (Data): Tool execution output (`role: 'tool'`)
- **Output Ports**:
  - `flow-out` (Flow): Flow output on completion
  - `session-out` (Data): Session context object (connected to LLM `session-in`)
  - `messages-out` (Data): Array of structured messages (connected to Stream View `messages-in`)
- **Inspector Properties**:
  - **Max History Turns**: Sliding window turn count limit.
  - **Model / Endpoint Overrides**: Per-session LLM backend configurations.

#### 💾 Set Variable (`set_var`)
Stores and persists data values into global workflow state variables.
- **Input Ports**:
  - `flow-in` (Flow): Flow input
  - `value-in` (Data): Value to store
- **Output Ports**:
  - `flow-out` (Flow): Flow output on completion
  - `value-out` (Data): Stored variable value
- **Inspector Properties**:
  - **Variable Name**: Global state variable key (e.g., `extracted_code`).

---

### 4. Tools & Environment

#### ⚙️ Tool Environment Config (`tool_config`)
Aggregates built-in tools and MCP (Model Context Protocol) servers for LLM consumption.
- **Output Ports**:
  - `tools-out` (Data): Consolidated tool schema payload (connected to LLM `tools-in`)
- **Inspector Properties**:
  - **Enabled Built-In Tools**: Toggles for `js_sandbox`, `read_file`, `write_file`, `list_files`, `mock_search`, etc.
  - **Require Tool Call**: Forces the LLM to select a tool.
  - **Duplicate Global Defaults**: Copies current environment defaults into local node configuration.

#### 🛠️ Tool Execution (`tool`)
Executes the specified local or sandbox tool with input parameters. Used in [Tool Calling Agent](../samples/tool-calling-agent.fabre).
- **Input Ports**:
  - `flow-in` (Flow): Flow input
  - `input-in` (Data): Input code or argument payload (connected to LLM `tool-call-out`)
- **Output Ports**:
  - `flow-out` (Flow): Flow output on completion
  - `output-out` (Data): Execution result string (connected to Session Manager `tool-result-in`)
- **Inspector Properties**:
  - **Tool Type**: Selects tool executor (`js_sandbox`, `read_file`, `write_file`, `list_files`, `mock_search`, etc.).

---

### 5. View & Output

#### 📜 Stream View (`stream_view`)
Renders real-time multi-turn conversation timelines and streamed execution logs.
- **Input Ports**:
  - `flow-in` (Flow): Flow input
  - `text-in` (Data): Stream text to append
  - `messages-in` (Data): Structured canonical message array from Session Manager
- **Output Ports**:
  - `flow-out` (Flow): Flow output to next node

#### 🎯 Output (`output`)
Terminal node displaying final workflow outputs on a canvas card.
- **Input Ports**:
  - `flow-in` (Flow): Flow input
  - `data-in` (Data): Text output data
- **Inspector Properties**:
  - **Label**: Title displayed on the output card header.
