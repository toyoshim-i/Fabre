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
  resetRunner
} from './state.js';
import { runLlmQuery } from './llm.js';

let stepTimer = null;

/**
 * Execute a single step of the workflow starting from current node or Start node
 */
export async function stepWorkflow() {
  if (state.nodes.length === 0) {
    addLog(state.lang === 'en' ? 'Canvas is empty. Create nodes to run.' : 'キャンバスが空です。ノードを作成してください。', 'warning');
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
    addLog(state.lang === 'en' ? 'Current node not found.' : '現在のノードが見つかりません。', 'error');
    return;
  }

  setRunnerState('running');
  addLog(
    state.lang === 'en' 
      ? `Executing node: [${currentNode.title}] (${currentNode.type})` 
      : `ノードを実行中: [${currentNode.title}] (${currentNode.type})`,
    'info'
  );

  try {
    // Evaluate Node
    const result = await evaluateNode(currentNode);
    incrementTotalSteps();

    // Determine outgoing flow port
    const nextFlowPort = result.nextFlowPort || 'flow-out';
    const nextLink = state.links.find(l => l.fromNode === currentNode.id && l.fromPort === nextFlowPort);

    if (currentNode.type === NODE_TYPES.OUTPUT) {
      setRunnerState('success');
      addLog(
        state.lang === 'en' 
          ? `Workflow execution completed successfully. Result: ${result.outputValue}` 
          : `ワークフローの実行が正常終了しました。結果: ${result.outputValue}`,
        'success'
      );
      return;
    }

    if (nextLink) {
      setCurrentNodeId(nextLink.toNode);
      if (state.runnerState !== 'paused') {
        setRunnerState('paused'); // Step execution pauses after 1 step
      }
    } else {
      setRunnerState('success');
      addLog(state.lang === 'en' ? 'Reached end of flow.' : '制御フローの終端に達しました。', 'info');
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
  addLog(state.lang === 'en' ? 'Workflow paused.' : '実行を一時停止しました。', 'warning');
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
  addLog(state.lang === 'en' ? 'Workflow reset.' : '実行状態をリセットしました。', 'info');
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
  if (sourceNode.type === NODE_TYPES.PROMPT) {
    return sourceNode.data.lastCompiledPrompt || sourceNode.data.promptTemplate || '';
  }
  if (sourceNode.type === NODE_TYPES.LLM) {
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
      // Direct Data Port Input fallback
      const portInput = getPortInputValue(node.id, 'data-in');
      if (portInput && typeof portInput === 'string') {
        tmpl = portInput;
      }
      
      // Inject variables: {{var_name}}
      outputValue = tmpl.replace(/\{\{\s*([a-zA-Z0-9_\-]+)\s*\}\}/g, (match, varName) => {
        return state.variables[varName] !== undefined ? state.variables[varName] : match;
      });
      node.data.lastCompiledPrompt = outputValue;
      break;
    }

    case NODE_TYPES.LLM: {
      const promptInput = getPortInputValue(node.id, 'prompt-in') || node.data.lastCompiledPrompt || '';
      const systemPrompt = node.data.systemPrompt || 'You are a helpful software engineer assistant.';
      const temp = node.data.temperature !== undefined ? node.data.temperature : 0.7;

      try {
        outputValue = await runLlmQuery(systemPrompt, promptInput, temp);
        node.data.lastResponse = outputValue;
        
        // ReAct pattern check if tool execution enabled
        if (node.data.enableTools) {
          const reactMatch = parseReActToolCall(outputValue);
          if (reactMatch) {
            addLog(state.lang === 'en' ? `ReAct Tool Call detected: ${reactMatch.tool}` : `ReAct ツール呼び出しを検出: ${reactMatch.tool}`, 'info');
            const toolResult = await executeLocalTool(reactMatch.tool, reactMatch.input);
            outputValue += `\n\n[Tool Output: ${reactMatch.tool}]\n${toolResult}`;
            node.data.lastResponse = outputValue;
          }
        }
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
      addLog(
        state.lang === 'en' 
          ? `Condition evaluated: ${isTrue} (Branch: ${nextFlowPort})` 
          : `条件分岐判定結果: ${isTrue} (分岐: ${nextFlowPort})`,
        'info'
      );
      break;
    }

    case NODE_TYPES.SET_VAR: {
      const valIn = getPortInputValue(node.id, 'value-in') || '';
      const varName = node.data.variableName || 'temp_var';
      setVariable(varName, valIn);
      outputValue = valIn;
      addLog(state.lang === 'en' ? `Set variable [${varName}] = ${valIn}` : `変数 [${varName}] に値を格納しました: ${valIn}`, 'success');
      break;
    }

    case NODE_TYPES.TOOL: {
      const inputIn = getPortInputValue(node.id, 'input-in') || '';
      const toolType = node.data.toolType || 'mock_test';
      outputValue = await executeLocalTool(toolType, inputIn);
      node.data.lastToolResult = outputValue;
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

/**
 * Execute local filesystem tools or mock tools
 */
export async function executeLocalTool(toolType, inputVal) {
  if (toolType === 'mock_test' || toolType === 'run_tests') {
    if (state.variables['current_code']) {
      const code = String(state.variables['current_code']);
      if (code.includes('SyntaxError') || code.includes('BUG') || code.includes('FAIL')) {
        return 'TEST FAILED: Found bug/error keyword in current_code.';
      }
    }
    return 'TEST PASS: All unit tests passed (0 errors).';
  }

  if (toolType === 'list_files') {
    if (state.filesList && state.filesList.length > 0) {
      return state.filesList.map(f => f.path).join('\n');
    }
    return 'No files found in connected directory.';
  }

  if (toolType === 'read_file') {
    const targetFile = state.filesList.find(f => f.path === inputVal || f.name === inputVal);
    if (targetFile && targetFile.handle) {
      const file = await targetFile.handle.getFile();
      return await file.text();
    }
    return `Error: File '${inputVal}' not found in connected directory.`;
  }

  if (toolType === 'write_file') {
    const parts = inputVal.split('::');
    const path = parts[0]?.trim();
    const content = parts[1]?.trim() || '';
    if (!path) return 'Error: Invalid write_file format. Expected "path::content"';
    
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

  if (toolType === 'mock_search') {
    return `Mock Search Results for "${inputVal}": Found 3 relevant articles.`;
  }

  if (toolType === 'js_sandbox') {
    try {
      const result = new Function('input', 'variables', `return ${inputVal};`)(inputVal, state.variables);
      return String(result);
    } catch (e) {
      return `JS Execution Error: ${e.message}`;
    }
  }

  return `Executed tool ${toolType} with input: ${inputVal}`;
}
