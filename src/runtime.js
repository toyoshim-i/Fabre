// Fabre - Flow-based Agent Builder & Runtime Engine
// Asynchronous Interpreter & Debugger State Machine
'use strict';

import { 
  state, 
  NODE_TYPES, 
  setVariable, 
  addLog,
  setRunnerState,
  setCurrentNodeId,
  incrementTotalSteps,
  resetRunner,
  addChatMessage
} from './state.js';
import { runLlmQuery } from './llm.js';
import { t } from './i18n.js';

let stepTimer = null;

/**
 * Execute a single step of the workflow starting from current node or Start node
 */
export async function stepWorkflow() {
  if (state.nodes.length === 0) {
    addLog(t('canvas_empty_log'), 'warning');
    return;
  }

  // 1. Locate starting node if not set
  if (!state.currentNodeId) {
    const startNode = state.nodes.find(n => n.type === NODE_TYPES.START) || state.nodes[0];
    if (startNode) {
      setCurrentNodeId(startNode.id);
    }
  }

  const currentNode = state.nodes.find(n => n.id === state.currentNodeId);
  if (!currentNode) {
    setRunnerState('error');
    addLog(t('current_node_not_found'), 'error');
    return;
  }

  setRunnerState('running');
  addLog(t('executing_node', { title: currentNode.title, type: currentNode.type }), 'info');

  try {
    // Evaluate Node
    const result = await evaluateNode(currentNode);
    incrementTotalSteps();

    // Determine outgoing flow port
    if (result.nextFlowPort === null) {
      setRunnerState('paused');
      return;
    }

    const nextFlowPort = result.nextFlowPort || 'flow-out';
    const nextLink = state.links.find(l => l.fromNode === currentNode.id && l.fromPort === nextFlowPort);

    if (currentNode.type === NODE_TYPES.OUTPUT) {
      setRunnerState('success');
      addLog(t('workflow_completed', { result: result.outputValue }), 'success');
      return;
    }

    if (nextLink) {
      setCurrentNodeId(nextLink.toNode);
      if (state.runnerState !== 'paused') {
        setRunnerState('paused'); // Step execution pauses after 1 step
      }
    } else {
      setRunnerState('success');
      addLog(t('end_of_flow'), 'info');
    }
  } catch (err) {
    setRunnerState('error');
    addLog(`Execution error at [${currentNode.title}]: ${err.message}`, 'error', err.stack);
  }
}

/**
 * Run continuous workflow loop until finished or paused
 */
export async function runWorkflow() {
  if (state.runnerState === 'running') return;
  
  if (state.runnerState === 'success' || state.runnerState === 'error') {
    resetWorkflow();
  }

  setRunnerState('running');
  
  const loop = async () => {
    if (state.runnerState !== 'running') return;
    
    await stepWorkflow();

    if (state.runnerState === 'running' || state.runnerState === 'paused') {
      // Keep running continuously if user did not press pause/error
      setRunnerState('running');
      stepTimer = setTimeout(loop, Math.max(50, state.executionDelay));
    }
  };

  loop();
}

/**
 * Pause execution loop
 */
export function pauseWorkflow() {
  if (stepTimer) {
    clearTimeout(stepTimer);
    stepTimer = null;
  }
  setRunnerState('paused');
  addLog(t('workflow_paused'), 'warning');
}

/**
 * Reset execution state machine
 */
export function resetWorkflow() {
  if (stepTimer) {
    clearTimeout(stepTimer);
    stepTimer = null;
  }
  resetRunner();
  addLog(t('workflow_reset'), 'info');
}

/**
 * Execute an interactive End-to-End Chat Turn:
 * 1. Appends User message to Chat history
 * 2. Injects User message into Start Node
 * 3. Runs the workflow steps continuously until completion
 * 4. Appends final Output result to Chat history
 */
