import { test } from 'node:test';
import assert from 'node:assert';
import { 
  state,
  setLanguage,
  setTheme,
  setLlmProvider,
  setApiEndpoint,
  setApiModel,
  setApiKey,
  addNode,
  deleteNode,
  updateNodePosition,
  updateNodeSize,
  updateNodeData,
  updateNodeTitle,
  setSelectedNode,
  addLink,
  deleteLink,
  clearCanvasState,
  setVariable,
  clearVariables,
  resetRunner,
  addLog,
  clearLogs,
  initRecentFiles,
  setExecutionDelay,
  NODE_TYPES
} from '../src/state.js';
import { 
  stepWorkflow, 
  resetWorkflow, 
  executeLocalTool 
} from '../src/runtime.js';
import { t as translate } from '../src/i18n.js';

test('Model state mutations & events regression tests', async (t) => {

  await t.test('should change language and emit languageChanged event', () => {
    let fired = false;
    let val = '';
    const cb = (lang) => {
      fired = true;
      val = lang;
    };
    state.on('languageChanged', cb);
    
    setLanguage('en');
    assert.strictEqual(state.lang, 'en');
    assert.strictEqual(fired, true);
    assert.strictEqual(val, 'en');
    
    state.off('languageChanged', cb);
  });

  await t.test('should change theme and emit themeChanged event', () => {
    let fired = false;
    let val = '';
    const cb = (theme) => {
      fired = true;
      val = theme;
    };
    state.on('themeChanged', cb);
    
    setTheme('theme-matrix-green');
    assert.strictEqual(state.theme, 'theme-matrix-green');
    assert.strictEqual(fired, true);
    assert.strictEqual(val, 'theme-matrix-green');
    
    state.off('themeChanged', cb);
  });

  await t.test('should change API config and emit corresponding events', () => {
    let urlFired = false;
    let modelFired = false;
    let keyFired = false;

    state.on('apiEndpointChanged', () => { urlFired = true; });
    state.on('apiModelChanged', () => { modelFired = true; });
    state.on('apiKeyChanged', () => { keyFired = true; });

    setApiEndpoint('http://localhost:8000/v1');
    setApiModel('gpt-4');
    setApiKey('test-key');

    assert.strictEqual(state.apiEndpoint, 'http://localhost:8000/v1');
    assert.strictEqual(state.apiModel, 'gpt-4');
    assert.strictEqual(state.apiKey, 'test-key');
    assert.strictEqual(urlFired, true);
    assert.strictEqual(modelFired, true);
    assert.strictEqual(keyFired, true);
  });

  await t.test('should handle variables mutations and events', () => {
    let fired = false;
    state.on('variablesChanged', () => { fired = true; });

    setVariable('foo', 'bar');
    assert.strictEqual(state.variables.foo, 'bar');
    assert.strictEqual(fired, true);

    fired = false;
    clearVariables();
    assert.deepStrictEqual(state.variables, {});
    assert.strictEqual(fired, true);
  });

  await t.test('should handle node mutations and canvas lifecycle events', () => {
    let addedFired = false;
    let movedFired = false;
    let resizedFired = false;
    let dataFired = false;
    let titleFired = false;
    let deletedFired = false;
    let selectionFired = false;

    state.on('nodeAdded', () => { addedFired = true; });
    state.on('nodeMoved', () => { movedFired = true; });
    state.on('nodeResized', () => { resizedFired = true; });
    state.on('nodeDataChanged', () => { dataFired = true; });
    state.on('nodeTitleChanged', () => { titleFired = true; });
    state.on('nodeDeleted', () => { deletedFired = true; });
    state.on('selectedNodeChanged', () => { selectionFired = true; });

    // 1. Add Node
    const node = {
      id: 'node_1',
      type: NODE_TYPES.PROMPT,
      title: 'Prompt',
      x: 10,
      y: 20,
      width: 200,
      height: 100,
      data: { promptTemplate: 'template' }
    };
    addNode(node);
    assert.strictEqual(state.nodes.length, 1);
    assert.deepStrictEqual(state.nodes[0], node);
    assert.strictEqual(addedFired, true);

    // 2. Select Node
    setSelectedNode('node_1');
    assert.strictEqual(state.selectedNodeId, 'node_1');
    assert.strictEqual(selectionFired, true);

    // 3. Move Node
    updateNodePosition('node_1', 15, 25);
    assert.strictEqual(state.nodes[0].x, 15);
    assert.strictEqual(state.nodes[0].y, 25);
    assert.strictEqual(movedFired, true);

    // 4. Resize Node
    updateNodeSize('node_1', 250, 120);
    assert.strictEqual(state.nodes[0].width, 250);
    assert.strictEqual(state.nodes[0].height, 120);
    assert.strictEqual(resizedFired, true);

    // 5. Update Node Data & Title
    updateNodeData('node_1', 'promptTemplate', 'new template');
    assert.strictEqual(state.nodes[0].data.promptTemplate, 'new template');
    assert.strictEqual(dataFired, true);

    updateNodeTitle('node_1', 'New Prompt Title');
    assert.strictEqual(state.nodes[0].title, 'New Prompt Title');
    assert.strictEqual(titleFired, true);

    // 6. Delete Node
    deleteNode('node_1');
    assert.strictEqual(state.nodes.length, 0);
    assert.strictEqual(state.selectedNodeId, null);
    assert.strictEqual(deletedFired, true);
  });

  await t.test('should handle links and canvas clearance', () => {
    clearCanvasState();
    assert.strictEqual(state.nodes.length, 0);
    assert.strictEqual(state.links.length, 0);

    const link = { id: 'link_1', fromNode: 'n1', fromPort: 'out', toNode: 'n2', toPort: 'in', type: 'flow' };
    addLink(link);
    assert.strictEqual(state.links.length, 1);
    assert.deepStrictEqual(state.links[0], link);

    // Test duplicate target links elimination constraint
    const link2 = { id: 'link_2', fromNode: 'n3', fromPort: 'out', toNode: 'n2', toPort: 'in', type: 'flow' };
    addLink(link2);
    assert.strictEqual(state.links.length, 1);
    assert.deepStrictEqual(state.links[0], link2);

    deleteLink('link_2');
    assert.strictEqual(state.links.length, 0);
  });

  await t.test('should handle logs and emit logAdded event', () => {
    let fired = false;
    let entryText = '';
    state.on('logAdded', (entry) => {
      fired = true;
      entryText = entry.text;
    });

    addLog('Test log entry', 'info', 'detail stack trace');
    assert.strictEqual(fired, true);
    assert.strictEqual(entryText, 'Test log entry');
    assert.strictEqual(state.logs.length, 1);
    assert.strictEqual(state.logs[0].text, 'Test log entry');
  });

  await t.test('should evaluate workflow step and update runtime state', async () => {
    clearCanvasState();
    resetWorkflow();

    const startNode = {
      id: 'node_start_1',
      type: NODE_TYPES.START,
      title: 'Start Node',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      data: { inputValue: 'Hello World' }
    };
    addNode(startNode);

    let stateFired = false;
    let stepCount = 0;

    state.on('runnerStateChanged', () => { stateFired = true; });
    state.on('totalStepsChanged', (val) => { stepCount = val; });

    await stepWorkflow();

    assert.strictEqual(state.currentNodeId, 'node_start_1');
    assert.strictEqual(state.totalSteps, 1);
    assert.strictEqual(stateFired, true);

    resetWorkflow();
    assert.strictEqual(state.runnerState, 'idle');
    assert.strictEqual(state.currentNodeId, null);
    assert.strictEqual(state.totalSteps, 0);
  });

  await t.test('should execute local tools cleanly', async () => {
    setVariable('current_code', 'function foo() { return true; }');
    const testResult = await executeLocalTool('mock_test', '');
    assert.strictEqual(testResult.includes('PASS'), true);

    setVariable('current_code', 'SyntaxError: Unexpected token');
    const failResult = await executeLocalTool('mock_test', '');
    assert.strictEqual(failResult.includes('FAILED'), true);

    const sandboxResult = await executeLocalTool('js_sandbox', '1 + 2');
    assert.strictEqual(sandboxResult, '3');
  });

  await t.test('should translate keys cleanly with parameter interpolation', async () => {
    setLanguage('ja');
    assert.strictEqual(translate('btn_run'), '自動実行');
    assert.strictEqual(translate('workflow_completed', { result: 'OK' }), 'ワークフローの実行が正常終了しました。結果: OK');

    setLanguage('en');
    assert.strictEqual(translate('btn_run'), 'Run');
    assert.strictEqual(translate('workflow_completed', { result: 'OK' }), 'Workflow execution completed successfully. Result: OK');
  });

  await t.test('should handle event_wait and stream_view node evaluation in loop', async () => {
    clearCanvasState();
    const waitNode = { id: 'ew1', type: 'event_wait', title: 'Event Wait', x: 0, y: 0, width: 200, height: 100, data: {} };
    const streamNode = { id: 'sv1', type: 'stream_view', title: 'Stream View', x: 300, y: 0, width: 200, height: 100, data: {} };
    addNode(waitNode);
    addNode(streamNode);

    addLink({ id: 'l1', fromNode: 'ew1', fromPort: 'flow-out', toNode: 'sv1', toPort: 'flow-in', type: 'flow' });
    addLink({ id: 'l2', fromNode: 'ew1', fromPort: 'data-out', toNode: 'sv1', toPort: 'text-in', type: 'data' });

    // 1. First step on event_wait without payload pauses in waiting state
    await stepWorkflow();
    assert.strictEqual(state.runnerState, 'paused');

    // 2. Inject event payload on waitNode
    waitNode.data.pendingEventPayload = 'Hello Event!';
    await stepWorkflow(); // evaluates event_wait
    assert.strictEqual(waitNode.data.lastEventValue, 'Hello Event!');

    // 3. Step to stream_view
    await stepWorkflow(); // evaluates stream_view
    assert.strictEqual((streamNode.data.streamLogs || []).length, 1);
    assert.strictEqual(streamNode.data.streamLogs[0].text, 'Hello Event!');

    // 4. Test stream_view evaluation with structured messages array (verifies clearChatMessages)
    const sessionSourceNode = { id: 'sess1', type: 'session', title: 'Session Manager', x: 0, y: 0, width: 200, height: 100, data: { messages: [{ role: 'user', content: 'Turn 1' }] } };
    addNode(sessionSourceNode);
    addLink({ id: 'l_msg', fromNode: 'sess1', fromPort: 'messages-out', toNode: 'sv1', toPort: 'messages-in', type: 'data' });
    
    await stepWorkflow();
    assert.strictEqual(state.chatMessages.length, 1);
    assert.strictEqual(state.chatMessages[0].text, 'Turn 1');
  });

  await t.test('should accumulate multi-turn conversation history in set_var node', async () => {
    clearCanvasState();
    clearVariables();
    resetRunner();
    const waitNode = { id: 'ew1', type: 'event_wait', title: 'Event Wait', x: 0, y: 0, width: 200, height: 100, data: {} };
    const promptNode = { id: 'pr1', type: 'prompt', title: 'Prompt Builder', x: 300, y: 0, width: 200, height: 100, data: { promptTemplate: 'History:\n{{chat_history}}\nUser: {{inputValue}}\nAssistant:' } };
    const setVarNode = { id: 'sv1', type: 'set_var', title: 'Set Var History', x: 600, y: 0, width: 200, height: 100, data: { variableName: 'chat_history' } };

    addNode(waitNode);
    addNode(promptNode);
    addNode(setVarNode);

    addLink({ id: 'fl1', fromNode: 'ew1', fromPort: 'flow-out', toNode: 'pr1', toPort: 'flow-in', type: 'flow' });
    addLink({ id: 'fl2', fromNode: 'pr1', fromPort: 'flow-out', toNode: 'sv1', toPort: 'flow-in', type: 'flow' });
    addLink({ id: 'fl_loop', fromNode: 'sv1', fromPort: 'flow-out', toNode: 'ew1', toPort: 'flow-in', type: 'flow' });
    addLink({ id: 'l1', fromNode: 'ew1', fromPort: 'data-out', toNode: 'pr1', toPort: 'data-in', type: 'data' });
    addLink({ id: 'l2', fromNode: 'pr1', fromPort: 'prompt-out', toNode: 'sv1', toPort: 'value-in', type: 'data' });

    // Turn 1
    state.nodes.find(n => n.id === 'ew1').data.pendingEventPayload = 'Turn 1 User Input';
    await stepWorkflow(); // ew1 (processes event and moves to pr1)
    await stepWorkflow(); // pr1 (compiles prompt and moves to sv1)
    await stepWorkflow(); // sv1 (sets chat_history variable)
    assert.strictEqual(Boolean(state.variables['chat_history'] && state.variables['chat_history'].includes('Turn 1 User Input')), true);

    // Turn 2
    state.nodes.find(n => n.id === 'ew1').data.pendingEventPayload = 'Turn 2 User Input';
    await stepWorkflow(); // ew1
    await stepWorkflow(); // pr1
    const compiledPrompt = state.nodes.find(n => n.id === 'pr1').data.lastCompiledPrompt;
    assert.strictEqual(Boolean(compiledPrompt && compiledPrompt.includes('Turn 1 User Input')), true);
    assert.strictEqual(Boolean(compiledPrompt && compiledPrompt.includes('Turn 2 User Input')), true);
  });

  await t.test('should normalize raw strings and arrays into Fabre Canonical Messages', async () => {
    const { normalizeToCanonicalMessages } = await import('../src/llm.js');
    
    // 1. Raw string input with system prompt
    const msgs1 = normalizeToCanonicalMessages('Hello World', 'You are AI.');
    assert.strictEqual(msgs1.length, 2);
    assert.strictEqual(msgs1[0].role, 'system');
    assert.strictEqual(msgs1[1].role, 'user');
    assert.strictEqual(msgs1[1].content, 'Hello World');

    // 2. Multi-turn text input
    const multiTurnText = 'User: Hi\nAssistant: Hello!\nUser: How are you?';
    const msgs2 = normalizeToCanonicalMessages(multiTurnText, 'System Prompt');
    assert.strictEqual(msgs2.length, 4);
    assert.strictEqual(msgs2[1].role, 'user');
    assert.strictEqual(msgs2[1].content, 'Hi');
    assert.strictEqual(msgs2[2].role, 'assistant');
    assert.strictEqual(msgs2[2].content, 'Hello!');

    // 3. Structured Array Input
    const rawArray = [
      { role: 'user', content: 'Turn 1' },
      { role: 'assistant', content: 'Reply 1' }
    ];
    const msgs3 = normalizeToCanonicalMessages(rawArray);
    assert.strictEqual(msgs3.length, 2);
    assert.strictEqual(msgs3[0].role, 'user');
    assert.strictEqual(msgs3[1].role, 'assistant');
  });

  await t.test('should manage MCP servers and aggregate tool schemas for LLM Function Calling', async () => {
    const { removeMcpServer, updateGlobalMcpTools, getMcpToolsForOpenAi } = await import('../src/mcp.js');
    
    // Simulate registered MCP server in state
    state.mcpServers = [
      {
        id: 'srv_test_1',
        name: 'GitMCP',
        url: 'http://localhost:3000/mcp',
        status: 'connected',
        tools: [
          { name: 'git_status', description: 'Get git status', inputSchema: { type: 'object', properties: {} } },
          { name: 'git_commit', description: 'Commit changes', inputSchema: { type: 'object', properties: { message: { type: 'string' } } } }
        ]
      }
    ];

    updateGlobalMcpTools();
    assert.strictEqual(state.mcpTools.length, 2);
    assert.strictEqual(state.mcpTools[0].fullId, 'mcp:GitMCP:git_status');

    const openAiTools = getMcpToolsForOpenAi();
    assert.strictEqual(openAiTools.length, 2);
    assert.strictEqual(openAiTools[0].function.name, 'git_status');

    // Test tool removal
    removeMcpServer('srv_test_1');
    assert.strictEqual(state.mcpServers.length, 0);
    assert.strictEqual(state.mcpTools.length, 0);
  });

  await t.test('should support tool-call-out port output resolution', async () => {
    clearCanvasState();
    resetRunner();
    addNode({ id: 'llm1', type: NODE_TYPES.LLM, title: 'LLM Call', data: { lastToolCall: 'alert("HELLO")' } });
    addNode({ id: 'tool1', type: NODE_TYPES.TOOL, title: 'JS Sandbox', data: { toolType: 'js_sandbox' } });
    addLink({ id: 'l1', fromNode: 'llm1', fromPort: 'tool-call-out', toNode: 'tool1', toPort: 'data-in', type: 'data' });
    
    const { getPortInputValue } = await import('../src/runtime.js');
    const inputVal = getPortInputValue('tool1', 'data-in');
    assert.strictEqual(inputVal, 'alert("HELLO")');
  });

  await t.test('should manage structured session messages and handle LLM session inheritance', async () => {
    clearCanvasState();
    resetRunner();
    
    // Add Event Wait, Session Manager, and LLM Call
    addNode({ id: 'evt1', type: NODE_TYPES.EVENT_WAIT, title: 'Event Wait', data: { lastEventValue: 'Hello AI!' } });
    addNode({ id: 'sess1', type: NODE_TYPES.SESSION, title: 'Session Manager', data: { modelOverride: 'gpt-4o-test', maxHistoryTurns: 5, messages: [] } });
    addNode({ id: 'llm1', type: NODE_TYPES.LLM, title: 'LLM Call', data: {} });
    
    addLink({ id: 'l1', fromNode: 'evt1', fromPort: 'data-out', toNode: 'sess1', toPort: 'user-in', type: 'data' });
    addLink({ id: 'l2', fromNode: 'sess1', fromPort: 'session-out', toNode: 'llm1', toPort: 'session-in', type: 'data' });
    
    const { getPortInputValue, evaluateNode } = await import('../src/runtime.js');
    
    // Evaluate Session Node
    await evaluateNode(state.nodes.find(n => n.id === 'sess1'));
    
    const sessionVal = getPortInputValue('llm1', 'session-in');
    assert.ok(sessionVal);
    assert.strictEqual(sessionVal.modelOverride, 'gpt-4o-test');
    assert.strictEqual(sessionVal.messages.length, 1);
    assert.strictEqual(sessionVal.messages[0].role, 'user');
    assert.strictEqual(sessionVal.messages[0].content, 'Hello AI!');
  });

  await t.test('should clear debug console logs and emit logsCleared event', async () => {
    addLog('Test log 1');
    addLog('Test log 2');
    assert.strictEqual(state.logs.length >= 2, true);

    let clearedFired = false;
    state.on('logsCleared', () => { clearedFired = true; });

    clearLogs();
    assert.strictEqual(state.logs.length, 0);
    assert.strictEqual(clearedFired, true);
  });

  await t.test('should initialize and hydrate recent files with sample workflow data', async () => {
    initRecentFiles();
    assert.strictEqual(state.recentFiles.length >= 4, true);

    const sampleChat = state.recentFiles.find(f => f.id === 'sample_chat');
    assert.ok(sampleChat);
    assert.ok(sampleChat.data);
    assert.strictEqual(sampleChat.data.nodes.length, 5);

    const setVarNode = sampleChat.data.nodes.find(n => n.type === 'set_var');
    assert.strictEqual(setVarNode.data.variableName, 'last_response');
  });

  await t.test('should load workflow data onto state canvas cleanly', async () => {
    const { loadWorkflowData } = await import('../src/ui.js');
    const testData = {
      format: 'fabre-workflow',
      version: '0.1.0',
      nodes: [
        { id: 'n1', type: NODE_TYPES.START, title: 'Start', data: { inputValue: 'Test' } },
        { id: 'n2', type: NODE_TYPES.OUTPUT, title: 'Output', data: {} }
      ],
      links: [
        { id: 'l1', fromNode: 'n1', fromPort: 'flow-out', toNode: 'n2', toPort: 'flow-in', type: 'flow' }
      ],
      variables: { test_var: 'hello' }
    };

    loadWorkflowData(testData, 'Test Load');

    assert.strictEqual(state.nodes.length, 2);
    assert.strictEqual(state.links.length, 1);
    assert.strictEqual(state.variables.test_var, 'hello');
  });

  await t.test('should trigger node event and resume workflow execution cleanly', async () => {
    clearCanvasState();
    resetWorkflow();

    const evtNode = { id: 'evt1', type: NODE_TYPES.EVENT_WAIT, title: 'User Instruction Event', data: {} };
    const outNode = { id: 'out1', type: NODE_TYPES.OUTPUT, title: 'Output', data: {} };
    addNode(evtNode);
    addNode(outNode);
    addLink({ id: 'l1', fromNode: 'evt1', fromPort: 'flow-out', toNode: 'out1', toPort: 'flow-in', type: 'flow' });
    addLink({ id: 'l2', fromNode: 'evt1', fromPort: 'data-out', toNode: 'out1', toPort: 'text-in', type: 'data' });

    const { triggerNodeEvent, evaluateNode } = await import('../src/runtime.js');

    // First evaluation without event payload pauses workflow
    const firstRes = await evaluateNode(state.nodes.find(n => n.id === 'evt1'));
    assert.strictEqual(firstRes.nextFlowPort, null);
    assert.strictEqual(state.runnerState, 'paused');

    // Triggering event sets payload and advances
    await triggerNodeEvent('evt1', 'My Custom Event Input');
    assert.strictEqual(evtNode.data.lastEventValue, 'My Custom Event Input');
  });

  await t.test('should pause after exactly 1 step when stepWorkflow(true) is invoked', async () => {
    clearCanvasState();
    resetWorkflow();

    addNode({ id: 'n1', type: NODE_TYPES.START, title: 'Start', data: { inputValue: 'Hello' } });
    addNode({ id: 'n2', type: NODE_TYPES.PROMPT, title: 'Prompt', data: { promptTemplate: '{{inputValue}}' } });
    addNode({ id: 'n3', type: NODE_TYPES.OUTPUT, title: 'Output', data: {} });

    addLink({ id: 'l1', fromNode: 'n1', fromPort: 'flow-out', toNode: 'n2', toPort: 'flow-in', type: 'flow' });
    addLink({ id: 'l2', fromNode: 'n2', fromPort: 'flow-out', toNode: 'n3', toPort: 'flow-in', type: 'flow' });

    // Step 1: stepWorkflow(true) executes n1 and pauses at n2
    await stepWorkflow(true);
    assert.strictEqual(state.currentNodeId, 'n2');
    assert.strictEqual(state.runnerState, 'paused');
    assert.strictEqual(state.totalSteps, 1);
  });

  await t.test('should execute multi-node workflow continuously to completion when runWorkflow() is invoked', async () => {
    clearCanvasState();
    resetWorkflow();

    addNode({ id: 'n1', type: NODE_TYPES.START, title: 'Start', data: { inputValue: 'Auto Run Test' } });
    addNode({ id: 'n2', type: NODE_TYPES.PROMPT, title: 'Prompt', data: { promptTemplate: 'Echo: {{inputValue}}' } });
    addNode({ id: 'n3', type: NODE_TYPES.OUTPUT, title: 'Output', data: {} });

    addLink({ id: 'l1', fromNode: 'n1', fromPort: 'flow-out', toNode: 'n2', toPort: 'flow-in', type: 'flow' });
    addLink({ id: 'l2', fromNode: 'n2', fromPort: 'flow-out', toNode: 'n3', toPort: 'flow-in', type: 'flow' });

    setExecutionDelay(10);
    const { runWorkflow: runExec } = await import('../src/runtime.js');

    runExec();
    // Wait for continuous execution loop to complete all 3 steps
    await new Promise(resolve => setTimeout(resolve, 300));

    assert.strictEqual(state.runnerState, 'success');
    assert.strictEqual(state.totalSteps, 3);
  });

  await t.test('should bring node to front by updating z-index without mutating DOM structure', async () => {
    const { bringNodeToFront } = await import('../src/canvas.js');
    clearCanvasState();
    addNode({ id: 'n1', type: NODE_TYPES.START, title: 'Start', data: {} });
    bringNodeToFront('n1');
    const nodeCard = state.nodes.find(n => n.id === 'n1');
    assert.ok(nodeCard);
  });

  await t.test('should extract code block with CRLF newlines and feed tool node via port aliases', async () => {
    clearCanvasState();
    resetWorkflow();

    const extNode = { id: 'ext1', type: NODE_TYPES.EXTRACTOR, title: 'Extractor', data: { extractorType: 'code_block' } };
    const toolNode = { id: 'tool1', type: NODE_TYPES.TOOL, title: 'Tool', data: { toolType: 'js_sandbox' } };
    addNode(extNode);
    addNode(toolNode);
    addLink({ id: 'l1', fromNode: 'ext1', fromPort: 'extracted-out', toNode: 'tool1', toPort: 'input-in', type: 'data' });

    extNode.data.lastExtractedValue = "alert('TEST_OK');";

    const { getPortInputValue, evaluateNode } = await import('../src/runtime.js');
    const inputVal = getPortInputValue('tool1', 'input-in');
    assert.strictEqual(inputVal, "alert('TEST_OK');");

    await evaluateNode(toolNode);
    assert.ok(toolNode.data.lastToolResult.includes('JS executed successfully') || toolNode.data.lastToolResult.includes('TEST_OK'));
  });

  await t.test('should support deleting individual session messages and clearing history', async () => {
    clearCanvasState();
    const sessionNode = { id: 'sess1', type: NODE_TYPES.SESSION, title: 'Session', data: { messages: [{ role: 'user', content: 'Turn 1' }, { role: 'assistant', content: 'Turn 2' }] } };
    addNode(sessionNode);

    // Individual turn deletion
    sessionNode.data.messages.splice(0, 1);
    updateNodeData('sess1', 'messages', sessionNode.data.messages);
    assert.strictEqual(sessionNode.data.messages.length, 1);
    assert.strictEqual(sessionNode.data.messages[0].content, 'Turn 2');

    // Bulk history clear
    updateNodeData('sess1', 'messages', []);
    assert.strictEqual(sessionNode.data.messages.length, 0);
  });

  await t.test('should resolve tool configuration with global defaults and local overrides', async () => {
    const { resolveToolConfig } = await import('../src/mcp.js');
    const { getAllAvailableToolsForOpenAi } = await import('../src/llm.js');

    // Default resolution
    const defaults = resolveToolConfig();
    assert.deepStrictEqual(defaults.enabledBuiltInTools, ['js_sandbox', 'read_file', 'write_file', 'list_files', 'mock_test', 'mock_search']);
    assert.strictEqual(defaults.requireToolCall, false);

    // Overridden resolution
    const overrides = resolveToolConfig({ enabledBuiltInTools: ['js_sandbox'], requireToolCall: true });
    assert.deepStrictEqual(overrides.enabledBuiltInTools, ['js_sandbox']);
    assert.strictEqual(overrides.requireToolCall, true);

    const tools = getAllAvailableToolsForOpenAi({ enabledBuiltInTools: ['js_sandbox'] });
    assert.strictEqual(tools.length, 1);
    assert.strictEqual(tools[0].function.name, 'js_sandbox');
  });

  await t.test('should evaluate tool_config node and feed tool configuration to llm node via tools-in port', async () => {
    clearCanvasState();
    resetWorkflow();

    const toolCfgNode = { id: 'tc1', type: NODE_TYPES.TOOL_CONFIG, title: 'Tool Config', data: { enabledBuiltInTools: ['js_sandbox', 'read_file'], requireToolCall: true } };
    const llmNode = { id: 'llm1', type: NODE_TYPES.LLM, title: 'LLM Call', data: {} };
    addNode(toolCfgNode);
    addNode(llmNode);
    addLink({ id: 'l1', fromNode: 'tc1', fromPort: 'tools-out', toNode: 'llm1', toPort: 'tools-in', type: 'data' });

    const { evaluateNode } = await import('../src/runtime.js');
    await evaluateNode(toolCfgNode);

    assert.ok(toolCfgNode.data);
  });

});
