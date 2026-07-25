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
  addLog,
  NODE_TYPES
} from '../src/state.js';
import { 
  stepWorkflow, 
  resetWorkflow, 
  executeLocalTool 
} from '../src/runtime.js';

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

});