export async function runChatTurn(userMessage) {
  if (!userMessage || !userMessage.trim()) return;

  const trimmed = userMessage.trim();

  // 1. Record User Message
  addChatMessage('user', trimmed);

  // 2. Locate Start Node and set input value
  const startNode = state.nodes.find(n => n.type === NODE_TYPES.START) || state.nodes[0];
  if (startNode) {
    startNode.data.inputValue = trimmed;
    setCurrentNodeId(startNode.id);
  }

  // 3. Reset runner state to running
  setRunnerState('running');

  // 4. Run step loop until workflow reaches Output or stops
  let lastOutputResult = '';
  while (state.runnerState === 'running' || state.runnerState === 'paused') {
    const currentNode = state.nodes.find(n => n.id === state.currentNodeId);
    if (!currentNode) break;

    const isOutputNode = currentNode.type === NODE_TYPES.OUTPUT;
    await stepWorkflow();

    if (isOutputNode) {
      const resultIn = getPortInputValue(currentNode.id, 'text-in');
      if (resultIn) {
        lastOutputResult = resultIn;
      }
      break;
    }

    if (state.runnerState === 'error' || state.runnerState === 'success') {
      break;
    }

    // Brief delay between steps to visualize signal flow on canvas
    await new Promise(r => setTimeout(r, Math.min(100, state.executionDelay)));
    setRunnerState('running');
  }

  // 5. If Output Node emitted a reply, record Assistant Message & update memory
  if (lastOutputResult) {
    addChatMessage('assistant', lastOutputResult);
    
    // Accumulate conversation memory into chat_history variable
    const history = (state.variables['chat_history'] || '') + `User: ${trimmed}\nAssistant: ${lastOutputResult}\n\n`;
    setVariable('chat_history', history);
  }
}

/**
 * Resolve data input for a given node port by following incoming links
 */
export function getPortInputValue(nodeId, portId) {
  const incomingLink = state.links.find(l => l.toNode === nodeId && l.toPort === portId);
  if (!incomingLink) return null;

  const sourceNode = state.nodes.find(n => n.id === incomingLink.fromNode);
  if (!sourceNode) return null;

  // Resolve source node's value based on port
  return getSourceNodeOutputValue(sourceNode, incomingLink.fromPort);
}

function getSourceNodeOutputValue(sourceNode, portId) {
  if (sourceNode.type === NODE_TYPES.START) {
    return sourceNode.data.inputValue || '';
  }
  if (sourceNode.type === NODE_TYPES.EVENT_WAIT) {
    return sourceNode.data.lastEventValue || '';
  }
  if (sourceNode.type === NODE_TYPES.PROMPT) {
    return sourceNode.data.lastCompiledPrompt || sourceNode.data.promptTemplate || '';
  }
  if (sourceNode.type === NODE_TYPES.LLM) {
    if (portId === 'tool-call-out') {
      return sourceNode.data.lastToolCall !== undefined ? sourceNode.data.lastToolCall : (sourceNode.data.lastResponse || '');
    }
    return sourceNode.data.lastResponse || '';
  }
  if (sourceNode.type === NODE_TYPES.EXTRACTOR) {
    return sourceNode.data.lastExtractedValue || '';
  }
  if (sourceNode.type === NODE_TYPES.TOOL) {
    return sourceNode.data.lastToolResult || '';
  }
  if (sourceNode.type === NODE_TYPES.SET_VAR) {
    const valIn = getPortInputValue(sourceNode.id, 'value-in');
    return valIn !== null ? valIn : (state.variables[sourceNode.data.variableName] || '');
  }
  if (sourceNode.type === NODE_TYPES.CONDITION) {
    return getPortInputValue(sourceNode.id, 'text-in') || '';
  }
  if (sourceNode.type === NODE_TYPES.STREAM_VIEW) {
    return getPortInputValue(sourceNode.id, 'text-in') || '';
  }
  return '';
}

/**
 * Evaluate specific node execution
 */
