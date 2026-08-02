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
export async function stepWorkflow(isSingleStep = false) {
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
  addLog(
    t('executing_node', { title: currentNode.title, type: currentNode.type }),
    'info',
    `[Target Node]\nID: ${currentNode.id}\nTitle: ${currentNode.title}\nType: ${currentNode.type}\n\n[Node Data Configuration]\n${JSON.stringify(currentNode.data || {}, null, 2)}`
  );

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
      if (isSingleStep) {
        setRunnerState('paused'); // Single step execution explicitly pauses
      } else {
        setRunnerState('running'); // Continuous execution loop remains running
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
    
    await stepWorkflow(false);

    if (state.runnerState === 'running') {
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
  state.nodes.forEach(n => {
    if (n.data) delete n.data.hasLoggedWait;
  });
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
  if (sourceNode.type === NODE_TYPES.SESSION) {
    if (portId === 'session-out') {
      return {
        nodeId: sourceNode.id,
        messages: sourceNode.data.messages || [],
        systemPrompt: sourceNode.data.systemPrompt || '',
        llmProviderOverride: sourceNode.data.llmProviderOverride || sourceNode.data.providerOverride || '',
        providerOverride: sourceNode.data.llmProviderOverride || sourceNode.data.providerOverride || '',
        modelOverride: sourceNode.data.modelOverride || '',
        endpointOverride: sourceNode.data.endpointOverride || '',
        apiKeyOverride: sourceNode.data.apiKeyOverride || '',
        temperatureOverride: sourceNode.data.temperatureOverride,
        maxHistoryTurns: sourceNode.data.maxHistoryTurns || 10
      };
    }
    if (portId === 'messages-out') {
      return sourceNode.data.messages || [];
    }
    return sourceNode.data.messages || [];
  }
  if (sourceNode.type === NODE_TYPES.STREAM_VIEW) {
    return getPortInputValue(sourceNode.id, 'text-in') || '';
  }
  return '';
}

/**
 * Evaluate specific node execution
 */
export async function evaluateNode(node) {
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
      addLog(
        state.lang === 'en' ? `Prompt Builder [${node.title}] compiled template` : `プロンプト作成 [${node.title}] のテンプレート生成完了`,
        'info',
        `[Raw Template]\n${tmpl}\n\n[Port Data Input]\n${portInput !== null && portInput !== undefined ? portInput : '(none)'}\n\n[Compiled Output Prompt]\n${outputValue}`
      );
      break;
    }

    case NODE_TYPES.SESSION: {
      if (!Array.isArray(node.data.messages)) {
        node.data.messages = [];
      }
      
      const userIn = getPortInputValue(node.id, 'user-in');
      const responseIn = getPortInputValue(node.id, 'response-in');

      // 1. If user input text received, push to messages array
      if (userIn && typeof userIn === 'string' && userIn.trim()) {
        const lastMsg = node.data.messages[node.data.messages.length - 1];
        if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== userIn.trim()) {
          node.data.messages.push({
            role: 'user',
            content: userIn.trim(),
            timestamp: new Date().toISOString()
          });
        }
      }

      // 2. If response text received, push to messages array
      if (responseIn && typeof responseIn === 'string' && responseIn.trim()) {
        const lastMsg = node.data.messages[node.data.messages.length - 1];
        if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.content !== responseIn.trim()) {
          node.data.messages.push({
            role: 'assistant',
            content: responseIn.trim(),
            timestamp: new Date().toISOString()
          });
        }
      }

      // 3. Sliding window turns trimming
      const maxTurns = node.data.maxHistoryTurns || 10;
      const maxMessages = maxTurns * 2;
      if (node.data.messages.length > maxMessages) {
        node.data.messages = node.data.messages.slice(-maxMessages);
      }

      const sessionPayload = {
        nodeId: node.id,
        messages: node.data.messages,
        systemPrompt: node.data.systemPrompt,
        llmProviderOverride: node.data.llmProviderOverride || node.data.providerOverride,
        modelOverride: node.data.modelOverride,
        endpointOverride: node.data.endpointOverride,
        apiKeyOverride: node.data.apiKeyOverride,
        temperatureOverride: node.data.temperatureOverride
      };

      outputValue = node.data.messages || [];
      addLog(
        state.lang === 'en' ? `Session Manager [${node.title}] updated memory` : `対話セッション [${node.title}] メモリ更新完了`,
        'info',
        `[Session Node]\nID: ${node.id}\nTitle: ${node.title}\nTotal Messages: ${node.data.messages.length}\nMax History Turns: ${maxTurns}\n\n[Provider Override]\n${node.data.llmProviderOverride || node.data.providerOverride || '(Inherit Global)'}\n\n[Model Override]\n${node.data.modelOverride || '(Inherit Global)'}\n\n[Endpoint Override]\n${node.data.endpointOverride || '(Inherit Global)'}\n\n[Structured Canonical Messages Payload]\n${JSON.stringify(node.data.messages, null, 2)}`
      );
      break;
    }

    case NODE_TYPES.LLM: {
      const promptInput = getPortInputValue(node.id, 'prompt-in') || node.data.lastCompiledPrompt || '';
      let systemPrompt = node.data.systemPrompt || 'You are a helpful software engineer assistant.';
      
      let effectiveProvider = node.data.llmProviderOverride || node.data.providerOverride || null;
      let effectiveModel = node.data.modelOverride || null;
      let effectiveEndpoint = node.data.endpointOverride || null;
      let effectiveApiKey = node.data.apiKeyOverride || null;
      let effectiveTemperature = node.data.temperatureOverride !== undefined ? node.data.temperatureOverride : node.data.temperature;
      let targetSessionNode = null;

      // Check if session-in is connected
      const sessionContext = getPortInputValue(node.id, 'session-in');
      let canonicalMessagesPayload = null;

      if (sessionContext && typeof sessionContext === 'object') {
        const sessionNodeId = sessionContext.nodeId;
        targetSessionNode = state.nodes.find(n => n.id === sessionNodeId);
        
        if (sessionContext.systemPrompt && !node.data.systemPrompt) {
          systemPrompt = sessionContext.systemPrompt;
        }
        if (!effectiveProvider && (sessionContext.llmProviderOverride || sessionContext.providerOverride)) {
          effectiveProvider = sessionContext.llmProviderOverride || sessionContext.providerOverride;
        }
        if (!effectiveModel && sessionContext.modelOverride) {
          effectiveModel = sessionContext.modelOverride;
        }
        if (!effectiveEndpoint && sessionContext.endpointOverride) {
          effectiveEndpoint = sessionContext.endpointOverride;
        }
        if (!effectiveApiKey && sessionContext.apiKeyOverride) {
          effectiveApiKey = sessionContext.apiKeyOverride;
        }
        if (effectiveTemperature === undefined && sessionContext.temperatureOverride !== undefined) {
          effectiveTemperature = sessionContext.temperatureOverride;
        }

        // Build canonical messages array
        let baseMessages = Array.isArray(sessionContext.messages) ? [...sessionContext.messages] : [];
        if (promptInput && promptInput.trim()) {
          const lastMsg = baseMessages[baseMessages.length - 1];
          if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== promptInput.trim()) {
            baseMessages.push({ role: 'user', content: promptInput.trim() });
          }
        }
        canonicalMessagesPayload = baseMessages;
      }

      // Automatically enable tools if tool-call-out port is connected to downstream node(s)
      const isToolPortConnected = state.links.some(l => l.fromNode === node.id && l.fromPort === 'tool-call-out');

      const llmOptions = {
        enableTools: isToolPortConnected,
        tools: node.data.tools || null,
        returnStructured: true,
        providerOverride: effectiveProvider,
        modelOverride: effectiveModel,
        endpointOverride: effectiveEndpoint,
        apiKeyOverride: effectiveApiKey,
        temperatureOverride: effectiveTemperature,
        messagesPayload: canonicalMessagesPayload
      };

      try {
        const lastResult = await runLlmQuery(systemPrompt, promptInput, effectiveTemperature, null, llmOptions);
        outputValue = lastResult.content || '';

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

          addLog(t('llm_tool_call_emitted', { tool: toolName }), 'info', `[Tool Call Emitted via tool-call-out]\nTool: ${toolName}\nPayload: ${cleanToolInput}`);
          if (!outputValue) outputValue = cleanToolInput;
        } else if (isToolPortConnected) {
          // 2. ReAct Pattern Regex Check (Fallback for non-native function call models)
          const reactMatch = parseReActToolCall(outputValue);
          if (reactMatch) {
            node.data.lastToolCall = reactMatch.input;
            addLog(t('llm_tool_call_emitted', { tool: reactMatch.tool }), 'info', `[ReAct Tool Call Detected]\nTool: ${reactMatch.tool}\nPayload: ${reactMatch.input}`);
            if (!outputValue) outputValue = reactMatch.input;
          }
        }
        node.data.lastResponse = outputValue;

        // Auto-push LLM response into connected Session Manager memory if available
        if (targetSessionNode && outputValue) {
          if (!Array.isArray(targetSessionNode.data.messages)) {
            targetSessionNode.data.messages = [];
          }
          const lastMsg = targetSessionNode.data.messages[targetSessionNode.data.messages.length - 1];
          if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.content !== outputValue) {
            targetSessionNode.data.messages.push({
              role: 'assistant',
              content: outputValue,
              timestamp: new Date().toISOString()
            });
          }
        }

        addLog(
          state.lang === 'en' ? `LLM Call [${node.title}] output generated` : `LLM呼び出し [${node.title}] の出力完了`,
          'success',
          `[Input User Prompt]\n${promptInput}\n\n[System Prompt]\n${systemPrompt}\n\n[Effective Model]\n${effectiveModel || state.apiModel || '(Global Default)'}\n\n[Effective Endpoint]\n${effectiveEndpoint || state.apiEndpoint || '(Global Default)'}\n\n[LLM Output Response]\n${outputValue}${node.data.lastToolCall ? `\n\n[Tool Call Payload]\n${node.data.lastToolCall}` : ''}`
        );
        nextFlowPort = 'flow-success';
      } catch (err) {
        addLog(`[Error in LLM Call ${node.title}]: ${err.message}`, 'error', err.stack);
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
      addLog(
        t('cond_evaluated', { result: isTrue, branch: nextFlowPort }),
        'info',
        `[Condition Rule]\nType: ${condType}\nPattern/Value: ${condVal}\n\n[Tested Text Input]\n${textIn}\n\n[Evaluation Result]\n${isTrue ? 'TRUE -> Branch flow-true' : 'FALSE -> Branch flow-false'}`
      );
      break;
    }

    case NODE_TYPES.SET_VAR: {
      const valIn = getPortInputValue(node.id, 'value-in') || '';
      const varName = node.data.variableName || 'temp_var';
      const isAppend = node.data.mode === 'append';
      
      let newValue = valIn;
      if (isAppend && state.variables[varName]) {
        newValue = state.variables[varName] + '\n' + valIn;
      }
      
      setVariable(varName, newValue);
      outputValue = newValue;
      addLog(
        t('set_var_log', { name: varName, val: typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue).substring(0, 80) }),
        'success',
        `[Target Variable]\nName: ${varName}\nMode: ${isAppend ? 'Append' : 'Overwrite'}\n\n[Updated Variable Content]\n${typeof newValue === 'object' ? JSON.stringify(newValue, null, 2) : newValue}`
      );
      break;
    }

    case NODE_TYPES.TOOL: {
      const inputIn = getPortInputValue(node.id, 'input-in') || '';
      const toolType = node.data.toolType || 'mock_test';
      outputValue = await executeLocalTool(toolType, inputIn);
      node.data.lastToolResult = outputValue;
      addLog(
        state.lang === 'en' ? `Tool Exec [${node.title}] executed (${toolType})` : `ツール実行 [${node.title}] 完了 (${toolType})`,
        'info',
        `[Tool Executed]\nType: ${toolType}\n\n[Tool Input / Code Payload]\n${inputIn}\n\n[Execution Output Result]\n${outputValue}`
      );
      break;
    }

    case NODE_TYPES.EVENT_WAIT: {
      if (!node.data.pendingEventPayload) {
        setRunnerState('paused');
        if (!node.data.hasLoggedWait) {
          addLog(state.lang === 'en' ? `Node [${node.title}] is waiting for event input...` : `ノード [${node.title}] はイベント入力を待機しています...`, 'warning');
          node.data.hasLoggedWait = true;
        }
        return { nextFlowPort: null, outputValue: '' };
      }
      delete node.data.hasLoggedWait;
      outputValue = node.data.pendingEventPayload;
      node.data.lastEventValue = outputValue;
      delete node.data.pendingEventPayload;
      addLog(state.lang === 'en' ? `Received event input on [${node.title}]: ${outputValue}` : `イベント入力を受領 [${node.title}]: ${outputValue}`, 'info');
      break;
    }

    case NODE_TYPES.STREAM_VIEW: {
      const messagesIn = getPortInputValue(node.id, 'messages-in');
      const textIn = getPortInputValue(node.id, 'text-in') || '';
      let roleIn = getPortInputValue(node.id, 'role-in');

      if (Array.isArray(messagesIn) && messagesIn.length > 0) {
        // Clear chat UI and populate from structured canonical messages array!
        clearChatMessages();
        for (const msg of messagesIn) {
          addChatMessage(msg.role === 'user' ? 'user' : 'assistant', msg.content);
        }
        outputValue = messagesIn[messagesIn.length - 1]?.content || '';
      } else if (textIn) {
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
      node.data.lastOutputValue = resultIn;
      import('./canvas.js').then(m => m.updateOutputNodeContent(node));
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
