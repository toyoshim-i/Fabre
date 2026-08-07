# Fabre: Flow-based Agent Builder & Runtime Engine - Detailed Implementation Plan

[← Back to README](../README.md) | [Node Reference Guide](./nodes.md)

**Fabre** is a zero-dependency, pure-vanilla web application that allows users to visually design, debug, and run LLM agent workflows using a node-based interface. The name is inspired by Jean-Henri Fabre, the entomologist, as this application acts as an observation and debugging harness for autonomous agents and program "bugs".

---

## 1. Development Process & Review Workflow

We will proceed with the development step-by-step, inserting user reviews and Git commits at the end of each phase.

1. **Step Completion**: Add the features corresponding to the current implementation phase.
2. **Verification & Review**: Present the changes and explain how the user can test the features in the browser.
3. **User Approval & Commit**: Upon user confirmation and approval, execute a Git commit.
4. **Proceed**: Move on to the next phase on the checklist.

---

## 2. Core Architecture: Browser Native File System API & LLM Tool Calling Integration

To bridge the browser, local filesystem files, and LLM tool execution, we integrate the following two mechanisms:

### A. Chrome File System Access API (Local Directory Connection)
We use the browser's standard `window.showDirectoryPicker()` to obtain read/write access to the user-selected local source code directory (e.g., this project's workspace).
- **UI Element**: A "Select Local Directory" button. Once connected, a sidebar displays a lightweight, live file tree.
- **Security**: Operates purely client-side using standard browser permission dialogs, keeping the application entirely serverless and secure.

### B. LLM Tool Calling (Functions Integration)
We supply the LLM node with **built-in local tools** (`list_files`, `read_file`, `write_file`, and `run_mock_tests`).
- **Ollama/LM Studio/OpenAI (Native Tool Calling)**: Passed via the API's `tools` parameter, handling the LLM's `tool_calls` responses by reading/writing filesystem handles directly in the browser.
- **Chrome Built-in AI (Prompt-based ReAct Fallback)**: For models without native tool calling support (e.g. Gemini Nano in Chrome), we inject tool descriptions into the system prompt and parse text outputs (e.g. `Tool: read_file("app.js")`) using regex, returning outputs in the next chat turn.

---

## 3. Node Specifications & Port Designs

Ports are strictly divided into **Flow Ports (Triangles)** to decide execution order, and **Data Ports (Circles)** to pass values.

### ① Start Node
- **Outputs**: `Start (Flow)`, `Initial Input (Data)` (loaded file content or default text).
- **Properties**: Textarea for default input values.

### ② Prompt Builder Node
- **Inputs**: `Trigger (Flow)`, `Variable Inputs (Data)`
- **Outputs**: `Next (Flow)`, `Prompt Text (Data)`
- **Properties & LLM Assistance**:
  - **Prompt Template Textarea**: User writes prompt templates with variables like `{{variable_name}}`.
  - **"Refine Prompt" Button**: Sends a meta-prompt to the LLM to automatically optimize the current prompt template.
  - **"Revise Prompt with Comment"**: An input box where users can write revision requests (e.g. "make it more concise"). Clicking "Revise" calls the LLM to rewrite the template accordingly.
  - *Note: Variable syntax like `{{variable_name}}` is preserved during LLM-based rewrites.*

### ③ LLM Call Node
- **Inputs**: `Trigger (Flow)`, `System Prompt (Data, Optional)`, `Prompt Text (Data)`
- **Outputs**: `Success (Flow)`, `Error (Flow)`, `Response Text (Data)`
- **Properties**: Temperature slider, provider dropdown (Global Settings, Chrome AI, or Custom API). Toggle to "Enable Filesystem Tools".

### ④ Extractor Node
- **Inputs**: `Trigger (Flow)`, `Source Text (Data)`
- **Outputs**: `Next (Flow)`, `Extracted Value (Data)`
- **Properties**: Selector to pick extraction rule:
  1. *Markdown Code Block*: Isolates contents of triple backtick blocks.
  2. *JSON Key*: Parses JSON and retrieves the value of a specific key.
  3. *Regex Group*: Extracts matched regex group (e.g. `【Verdict】(PASS|FAIL)`).
  4. *Delimiter*: Extracts text between custom start/end strings.

### ⑤ Condition / Branch Node
- **Inputs**: `Evaluate (Flow)`, `Target Text (Data)`
- **Outputs**: `True (Flow)`, `False (Flow)`
- **Properties**: Rules selection (`Contains`, `Regex Match`, `JS Expression`) and matching values.

### ⑥ Set Variable Node
- **Inputs**: `Trigger (Flow)`, `Value (Data)`
- **Outputs**: `Next (Flow)`
- **Properties**: Target variable name (e.g., `file_content`).

### ⑦ Tool Execution Node
- **Inputs**: `Trigger (Flow)`, `Input Data (Data)`
- **Outputs**: `Next (Flow)`, `Result (Data)`
- **Properties**: Dropdown to select mock tools (e.g., Mock Code Compiler, Mock Web Search).

### ⑧ Output Node
- **Inputs**: `Done (Flow)`, `Output Text (Data)`
- **Properties**: Label (e.g., "Final Verdict").

---

## 4. Engineering Module Designs

### ① Canvas & Drag-and-Drop Engine
Implemented using standard HTML5 pointer/mouse events and SVG.
- Panning (dragging with spacebar or right click) and zooming (mouse wheel).
- Real-time recalculation of SVG cubic bezier connection paths (`d="M x1 y1 C..."`) as nodes are dragged.

### ② Step-by-Step Interpreter (State Machine)
- **Execution States**: `Idle`, `Running`, `Paused`, `Error`.
- **Flow Control**:
  - Auto mode loops through nodes with a adjustable delay.
  - Step mode runs the active node, determines the next node, highlights it, and transitions to `Paused` awaiting the next step command.
  - Signal animations (glowing dots traveling along SVG lines) trigger upon node state transitions.

### ③ LLM Clients & CORS Handlers
- Auto-detects `window.ai` on launch.
- If fetch to external API fails, catches error and displays a modal troubleshooting dialog suggesting specific server-side settings (e.g., `OLLAMA_ORIGINS="*" ollama serve`).

---

## 5. Phased Implementation Timeline

* **【Phase 1】Base Application Setup & UI Layout**
  * Create `index.html`, `style.css`, and `app.js` skeleton files.
  * Build dark-theme glassmorphism workspace UI with two-pane layout.
* **【Phase 2】Canvas Engine & Drag-and-Drop Port Connections**
  * Implement mouse panning/zooming and node drag handles.
  * Implement port-dragging connection logic and SVG bezier rendering.
* **【Phase 3】File System Access API & Sidebar File Tree**
  * Implement directory picker and file read/write operations.
  * Render a file explorer in the sidebar panel.
* **【Phase 4】Node Cards UI & Prompt Refiner Features**
  * Design cards for all node types and implement the properties inspector panel.
  * Wire up the Prompt Node's LLM-based Refine and Revise functionalities.
* **【Phase 5】Asynchronous State Interpreter & Tool Use Engine**
  * Program the execution runner supporting auto/step controls.
  * Build native and prompt-based Tool Calling handlers for file operations.
* **【Phase 6】LLM Integrations & CORS Alert Dialog**
  * Add Ollama/OpenAI API integrations and CORS connection error modal.
* **【Phase 7】Agent Templates & Fine-Tuning**
  * Add the "Self-Correction Coding Agent" template.
  * Implement local storage save/load for node configurations and final visual polishing.