async function evaluateNode(node) {
  let nextFlowPort = 'flow-out';
  let outputValue = '';

  switch (node.type) {
    case NODE_TYPES.START: {
      outputValue = node.data.inputValue || '';
      break;
    }

    case NODE_TYPES.PROMPT: {
      let tmpl = node.data.promptTemplate || '';
      const portInput = getPortInputValue(node.id, 'data-in');
      if (!tmpl && portInput && typeof portInput === 'string') {
        tmpl = portInput;
      }
      
      // Inject variables: {{var_name}}
      outputValue = tmpl.replace(/\{\{\s*([a-zA-Z0-9_\-]+)\s*\}\}/g, (match, varName) => {
        if (state.variables[varName] !== undefined) {
          return state.variables[varName];
        }
        if ((varName === 'inputValue' || varName === 'input') && portInput !== null && portInput !== undefined) {
          return portInput;
        }
        return '';
      });
      node.data.lastCompiledPrompt = outputValue;
      break;
    }

    case NODE_TYPES.LLM: {
      const promptInput = getPortInputValue(node.id, 'prompt-in') || node.data.lastCompiledPrompt || '';
      const systemPrompt = node.data.systemPrompt || 'You are a helpful software engineer assistant.';
      const temp = node.data.temperature !== undefined ? node.data.temperature : 0.7;
      const requireToolCall = node.data.requireToolCall || false;
      const maxRetries = node.data.maxRetries || 3;

      const llmOptions = {
        enableTools: node.data.enableTools || false,
        tools: node.data.tools || null,
        returnStructured: true
      };

      try {
        let currentPrompt = promptInput;
        let lastResult = null;

        for (let attempt = 0; attempt <= (requireToolCall ? maxRetries : 0); attempt++) {
          lastResult = await runLlmQuery(systemPrompt, currentPrompt, temp, null, llmOptions);
          outputValue = lastResult.content || '';

          const isToolPortConnected = state.links.some(l => l.fromNode === node.id && l.fromPort === 'tool-call-out');

          // 1. Structured Function Calling (OpenAI / Tool Calls schema)
          if (lastResult.type === 'tool_calls' && lastResult.tool_calls.length > 0) {
            const firstCall = lastResult.tool_calls[0];
            const toolName = firstCall.function?.name || 'js_sandbox';
            const rawArgs = firstCall.function?.arguments || '';

            let cleanToolInput = rawArgs;
            try {
              const parsedArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
              cleanToolInput = parsedArgs.code || parsedArgs.input || parsedArgs.filePath || rawArgs;
            } catch (e) {}

            node.data.lastToolCall = cleanToolInput;

            if (isToolPortConnected) {
              addLog(t('llm_tool_call_emitted', { tool: toolName }), 'info', `[Tool Call Emitted via tool-call-out]\nTool: ${toolName}\nPayload: ${cleanToolInput}`);
              if (!outputValue) outputValue = cleanToolInput;
            } else {
              addLog(t('llm_tool_call_unwired_warning', { tool: toolName }), 'warning', `[WARN]: LLM emitted tool call '${toolName}', but 'tool-call-out' port on [${node.title}] is not connected to a Tool Exec node.\n\nExecuting tool locally as fallback.\nPayload: ${cleanToolInput}`);
              for (const call of lastResult.tool_calls) {
                const tName = call.function.name;
                const tArgs = call.function.arguments;
                const toolResult = await executeLocalTool(`mcp:${tName}`, tArgs);
                outputValue += `\n\n[Tool Output: ${tName}]\n${toolResult}`;
              }
            }
            break;
          }

          // 2. ReAct Pattern Regex Check (Fallback for non-native function call models)
          if (node.data.enableTools) {
            const reactMatch = parseReActToolCall(outputValue);
            if (reactMatch) {
              node.data.lastToolCall = reactMatch.input;
              if (isToolPortConnected) {
                addLog(t('llm_tool_call_emitted', { tool: reactMatch.tool }), 'info');
              } else {
                addLog(t('llm_tool_call_unwired_warning', { tool: reactMatch.tool }), 'warning', `[WARN]: ReAct pattern detected tool call '${reactMatch.tool}', but 'tool-call-out' port is not connected.\nExecuting tool locally as fallback.`);
                const toolResult = await executeLocalTool(reactMatch.tool, reactMatch.input);
                outputValue += `\n\n[Tool Output: ${reactMatch.tool}]\n${toolResult}`;
              }
              break;
            }
          }

          // 3. Plain text returned when tool call was required
          if (requireToolCall) {
            if (attempt < maxRetries) {
              addLog(t('llm_retry_tool_required', { attempt: attempt + 1, max: maxRetries }), 'warning');
              currentPrompt = `${promptInput}\n\n[SYSTEM DIRECTIVE]: You returned plain text, but a tool call is required to process this request. You MUST call one of the provided tools now. Do not reply with text alone.`;
              continue;
            } else {
              throw new Error(`LLM failed to issue a required Tool Call after ${maxRetries} retry attempts. Response received: "${outputValue}"`);
            }
          }

          break;
        }

        node.data.lastResponse = outputValue;
        nextFlowPort = 'flow-success';
      } catch (err) {
        nextFlowPort = 'flow-error';
        throw err;
      }
      break;
    }

    case NODE_TYPES.EXTRACTOR: {
      const textIn = getPortInputValue(node.id, 'text-in') || '';
      const targetType = node.data.extractorType || 'code_block';
      const pattern = node.data.extractorPattern || '';

      if (targetType === 'code_block') {
        const match = textIn.match(/```(?:\w+)?\n([\s\S]*?)```/);
        outputValue = match ? match[1].trim() : textIn;
      } else if (targetType === 'json') {
        try {
          const json = JSON.parse(textIn);
          outputValue = pattern && json[pattern] !== undefined ? String(json[pattern]) : JSON.stringify(json);
        } catch (e) {
          outputValue = textIn;
        }
      } else if (targetType === 'regex') {
        if (pattern) {
          const rx = new RegExp(pattern);
          const match = textIn.match(rx);
          outputValue = match ? (match[1] || match[0]) : '';
        } else {
          outputValue = textIn;
        }
      } else if (targetType === 'delimiter') {
        if (pattern && pattern.includes(',')) {
          const [startD, endD] = pattern.split(',').map(s => s.trim());
          const startIdx = textIn.indexOf(startD);
          const endIdx = textIn.indexOf(endD, startIdx + startD.length);
          if (startIdx !== -1 && endIdx !== -1) {
            outputValue = textIn.substring(startIdx + startD.length, endIdx).trim();
          } else {
            outputValue = textIn;
          }
        } else {
          outputValue = textIn;
        }
      }
      node.data.lastExtractedValue = outputValue;
      break;
    }

    case NODE_TYPES.CONDITION: {
      const textIn = getPortInputValue(node.id, 'text-in') || '';
      const condType = node.data.conditionType || 'contains';
      const condVal = node.data.conditionValue || '';
      let isTrue = false;

      if (condType === 'contains') {
        isTrue = textIn.includes(condVal);
      } else if (condType === 'not_contains') {
        isTrue = !textIn.includes(condVal);
      } else if (condType === 'regex') {
        if (condVal) {
          isTrue = new RegExp(condVal).test(textIn);
        }
      } else if (condType === 'js') {
        try {
          const fn = new Function('text', 'variables', `return ${condVal};`);
          isTrue = Boolean(fn(textIn, state.variables));
        } catch (e) {
          isTrue = false;
        }
      }

      nextFlowPort = isTrue ? 'flow-true' : 'flow-false';
      outputValue = isTrue ? 'TRUE' : 'FALSE';
      addLog(t('cond_evaluated', { result: isTrue, branch: nextFlowPort }), 'info');
      break;
    }

    case NODE_TYPES.SET_VAR: {
      const valIn = getPortInputValue(node.id, 'value-in') || '';
      const varName = node.data.variableName || 'temp_var';
      const isAppend = node.data.mode === 'append' || varName.toLowerCase().includes('history');
      
      let newValue = valIn;
      if (isAppend) {
        const lastInput = state.nodes.find(n => n.type === NODE_TYPES.EVENT_WAIT)?.data.lastEventValue || '';
        const turnStr = valIn.startsWith('User:') ? valIn : `User: ${lastInput}\nAssistant: ${valIn}\n\n`;
        newValue = (state.variables[varName] ? state.variables[varName] : '') + turnStr;
      }
      
      setVariable(varName, newValue);
      outputValue = newValue;
      addLog(t('set_var_log', { name: varName, val: newValue }), 'success');
      break;
    }

    case NODE_TYPES.TOOL: {
      const inputIn = getPortInputValue(node.id, 'input-in') || '';
      const toolType = node.data.toolType || 'mock_test';
      outputValue = await executeLocalTool(toolType, inputIn);
      node.data.lastToolResult = outputValue;
      break;
    }

    case NODE_TYPES.EVENT_WAIT: {
      if (!node.data.pendingEventPayload) {
        setRunnerState('paused');
        addLog(state.lang === 'en' ? `Node [${node.title}] is waiting for event input...` : `ノード [${node.title}] はイベント入力を待機しています...`, 'warning');
        return { nextFlowPort: null, outputValue: '' };
      }
      outputValue = node.data.pendingEventPayload;
      node.data.lastEventValue = outputValue;
      delete node.data.pendingEventPayload;
      addLog(state.lang === 'en' ? `Received event input on [${node.title}]: ${outputValue}` : `イベント入力を受領 [${node.title}]: ${outputValue}`, 'info');
      break;
    }

    case NODE_TYPES.STREAM_VIEW: {
      const textIn = getPortInputValue(node.id, 'text-in') || '';
      let roleIn = getPortInputValue(node.id, 'role-in');
      
      if (textIn) {
        let displayText = textIn;
        let displayRole = roleIn;

        // Generic JSON / OpenAI response decoding fallback
        try {
          const parsed = JSON.parse(textIn);
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            displayText = parsed.choices[0].message.content || displayText;
            displayRole = parsed.choices[0].message.role || displayRole || 'assistant';
          } else if (parsed.text || parsed.content) {
            displayText = parsed.text || parsed.content;
            if (parsed.role) displayRole = parsed.role;
          }
        } catch (e) {
          // Plain text format
        }

        if (!displayRole) {
          displayRole = displayText.startsWith('User:') ? 'user' : 'assistant';
        }

        if (!node.data.streamLogs) node.data.streamLogs = [];
        node.data.streamLogs.push({ role: displayRole, text: displayText, timestamp: new Date().toISOString() });
        outputValue = displayText;
        
        // Update stream timeline view cleanly without re-creating DOM element
        import('./canvas.js').then(m => m.updateStreamViewContent(node));
      }
      break;
    }

    case NODE_TYPES.OUTPUT: {
      const resultIn = getPortInputValue(node.id, 'text-in') || '';
      outputValue = resultIn;
      break;
    }
  }

  return { nextFlowPort, outputValue };
}

