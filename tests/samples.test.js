import { test } from 'node:test';
import assert from 'node:assert';
import { 
  state,
  clearCanvasState,
  resetRunner,
  setUseMockLlm,
  setExecutionDelay,
  DEFAULT_RECENT_FILES
} from '../src/state.js';
import { loadWorkflowData } from '../src/ui.js';
import { stepWorkflow, runWorkflow, triggerNodeEvent, resetWorkflow } from '../src/runtime.js';

test('Sample Workflows Integration Test Suite (with Mock LLM)', async (t) => {
  // Enable mock LLM mode and fast execution delay for automated testing
  setUseMockLlm(true);
  setExecutionDelay(10);

  await t.test('1. Simple Query & Variable Memory (basic-chat.fabre / sample_chat)', async () => {
    clearCanvasState();
    resetWorkflow();

    const sample = DEFAULT_RECENT_FILES.find(s => s.id === 'sample_chat');
    assert.ok(sample, 'sample_chat must exist in DEFAULT_RECENT_FILES');

    loadWorkflowData(sample.data, sample.title);
    assert.strictEqual(state.nodes.length, 5);

    // Run continuous workflow
    runWorkflow();
    await new Promise(resolve => setTimeout(resolve, 300));

    assert.strictEqual(state.runnerState, 'success');
    assert.ok(state.variables.last_response, 'state.variables.last_response should contain LLM output');
    assert.strictEqual(typeof state.variables.last_response, 'string');
    assert.strictEqual(state.logs.some(l => l.type === 'error'), false, 'No error logs should be produced');
  });

  await t.test('2. End-to-End Infinite Chat (e2e-infinite-chat.fabre / sample_chat_e2e)', async () => {
    clearCanvasState();
    resetWorkflow();

    const sample = DEFAULT_RECENT_FILES.find(s => s.id === 'sample_chat_e2e');
    assert.ok(sample, 'sample_chat_e2e must exist in DEFAULT_RECENT_FILES');

    loadWorkflowData(sample.data, sample.title);
    assert.strictEqual(state.nodes.length, 5);

    // Trigger event on node_event_wait_1
    await triggerNodeEvent('node_event_wait_1', 'What is WebAssembly?');
    await new Promise(resolve => setTimeout(resolve, 400));

    const sessionNode = state.nodes.find(n => n.id === 'node_session_1');
    assert.ok(sessionNode);
    assert.strictEqual(sessionNode.data.messages.length, 2);
    assert.strictEqual(sessionNode.data.messages[0].role, 'user');
    assert.strictEqual(sessionNode.data.messages[0].content, 'What is WebAssembly?');
    assert.strictEqual(sessionNode.data.messages[1].role, 'assistant');
    assert.ok(sessionNode.data.messages[1].content.length > 0);

    const toolCfgNode = state.nodes.find(n => n.id === 'node_tool_config_1');
    assert.ok(toolCfgNode);

    const streamNode = state.nodes.find(n => n.id === 'node_stream_1');
    assert.ok(streamNode, 'StreamView node node_stream_1 must exist');

    assert.strictEqual(state.runnerState, 'paused');
    assert.strictEqual(state.logs.some(l => l.type === 'error'), false, 'No error logs should be produced');
  });

  await t.test('2b. Tool Calling Agent (tool-calling-agent.fabre / sample_tool_calling)', async () => {
    clearCanvasState();
    resetWorkflow();

    const sample = DEFAULT_RECENT_FILES.find(s => s.id === 'sample_tool_calling');
    assert.ok(sample, 'sample_tool_calling must exist in DEFAULT_RECENT_FILES');

    loadWorkflowData(sample.data, sample.title);
    assert.strictEqual(state.nodes.length, 7);

    // Trigger event on node_event_wait_1
    await triggerNodeEvent('node_event_wait_1', 'Compute 123 * 456');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify native tool call was routed via tool-call-out and executed
    const toolNode = state.nodes.find(n => n.id === 'node_tool_1');
    assert.ok(toolNode);
    assert.strictEqual(toolNode.data.lastToolResult, '56088', 'Tool should have computed 123 * 456 = 56088');

    // Verify session manager received the tool result
    const sessionNode = state.nodes.find(n => n.id === 'node_session_1');
    assert.ok(sessionNode);
    const toolMsg = sessionNode.data.messages.find(m => m.role === 'tool');
    assert.ok(toolMsg, 'Session should contain a tool role message with the execution result');
    assert.ok(toolMsg.content.includes('56088'), 'Tool result message should contain 56088');

    assert.strictEqual(state.runnerState, 'paused');
    assert.strictEqual(state.logs.some(l => l.type === 'error'), false, 'No error logs should be produced');
  });

  await t.test('3. JS Sandbox Browser Alert Agent (js-sandbox-alert-agent.fabre / sample_js_sandbox_alert)', async () => {
    clearCanvasState();
    resetWorkflow();

    const sample = DEFAULT_RECENT_FILES.find(s => s.id === 'sample_js_sandbox_alert');
    assert.ok(sample, 'sample_js_sandbox_alert must exist in DEFAULT_RECENT_FILES');

    loadWorkflowData(sample.data, sample.title);
    assert.strictEqual(state.nodes.length, 7);

    // Trigger event on node_event_wait_1
    await triggerNodeEvent('node_event_wait_1', 'Display an alert dialog with HELLO!');
    await new Promise(resolve => setTimeout(resolve, 500));

    const extractorNode = state.nodes.find(n => n.id === 'node_extractor_1');
    assert.ok(extractorNode);
    assert.ok(extractorNode.data.lastExtractedValue.includes('alert'));

    const toolNode = state.nodes.find(n => n.id === 'node_tool_1');
    assert.ok(toolNode);
    assert.ok(toolNode.data.lastToolResult.includes('JS executed successfully') || toolNode.data.lastToolResult.includes('Executed js_sandbox code'));

    assert.strictEqual(state.runnerState, 'paused');
    assert.strictEqual(state.logs.some(l => l.type === 'error'), false, 'No error logs should be produced');
  });

  await t.test('4. LLM Error Retry & Fallback Agent (self-fixing-loop.fabre / sample_loop)', async () => {
    clearCanvasState();
    resetWorkflow();

    const sample = DEFAULT_RECENT_FILES.find(s => s.id === 'sample_loop');
    assert.ok(sample, 'sample_loop must exist in DEFAULT_RECENT_FILES');

    loadWorkflowData(sample.data, sample.title);
    assert.strictEqual(state.nodes.length, 4);

    const primaryLlmNode = state.nodes.find(n => n.id === 'node_llm_1');
    assert.ok(primaryLlmNode);
    assert.strictEqual(primaryLlmNode.data.maxRetries, 2);

    runWorkflow();
    await new Promise(resolve => setTimeout(resolve, 500));

    assert.strictEqual(state.runnerState, 'success');
  });

  await t.test('5. Condition Branching & Flow (condition-branching.fabre / sample_cond)', async () => {
    clearCanvasState();
    resetWorkflow();

    const sample = DEFAULT_RECENT_FILES.find(s => s.id === 'sample_cond');
    assert.ok(sample, 'sample_cond must exist in DEFAULT_RECENT_FILES');

    loadWorkflowData(sample.data, sample.title);
    assert.strictEqual(state.nodes.length, 4);

    runWorkflow();
    await new Promise(resolve => setTimeout(resolve, 300));

    assert.strictEqual(state.runnerState, 'success');
    assert.strictEqual(state.currentNodeId, 'node_out_pass');
  });

  await t.test('6. Real OpenAI Raw JSON Payload Parsing Compatibility', async () => {
    setUseMockLlm(false); // Test real runLlmQuery payload parsing logic!
    const origProvider = state.llmProvider;
    state.llmProvider = 'openai-compatible';
    const origFetch = globalThis.fetch;
    
    // Mock fetch returning the exact raw response format provided by user
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: "chatcmpl-2o58gkl2wd46lolgewda0s",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "WebAssembly (Wasm) is a way to take code written in C++ or Rust and run it in the browser.",
              tool_calls: []
            },
            finish_reason: "stop"
          }
        ]
      })
    });

    try {
      const { runLlmQuery } = await import('../src/llm.js');
      const result = await runLlmQuery('System Prompt', 'User Query', 0.7, null, {
        returnStructured: true,
        endpointOverride: 'http://localhost:11434/v1',
        modelOverride: 'gemma-4-e2b-it'
      });

      assert.strictEqual(typeof result, 'object', 'Result must be a structured object');
      assert.strictEqual(result.type, 'text');
      assert.strictEqual(result.content.includes('WebAssembly'), true);
    } finally {
      globalThis.fetch = origFetch;
      state.llmProvider = origProvider;
      setUseMockLlm(true);
    }
  });

  await t.test('7. Unified LLM Config Resolver (resolveLlmConfig)', async () => {
    const { resolveLlmConfig } = await import('../src/llm.js');
    
    // Global fallback
    state.llmProvider = 'chrome-ai';
    state.apiEndpoint = 'http://global:11434/v1';
    state.apiModel = 'global-model';

    // Local node override
    const resolved = resolveLlmConfig({
      llmProviderOverride: 'openai-compatible',
      endpointOverride: 'http://custom-node:8080/v1',
      modelOverride: 'custom-model',
      apiKeyOverride: 'secret-key',
      temperatureOverride: 0.2
    });

    assert.strictEqual(resolved.provider, 'openai-compatible');
    assert.strictEqual(resolved.endpoint, 'http://custom-node:8080/v1');
    assert.strictEqual(resolved.model, 'custom-model');
    assert.strictEqual(resolved.apiKey, 'secret-key');
    assert.strictEqual(resolved.temperature, 0.2);
  });

  await t.test('8. Edge case: resolveLlmConfig with null property overrides (hydrated UI node state)', async () => {
    const { resolveLlmConfig } = await import('../src/llm.js');
    
    state.llmProvider = 'openai-compatible';
    state.apiEndpoint = 'http://localhost:11434/v1';
    state.apiModel = 'qwen2.5-coder:7b';
    state.apiKey = 'global-key';

    // Hydrated UI nodes pass null for empty form fields
    const resolved = resolveLlmConfig({
      llmProviderOverride: null,
      endpointOverride: null,
      modelOverride: null,
      apiKeyOverride: null,
      temperatureOverride: null
    });

    assert.strictEqual(resolved.provider, 'openai-compatible');
    assert.strictEqual(resolved.endpoint, 'http://localhost:11434/v1');
    assert.strictEqual(resolved.model, 'qwen2.5-coder:7b');
    assert.strictEqual(resolved.apiKey, 'global-key');
    assert.strictEqual(resolved.temperature, 0.7);
  });

});
