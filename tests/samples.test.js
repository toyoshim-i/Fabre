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
  });

  await t.test('2. End-to-End Infinite Chat (e2e-infinite-chat.fabre / sample_chat_e2e)', async () => {
    clearCanvasState();
    resetWorkflow();

    const sample = DEFAULT_RECENT_FILES.find(s => s.id === 'sample_chat_e2e');
    assert.ok(sample, 'sample_chat_e2e must exist in DEFAULT_RECENT_FILES');

    loadWorkflowData(sample.data, sample.title);
    assert.strictEqual(state.nodes.length, 4);

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
    assert.strictEqual(extractorNode.data.lastExtractedValue, "alert('HELLO');");

    const toolNode = state.nodes.find(n => n.id === 'node_tool_1');
    assert.ok(toolNode);
    assert.ok(toolNode.data.lastToolResult.includes('JS executed successfully') || toolNode.data.lastToolResult.includes('Executed js_sandbox code'));
  });

  await t.test('4. Self-Debugging Agent Loop (self-fixing-loop.fabre / sample_loop)', async () => {
    clearCanvasState();
    resetWorkflow();

    const sample = DEFAULT_RECENT_FILES.find(s => s.id === 'sample_loop');
    assert.ok(sample, 'sample_loop must exist in DEFAULT_RECENT_FILES');

    loadWorkflowData(sample.data, sample.title);
    assert.strictEqual(state.nodes.length, 6);

    runWorkflow();
    await new Promise(resolve => setTimeout(resolve, 500));

    assert.strictEqual(state.runnerState, 'success');
    assert.ok(state.variables.audit_result, 'audit_result variable should contain tool execution result');
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

});