/**
 * Trigger an event payload on an Event Wait Node and resume workflow execution
 */
export async function triggerNodeEvent(nodeId, text) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;

  node.data.pendingEventPayload = text;
  node.data.lastEventValue = text;
  setCurrentNodeId(node.id);
  
  addLog(state.lang === 'en' ? `Event triggered on [${node.title}]` : `イベントを送信しました [${node.title}]`, 'info');
  
  runWorkflow();
}

/**
 * Parse ReAct text pattern: Action: tool_name \n Action Input: input_val
 */
function parseReActToolCall(text) {
  const actionMatch = text.match(/Action:\s*([a-zA-Z0-9_\-]+)/i);
  const inputMatch = text.match(/Action Input:\s*([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i);
  if (actionMatch) {
    return {
      tool: actionMatch[1].trim(),
      input: inputMatch ? inputMatch[1].trim() : ''
    };
  }
  return null;
}

import { callMcpTool } from './mcp.js';

/**
 * Execute a local or connected MCP tool (testing, file system, sandbox, or remote MCP server)
 */
export async function executeLocalTool(toolType, inputVal) {
  let cleanType = toolType;
  if (cleanType && cleanType.startsWith('mcp:')) {
    const rawName = cleanType.replace(/^mcp:/, '');
    const builtInTypes = ['js_sandbox', 'read_file', 'write_file', 'list_files', 'mock_test', 'mock_search', 'run_tests'];
    if (builtInTypes.includes(rawName) || builtInTypes.includes(rawName.split(':')[1])) {
      cleanType = rawName.includes(':') ? rawName.split(':')[1] : rawName;
    } else {
      const matchedMcp = (state.mcpTools || []).find(t => t.fullId === toolType);
      if (!matchedMcp) {
        const mcpByName = (state.mcpTools || []).find(t => t.name === rawName);
        if (mcpByName) {
          return await callMcpTool(mcpByName.serverUrl, mcpByName.name, inputVal);
        }
        return `Error: MCP Tool '${toolType}' is not currently connected.`;
      }
      return await callMcpTool(matchedMcp.serverUrl, matchedMcp.name, inputVal);
    }
  }

  if (cleanType === 'mock_test' || cleanType === 'run_tests') {
    if (state.variables['current_code']) {
      const code = String(state.variables['current_code']);
      if (code.includes('SyntaxError') || code.includes('BUG') || code.includes('FAIL')) {
        return 'TEST FAILED: Found bug/error keyword in current_code.';
      }
    }
    return 'TEST PASS: All unit tests passed (0 errors).';
  }

  if (cleanType === 'list_files') {
    if (state.filesList && state.filesList.length > 0) {
      return state.filesList.map(f => f.path).join('\n');
    }
    return 'No files found in connected directory.';
  }

  if (cleanType === 'read_file') {
    let filePath = inputVal;
    if (typeof inputVal === 'string' && inputVal.trim().startsWith('{')) {
      try { filePath = JSON.parse(inputVal).filePath || inputVal; } catch (e) {}
    } else if (typeof inputVal === 'object' && inputVal.filePath) {
      filePath = inputVal.filePath;
    }
    const targetFile = state.filesList.find(f => f.path === filePath || f.name === filePath);
    if (targetFile && targetFile.handle) {
      const file = await targetFile.handle.getFile();
      return await file.text();
    }
    return `Error: File '${filePath}' not found in connected directory.`;
  }

  if (cleanType === 'write_file') {
    let path = '', content = '';
    if (typeof inputVal === 'string' && inputVal.trim().startsWith('{')) {
      try {
        const json = JSON.parse(inputVal);
        path = json.filePath || json.path || '';
        content = json.content || '';
      } catch (e) {}
    } else if (typeof inputVal === 'object') {
      path = inputVal.filePath || inputVal.path || '';
      content = inputVal.content || '';
    }
    if (!path && typeof inputVal === 'string') {
      const parts = inputVal.split('::');
      path = parts[0]?.trim();
      content = parts[1]?.trim() || '';
    }
    if (!path) return 'Error: Invalid write_file format. Expected "path::content" or JSON {"filePath","content"}';
    
    if (state.directoryHandle) {
      try {
        const fileHandle = await state.directoryHandle.getFileHandle(path, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        return `Successfully wrote to file ${path}`;
      } catch (e) {
        return `Failed to write file ${path}: ${e.message}`;
      }
    }
    return `Mock write success for ${path}`;
  }

  if (cleanType === 'mock_search') {
    return `Mock Search Results for "${inputVal}": Found 3 relevant articles.`;
  }

  if (cleanType === 'js_sandbox') {
    let jsCode = inputVal;
    if (typeof inputVal === 'string' && inputVal.trim().startsWith('{')) {
      try {
        const json = JSON.parse(inputVal);
        jsCode = json.code || json.input || inputVal;
      } catch (e) {}
    } else if (typeof inputVal === 'object') {
      jsCode = inputVal.code || inputVal.input || JSON.stringify(inputVal);
    }

    try {
      let result;
      try {
        const fn = new Function('input', 'variables', `return (${jsCode});`);
        result = fn(jsCode, state.variables);
      } catch (exprErr) {
        const fn = new Function('input', 'variables', jsCode);
        result = fn(jsCode, state.variables);
      }
      return result !== undefined ? String(result) : 'JS executed successfully (no return value)';
    } catch (e) {
      return `JS Execution Error: ${e.message}`;
    }
  }

  return `Executed tool ${cleanType} with input: ${typeof inputVal === 'object' ? JSON.stringify(inputVal) : inputVal}`;
}
