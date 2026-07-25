// Themed Custom Dialog Modals, Prompt Overlay Editor, Inspector Panels, and Language/Theme Switching
'use strict';

import { 
  state, 
  TRANSLATIONS, 
  getDefaultSystemPrompt, 
  NODE_TYPES,
  setLanguage,
  setTheme,
  setLlmProvider,
  updateNodeTitle,
  updateNodeData,
  setSelectedNode,
  addLog,
  setExecutionDelay
} from './state.js';
import { runLlmQuery } from './llm.js';
import { runWorkflow, stepWorkflow, pauseWorkflow, resetWorkflow } from './runtime.js';
import { drawConnections } from './canvas.js';

/**
 * Standard log message wrapper delegating to Model Mutator
 * @param {string} text Log entry description
 * @param {string} type 'info' | 'success' | 'warning' | 'error'
 * @param {string|null} details Optional multiline payload representation
 */
export function log(text, type = 'info', details = null) {
  addLog(text, type, details);
}

/**
 * Switch global application UI language (Delegates to Model Mutator)
 * @param {string} langCode 'en' | 'ja'
 */
export function applyLanguage(langCode) {
  setLanguage(langCode);
}

/**
 * Switch color theme css flags (Delegates to Model Mutator)
 * @param {string} themeName 'theme-cyber-dark' | 'theme-matrix-green' | 'theme-light-slate'
 */
export function applyTheme(themeName) {
  setTheme(themeName);
}

/**
 * Initialize Sidebar Navigation Tabs
 */
export function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all tabs
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      // Activate clicked
      tab.classList.add('active');
      const contentId = tab.getAttribute('data-tab');
      const contentEl = document.getElementById(contentId);
      if (contentEl) contentEl.classList.add('active');
    });
  });
}

/**
 * Initialize reactive listeners for UI updates
 */
export function initUiListeners() {
  // 1. Language change listener
  state.on('languageChanged', (langCode) => {
    localStorage.setItem('fabre_settings_lang', langCode);
    updateLanguageUI(langCode);
  });

  // 2. Theme change listener
  state.on('themeChanged', (themeName) => {
    localStorage.setItem('fabre_settings_theme', themeName);
    updateThemeUI(themeName);
  });

  // 3. Provider changed
  state.on('llmProviderChanged', (provider) => {
    localStorage.setItem('fabre_settings_llmProvider', provider);
    updateLlmProviderUI(provider);
  });

  // 4. API Endpoints/Model/Key changed
  state.on('apiEndpointChanged', (endpoint) => {
    localStorage.setItem('fabre_settings_apiEndpoint', endpoint);
  });
  state.on('apiModelChanged', (model) => {
    localStorage.setItem('fabre_settings_apiModel', model);
  });
  state.on('apiKeyChanged', (key) => {
    localStorage.setItem('fabre_settings_apiKey', key);
  });

  // 5. Variables changed
  state.on('variablesChanged', () => {
    updateVariablesUI();
  });

  // 6. Log added
  state.on('logAdded', (entry) => {
    renderLogEntry(entry);
  });

  // 7. Runner State changes
  state.on('runnerStateChanged', (runnerState) => {
    updateRunnerUI(runnerState);
  });

  // 8. Current Node changes
  state.on('currentNodeChanged', (nodeId) => {
    updateCurrentNodeUI(nodeId);
  });

  // 9. Total Steps changes
  state.on('totalStepsChanged', (totalSteps) => {
    const stepsEl = document.getElementById('total-steps-val');
    if (stepsEl) stepsEl.innerText = totalSteps;
  });
}

function updateRunnerUI(runnerState) {
  const statusBadge = document.getElementById('runner-state-badge');
  if (statusBadge) {
    const t = TRANSLATIONS[state.lang];
    const key = `status_${runnerState}`;
    statusBadge.innerText = t[key] || runnerState.toUpperCase();
    statusBadge.className = `state-badge ${runnerState}`;
  }

  const runBtn = document.getElementById('run-btn');
  const stepBtn = document.getElementById('step-btn');
  const pauseBtn = document.getElementById('pause-btn');

  if (runBtn) runBtn.disabled = runnerState === 'running';
  if (stepBtn) stepBtn.disabled = runnerState === 'running';
  if (pauseBtn) pauseBtn.disabled = runnerState !== 'running';

  drawConnections();
}

function updateCurrentNodeUI(nodeId) {
  const nodeEl = document.getElementById('current-node-name');
  if (nodeEl) {
    const node = state.nodes.find(n => n.id === nodeId);
    nodeEl.innerText = node ? `${node.title} (${node.id})` : (state.lang === 'en' ? 'None' : 'なし');
  }

  document.querySelectorAll('.node-card').forEach(card => {
    if (card.id === nodeId) {
      card.classList.add('executing', 'active-step');
    } else {
      card.classList.remove('executing', 'active-step');
    }
  });
}

export function initRunnerControls() {
  const runBtn = document.getElementById('run-btn');
  if (runBtn) runBtn.addEventListener('click', runWorkflow);

  const stepBtn = document.getElementById('step-btn');
  if (stepBtn) stepBtn.addEventListener('click', stepWorkflow);

  const pauseBtn = document.getElementById('pause-btn');
  if (pauseBtn) pauseBtn.addEventListener('click', pauseWorkflow);

  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', resetWorkflow);

  const delayInput = document.getElementById('speed-slider');
  const delayLabel = document.getElementById('speed-value');
  if (delayInput) {
    delayInput.addEventListener('input', (e) => {
      const delay = parseInt(e.target.value, 10);
      setExecutionDelay(delay);
      if (delayLabel) delayLabel.innerText = `${delay}ms`;
    });
  }
}

/**
 * Update Language DOM representation
 */
function updateLanguageUI(langCode) {
  const t = TRANSLATIONS[langCode];
  if (!t) return;
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      if (el.children.length > 0) {
        let textNode = Array.from(el.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        if (textNode) {
          textNode.nodeValue = ' ' + t[key];
        } else {
          el.appendChild(document.createTextNode(' ' + t[key]));
        }
      } else {
        el.innerText = t[key];
      }
    }
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (t[key]) el.setAttribute('title', t[key]);
  });
  
  const select = document.getElementById('settings-language');
  if (select) select.value = langCode;
  
  log(langCode === 'en' ? 'Language switched to English.' : '言語が日本語に切り替わりました。', 'info');
  
  // Re-render properties panel to apply language changes if visible
  if (state.selectedNodeId) {
    showNodeProperties(state.selectedNodeId);
  }
  
  // Re-render all canvas cards with localized strings
  state.nodes.forEach(node => {
    const cardEl = document.getElementById(node.id);
    if (cardEl) {
      cardEl.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.innerText = t[key];
      });
      const cardTitleSpan = cardEl.querySelector('.node-title span:last-child');
      if (cardTitleSpan) {
        const defaultTitle = TRANSLATIONS[state.lang][`node_${node.type}`] || node.type;
        if (node.title === TRANSLATIONS[langCode === 'en' ? 'ja' : 'en'][`node_${node.type}`] || node.title === defaultTitle) {
          node.title = defaultTitle;
          cardTitleSpan.innerText = defaultTitle;
        }
      }
    }
  });
}

/**
 * Update Theme CSS DOM representation
 */
function updateThemeUI(themeName) {
  document.body.classList.remove('theme-cyber-dark', 'theme-matrix-green', 'theme-light-slate');
  document.body.classList.add(themeName);
  
  const select = document.getElementById('settings-theme');
  if (select) select.value = themeName;
  
  log(state.lang === 'en' ? `Color theme switched to ${themeName}.` : `カラーテーマを ${themeName} に切り替えました。`, 'info');
}

/**
 * Update LLM provider visual settings block collapse/expand
 */
function updateLlmProviderUI(provider) {
  const select = document.getElementById('settings-provider');
  if (select) select.value = provider;
  
  const openaiBlock = document.getElementById('openai-settings-block');
  const badgeText = document.getElementById('provider-badge-text');
  const badgeContainer = document.getElementById('provider-badge');
  
  if (provider === 'openai-compatible') {
    if (openaiBlock) openaiBlock.classList.remove('collapsed');
    if (badgeContainer && badgeText) {
      badgeContainer.className = 'status-badge info';
      badgeText.innerText = 'LLM: Custom API';
      badgeText.removeAttribute('data-i18n');
    }
  } else {
    if (openaiBlock) openaiBlock.classList.add('collapsed');
    if (badgeContainer && badgeText && state.chromeAiAvailable) {
      badgeContainer.className = 'status-badge success';
      badgeText.innerText = 'LLM: Chrome AI';
      badgeText.removeAttribute('data-i18n');
    }
  }
}

/**
 * Render log entry DOM element in log console panel
 */
function renderLogEntry(entry) {
  const { timestamp, text, type, details } = entry;
  const container = document.getElementById('logs-container');
  if (!container) return;
  
  if (state.logs.length === 1) {
    container.innerHTML = '';
  }
  
  const entryEl = document.createElement('div');
  entryEl.className = `log-entry ${type}`;
  
  const metaEl = document.createElement('div');
  metaEl.className = 'log-meta';
  metaEl.innerHTML = `<span>[${type.toUpperCase()}]</span><span>${timestamp}</span>`;
  entryEl.appendChild(metaEl);
  
  const textEl = document.createElement('div');
  textEl.className = 'log-text';
  textEl.innerText = text;
  entryEl.appendChild(textEl);
  
  if (details) {
    const detailsEl = document.createElement('pre');
    detailsEl.className = 'log-details';
    detailsEl.style.display = 'none';
    detailsEl.innerText = details;
    
    // Toggle details on entry click
    entryEl.style.cursor = 'pointer';
    entryEl.addEventListener('click', (e) => {
      if (window.getSelection().toString()) return;
      detailsEl.style.display = detailsEl.style.display === 'none' ? 'block' : 'none';
    });
    
    entryEl.appendChild(detailsEl);
  }
  
  container.appendChild(entryEl);
  container.scrollTop = container.scrollHeight;
}

/**
 * Display selected node parameters in the inspector sidebar panel
 * @param {string} nodeId Node ID
 */
export function showNodeProperties(nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  const container = document.getElementById('properties-content');
  const section = document.getElementById('node-properties-section');
  
  if (!node || !container || !section) return;
  
  section.classList.remove('collapsed');
  container.innerHTML = '';
  
  const t = TRANSLATIONS[state.lang];

  let html = `
    <!-- Common Node Fields -->
    <div class="form-group">
      <label>${t.prop_node_id}</label>
      <input type="text" class="node-input-text" value="${node.id}" readonly style="opacity: 0.6; font-family: var(--font-mono); font-size:10px;">
    </div>
    <div class="form-group">
      <label>${t.prop_node_title}</label>
      <input type="text" id="prop-title-input" class="node-input-text" value="${node.title}">
    </div>
    <div class="border-top" style="margin-top: 8px; padding-top: 8px;"></div>
  `;

  // Custom properties based on Node Type
  if (node.type === NODE_TYPES.START) {
    html += `
      <div class="form-group">
        <label>${t.prop_start_val}</label>
        <textarea id="prop-start-input" class="node-input-text node-textarea" placeholder="Input string...">${node.data.inputValue || ''}</textarea>
      </div>
    `;
  } else if (node.type === NODE_TYPES.PROMPT) {
    const displayVal = node.data.promptTemplate ? (node.data.promptTemplate.substring(0, 100) + (node.data.promptTemplate.length > 100 ? '...' : '')) : '';
    html += `
      <div class="form-group">
        <label>${t.prop_prompt_tmpl}</label>
        <div style="font-family: var(--font-mono); font-size:11px; padding: 10px; background-color: rgba(0,0,0,0.15); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-muted); min-height: 60px; white-space: pre-wrap; margin-bottom: 8px; max-height: 200px; overflow-y: auto;">${displayVal || 'Empty template...'}</div>
        <button id="open-prompt-editor-btn" class="btn btn-primary btn-sm" style="width: 100%;">
          📝 ${state.lang === 'en' ? 'Open Prompt Editor' : 'プロンプトエディタを開く'}
        </button>
      </div>
    `;
  } else if (node.type === NODE_TYPES.LLM) {
    html += `
      <div class="form-group">
        <label>${t.prop_llm_temp} (${node.data.temperature !== undefined ? node.data.temperature : 0.7})</label>
        <input type="range" id="prop-llm-temp" min="0.0" max="1.0" step="0.1" value="${node.data.temperature !== undefined ? node.data.temperature : 0.7}">
      </div>
      <div class="form-group" style="flex-direction:row; justify-content:space-between; align-items:center; margin-top:8px;">
        <label for="prop-llm-tools">${t.prop_llm_tools}</label>
        <input type="checkbox" id="prop-llm-tools" ${node.data.enableTools ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;">
      </div>
    `;
  } else if (node.type === NODE_TYPES.EXTRACTOR) {
    html += `
      <div class="form-group">
        <label>${t.prop_extractor_type}</label>
        <select id="prop-extractor-type">
          <option value="code_block" ${node.data.extractorType === 'code_block' ? 'selected' : ''}>Markdown Code Block</option>
          <option value="json" ${node.data.extractorType === 'json' ? 'selected' : ''}>JSON Key Extraction</option>
          <option value="regex" ${node.data.extractorType === 'regex' ? 'selected' : ''}>Regex Group Match</option>
          <option value="delimiter" ${node.data.extractorType === 'delimiter' ? 'selected' : ''}>Start/End Delimiter</option>
        </select>
      </div>
      <div class="form-group" id="prop-extractor-pattern-group" style="${node.data.extractorType === 'code_block' ? 'display:none;' : ''}">
        <label>${t.prop_extractor_pattern}</label>
        <input type="text" id="prop-extractor-pattern" class="node-input-text" value="${node.data.extractorPattern || ''}" placeholder="e.g. verdict, (PASS|FAIL)">
      </div>
    `;
  } else if (node.type === NODE_TYPES.CONDITION) {
    html += `
      <div class="form-group">
        <label>${t.prop_cond_type}</label>
        <select id="prop-cond-type">
          <option value="contains" ${node.data.conditionType === 'contains' ? 'selected' : ''}>Text Contains</option>
          <option value="not_contains" ${node.data.conditionType === 'not_contains' ? 'selected' : ''}>Text Does Not Contain</option>
          <option value="regex" ${node.data.conditionType === 'regex' ? 'selected' : ''}>Regex Match</option>
          <option value="js" ${node.data.conditionType === 'js' ? 'selected' : ''}>Custom JS Expression</option>
        </select>
      </div>
      <div class="form-group">
        <label>${t.prop_cond_val}</label>
        <input type="text" id="prop-cond-val" class="node-input-text" value="${node.data.conditionValue || ''}" placeholder="e.g. PASS, code !== ''">
      </div>
    `;
  } else if (node.type === NODE_TYPES.SET_VAR) {
    html += `
      <div class="form-group">
        <label>${t.prop_var_name}</label>
        <input type="text" id="prop-var-input" class="node-input-text" value="${node.data.variableName || ''}" placeholder="e.g. current_code">
      </div>
    `;
  } else if (node.type === NODE_TYPES.TOOL) {
    html += `
      <div class="form-group">
        <label>${t.prop_tool_type}</label>
        <select id="prop-tool-type">
          <option value="mock_test" ${node.data.toolType === 'mock_test' ? 'selected' : ''}>Mock Code Compiler/Tester</option>
          <option value="mock_search" ${node.data.toolType === 'mock_search' ? 'selected' : ''}>Mock Web Search</option>
          <option value="js_sandbox" ${node.data.toolType === 'js_sandbox' ? 'selected' : ''}>Real Custom JS Sandbox</option>
        </select>
      </div>
    `;
  } else if (node.type === NODE_TYPES.OUTPUT) {
    html += `
      <div class="form-group">
        <label>${t.prop_output_label}</label>
        <input type="text" id="prop-output-input" class="node-input-text" value="${node.data.outputLabel || 'Output'}" placeholder="e.g. Verification Report">
      </div>
    `;
  }

  container.innerHTML = html;
  
  // Wire up property change events
  wirePropertyControls(node);
}

function wirePropertyControls(node) {
  // Title modify
  const titleInput = document.getElementById('prop-title-input');
  if (titleInput) {
    titleInput.addEventListener('input', (e) => {
      updateNodeTitle(node.id, e.target.value);
    });
  }

  // Start Node input value modify
  const startInput = document.getElementById('prop-start-input');
  if (startInput) {
    startInput.addEventListener('input', (e) => {
      updateNodeData(node.id, 'inputValue', e.target.value);
    });
  }

  // Prompt Node edit trigger
  const openEditorBtn = document.getElementById('open-prompt-editor-btn');
  if (openEditorBtn) {
    openEditorBtn.addEventListener('click', () => {
      openPromptEditor(node);
    });
  }

  // LLM Call Temperature / Checkbox tools
  const tempRange = document.getElementById('prop-llm-temp');
  if (tempRange) {
    tempRange.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      updateNodeData(node.id, 'temperature', val);
      tempRange.previousElementSibling.innerText = `${TRANSLATIONS[state.lang].prop_llm_temp} (${val})`;
    });
  }
  
  const toolsCheck = document.getElementById('prop-llm-tools');
  if (toolsCheck) {
    toolsCheck.addEventListener('change', (e) => {
      updateNodeData(node.id, 'enableTools', e.target.checked);
    });
  }

  // Extractor selections
  const extractSelect = document.getElementById('prop-extractor-type');
  if (extractSelect) {
    extractSelect.addEventListener('change', (e) => {
      updateNodeData(node.id, 'extractorType', e.target.value);
      const patternGroup = document.getElementById('prop-extractor-pattern-group');
      if (patternGroup) {
        patternGroup.style.display = e.target.value === 'code_block' ? 'none' : 'block';
      }
    });
  }
  
  const extractPattern = document.getElementById('prop-extractor-pattern');
  if (extractPattern) {
    extractPattern.addEventListener('input', (e) => {
      updateNodeData(node.id, 'extractorPattern', e.target.value);
    });
  }

  // Condition rules selection
  const condSelect = document.getElementById('prop-cond-type');
  if (condSelect) {
    condSelect.addEventListener('change', (e) => {
      updateNodeData(node.id, 'conditionType', e.target.value);
    });
  }
  
  const condVal = document.getElementById('prop-cond-val');
  if (condVal) {
    condVal.addEventListener('input', (e) => {
      updateNodeData(node.id, 'conditionValue', e.target.value);
    });
  }

  // Set Var name input
  const varInput = document.getElementById('prop-var-input');
  if (varInput) {
    varInput.addEventListener('input', (e) => {
      updateNodeData(node.id, 'variableName', e.target.value);
    });
  }

  // Tool type select
  const toolSelect = document.getElementById('prop-tool-type');
  if (toolSelect) {
    toolSelect.addEventListener('change', (e) => {
      updateNodeData(node.id, 'toolType', e.target.value);
    });
  }

  // Output label input
  const outputInput = document.getElementById('prop-output-input');
  if (outputInput) {
    outputInput.addEventListener('input', (e) => {
      updateNodeData(node.id, 'outputLabel', e.target.value);
    });
  }
}

/**
 * Open the large overlay Prompt Editor Dialog
 * @param {object} node Target Prompt Node
 */
export function openPromptEditor(node) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'prompt-editor-modal';
  
  overlay.innerHTML = `
    <div class="modal-card" style="width: 900px; max-width: 95vw; height: 80vh; border-color: var(--primary);">
      <div class="modal-header">
        <span style="font-weight:600; display:flex; align-items:center; gap:8px;">
          <span style="font-size:16px;">✎</span>
          <span>${state.lang === 'en' ? 'Edit Prompt Template' : 'プロンプトテンプレートの編集'}: ${node.title}</span>
        </span>
        <button id="close-prompt-editor-x" class="modal-close-x">&times;</button>
      </div>
      <div class="modal-body" style="padding: 0; display: flex; height: calc(100% - 110px); overflow: hidden;">
        <!-- Left side: Text Editor -->
        <div style="flex: 2; display: flex; flex-direction: column; border-right: 1px solid var(--border-color); height: 100%;">
          <textarea id="modal-prompt-textarea" style="flex: 1; border: none; background-color: #05080f; color: #f1f5f9; font-family: var(--font-mono); font-size: 13px; padding: 20px; resize: none; outline: none; line-height: 1.6;"></textarea>
        </div>
        <!-- Right side: LLM Tools -->
        <div style="flex: 1; display: flex; flex-direction: column; padding: 20px; gap: 12px; background-color: rgba(0, 0, 0, 0.15); height: 100%; box-sizing: border-box;">
          <h4 style="margin: 0 0 4px 0;">${state.lang === 'en' ? 'System Instructions' : 'システム指示 (役割・追加命令)'}</h4>
          <div class="form-group" style="flex: 1; display: flex; flex-direction: column; margin: 0 0 8px 0; min-height: 0;">
            <textarea id="modal-prompt-system-textarea" class="node-input-text node-textarea" style="flex: 1; min-height: 0; font-family: var(--font-mono); font-size: 11px; line-height: 1.5; resize: none; padding: 12px; box-sizing: border-box; background-color: rgba(0,0,0,0.25); border: 1px solid var(--border-color); outline: none; border-radius: 6px;" placeholder="${state.lang === 'en' ? 'System prompt for optimization...' : '最適化時の役割・命令を入力...' }"></textarea>
          </div>
          
          <button id="modal-prompt-refine-btn" class="btn btn-primary btn-sm" style="width: 100%; margin: 0;">
            ✨ ${state.lang === 'en' ? 'Refine Template (LLM)' : 'プロンプト自動最適化 (LLM)'}
          </button>
        </div>
      </div>
      <div class="modal-footer" style="padding: 12px 20px; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 11px; color: var(--text-muted);">${state.lang === 'en' ? 'Tip: Use {{variable_name}} to inject variable values.' : 'ヒント: {{変数名}} と書くことで実行時に値が補完されます。'}</span>
        <div style="display: flex; gap: 8px;">
          <button id="modal-prompt-save-btn" class="btn btn-primary btn-sm">${state.lang === 'en' ? 'Save Changes' : '変更を保存'}</button>
          <button id="modal-prompt-cancel-btn" class="btn btn-secondary btn-sm">${state.lang === 'en' ? 'Cancel' : 'キャンセル'}</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  const textarea = document.getElementById('modal-prompt-textarea');
  textarea.value = node.data.promptTemplate || '';
  textarea.focus();
  
  // Wire events
  const closeX = document.getElementById('close-prompt-editor-x');
  const cancelBtn = document.getElementById('modal-prompt-cancel-btn');
  const saveBtn = document.getElementById('modal-prompt-save-btn');
  const refineBtn = document.getElementById('modal-prompt-refine-btn');
  const systemTextarea = document.getElementById('modal-prompt-system-textarea');
  systemTextarea.value = node.data.systemPrompt || getDefaultSystemPrompt();
  
  // Restore default system prompt on blur if completely empty
  systemTextarea.addEventListener('blur', () => {
    if (!systemTextarea.value.trim()) {
      systemTextarea.value = getDefaultSystemPrompt();
    }
  });

  console.log('Prompt Editor Elements:', { closeX, cancelBtn, saveBtn, refineBtn, systemTextarea });
  
  let activeAbortController = null;
  let isOptimizing = false;
  let saveOnLlmFinish = false;

  // Restore background optimization state if already running
  const runningReq = state.activeLlmRequests && state.activeLlmRequests[node.id];
  if (runningReq) {
    isOptimizing = true;
    activeAbortController = runningReq.controller;
  }

  const closeEditor = () => {
    state.activeEditor = null;
    overlay.remove();
  };

  const handleCancelEditor = () => {
    if (isOptimizing) {
      const isEn = state.lang === 'en';
      showChoiceDialog({
        title: isEn ? 'Confirm Cancel' : 'キャンセルの確認',
        body: isEn 
          ? 'An LLM optimization is currently in progress. Are you sure you want to cancel and abort the query?' 
          : 'プロンプトのAI生成処理が現在実行中です。処理を中断してエディタを閉じますか？',
        layout: 'row',
        width: 420,
        buttons: [
          {
            label: isEn ? 'No, Keep Editing' : 'いいえ、編集を続ける',
            type: 'secondary',
            onClick: () => {} // Keep editing
          },
          {
            label: isEn ? 'Yes, Abort & Close' : 'はい、処理を中断して閉じる',
            type: 'secondary',
            onClick: () => {
              if (activeAbortController) {
                activeAbortController.abort();
              }
              const card = document.getElementById(node.id);
              if (card) card.classList.remove('executing');
              if (state.activeLlmRequests) delete state.activeLlmRequests[node.id];
              closeEditor();
            }
          }
        ]
      });
    } else {
      closeEditor();
    }
  };

  closeX.addEventListener('click', handleCancelEditor);
  cancelBtn.addEventListener('click', handleCancelEditor);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleCancelEditor();
  });

  const saveAndClose = () => {
    updateNodeData(node.id, 'promptTemplate', textarea.value);
    updateNodeData(node.id, 'systemPrompt', systemTextarea.value);
    log(state.lang === 'en' ? 'Prompt template saved.' : 'プロンプトテンプレートを保存しました。', 'info');
    closeEditor();
  };

  saveBtn.addEventListener('click', () => {
    if (isOptimizing) {
      const isEn = state.lang === 'en';
      showChoiceDialog({
        title: isEn ? 'AI Query In Progress' : 'AI処理を実行中',
        body: isEn 
          ? 'An LLM optimization is currently in progress. What would you like to save?' 
          : 'プロンプトのAI生成処理が現在実行中です。どのように保存しますか？',
        layout: 'stack',
        width: 450,
        buttons: [
          {
            label: `💾 ${isEn ? 'Save Current Text (Abort AI)' : '現在の表示内容を保存 (AI処理を中止)'}`,
            type: 'primary',
            onClick: () => {
              if (activeAbortController) activeAbortController.abort();
              saveAndClose();
            }
          },
          {
            label: `⏳ ${isEn ? 'Wait for AI result & Save' : 'AIの完了を待ってから保存 (エディタを閉じる)'}`,
            type: 'secondary',
            onClick: () => {
              saveOnLlmFinish = true;
              log(isEn 
                ? 'Transitioning AI query to background. Saving once complete...' 
                : 'AI処理をバックグラウンドに移行しました。完了時に自動保存されます...', 'info');
              closeEditor(); // Close modal immediately
            }
          },
          {
            label: isEn ? 'Cancel (Return to Edit)' : 'キャンセルして編集に戻る',
            type: 'secondary',
            onClick: () => {} // Keep editing
          }
        ]
      });
    } else {
      saveAndClose();
    }
  });

  const originalRefineText = refineBtn.innerText;

  // Restore visual buttons state if running in background
  if (runningReq) {
    refineBtn.disabled = true;
    refineBtn.innerText = state.lang === 'en' ? 'Optimizing...' : '最適化中...';
    systemTextarea.disabled = true;
  }

  // Hook state.activeEditor callbacks to reset buttons when background query finishes
  state.activeEditor = {
    nodeId: node.id,
    setOptimizing: (val) => { isOptimizing = val; },
    setAbortController: (ctrl) => { activeAbortController = ctrl; },
    resetButtons: (success = false) => {
      refineBtn.disabled = false;
      refineBtn.innerText = originalRefineText;
      systemTextarea.disabled = false;
    }
  };

  refineBtn.addEventListener('click', async () => {
    if (isOptimizing) return;
    
    isOptimizing = true;
    saveOnLlmFinish = false;
    activeAbortController = new AbortController();
    state.activeLlmRequests = state.activeLlmRequests || {};
    state.activeLlmRequests[node.id] = {
      controller: activeAbortController,
      type: 'refine',
      comment: ''
    };
    
    // Add executing class to node card on canvas to pulse yellow
    const card = document.getElementById(node.id);
    if (card) card.classList.add('executing');
    
    refineBtn.disabled = true;
    refineBtn.innerText = state.lang === 'en' ? 'Optimizing...' : '最適化中...';
    systemTextarea.disabled = true;
    
    let success = false;
    try {
      const systemPrompt = systemTextarea.value;
      const userPrompt = textarea.value;
      
      const optimized = await runLlmQuery(systemPrompt, userPrompt, 0.7, activeAbortController.signal);
      
      // Determine if we should save directly to node (if modal was closed)
      const modalTextarea = document.getElementById('modal-prompt-textarea');
      if (modalTextarea) {
        modalTextarea.value = optimized.trim();
        log(state.lang === 'en' ? 'Prompt optimized inside editor.' : 'エディタ内でプロンプトの最適化を行いました。', 'success');
      } else {
        updateNodeData(node.id, 'promptTemplate', optimized.trim());
        log(state.lang === 'en' 
          ? `Background prompt optimization finished successfully for node: ${node.title}.` 
          : `ノード「${node.title}」のバックグラウンド プロンプト最適化が完了しました。`, 'success');
      }
      
      // Save changes if user requested wait-llm or if editor has closed
      if (saveOnLlmFinish || !modalTextarea) {
        // Update inline card preview
        const cardField = document.getElementById(node.id)?.querySelector('.node-body div div');
        if (cardField) {
          const displayVal = node.data.promptTemplate ? (node.data.promptTemplate.substring(0, 30) + (node.data.promptTemplate.length > 30 ? '...' : '')) : '';
          cardField.innerHTML = displayVal ? displayVal : '<i>Empty Template</i>';
        }
        
        // Update sidebar properties if active
        if (state.selectedNodeId === node.id) {
          showNodeProperties(node.id);
        }
      }
      success = true;
    } catch (e) {
      if (e.name === 'AbortError') {
        log(state.lang === 'en' ? 'Optimization canceled.' : '最適化処理がキャンセルされました。', 'info');
      } else {
        console.error('Refine failed:', e);
        log(`Optimization failed: ${e.message}`, 'error');
        showCorsErrorModal();
      }
    } finally {
      isOptimizing = false;
      
      // Always cleanup request registry and indicator
      if (state.activeLlmRequests) delete state.activeLlmRequests[node.id];
      const card = document.getElementById(node.id);
      if (card) card.classList.remove('executing');
      
      if (state.activeEditor && state.activeEditor.nodeId === node.id) {
        state.activeEditor.setOptimizing(false);
        state.activeEditor.setAbortController(null);
        state.activeEditor.resetButtons(success);
      }
      activeAbortController = null;
    }
  });
}

/**
 * Show a sleek, non-blocking custom confirmation dialog with multiple options.
 * @param {object} options Configuration for the dialog (title, body, borderTheme, buttons, layout, width)
 */
export function showChoiceDialog(options) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '3000'; // High priority on top of everything
  
  let buttonsHtml = '';
  options.buttons.forEach((btn, idx) => {
    const btnClass = btn.type === 'primary' ? 'btn-primary' : 'btn-secondary';
    const widthStyle = options.layout === 'stack' ? 'width: 100%;' : '';
    buttonsHtml += `<button id="choice-btn-${idx}" class="btn ${btnClass} btn-sm" style="${widthStyle}">${btn.label}</button>`;
  });
  
  const footerLayout = options.layout === 'stack' 
    ? 'display: flex; flex-direction: column; gap: 8px;' 
    : 'display: flex; gap: 8px; justify-content: flex-end;';
  
  overlay.innerHTML = `
    <div class="modal-card" style="width: ${options.width || 420}px;">
      <div class="modal-header">
        <span style="font-weight:600; font-size:14px; color: var(--text-color);">${options.title}</span>
      </div>
      <div class="modal-body" style="padding: 20px; font-size: 13px; line-height: 1.5; color: var(--text-muted);">
        ${options.body}
      </div>
      <div class="modal-footer" style="padding: 15px 20px; ${footerLayout}">
        ${buttonsHtml}
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  options.buttons.forEach((btn, idx) => {
    document.getElementById(`choice-btn-${idx}`).addEventListener('click', () => {
      overlay.remove();
      btn.onClick();
    });
  });
}

/**
 * Show a sleek, themed alert dialog using showChoiceDialog to completely replace native alert().
 * @param {string} title Dialog header title
 * @param {string} message Dialog body message
 */
export function showAlert(title, message) {
  const isEn = state.lang === 'en';
  showChoiceDialog({
    title: title,
    body: message,
    layout: 'row',
    width: 400,
    buttons: [
      {
        label: isEn ? 'OK' : 'OK',
        type: 'primary',
        onClick: () => {}
      }
    ]
  });
}

/**
 * Open the CORS warning dialog modal on connection errors
 */
export function showCorsErrorModal() {
  const modal = document.getElementById('error-modal');
  if (modal) {
    modal.classList.remove('collapsed');
  }
}

/**
 * Variables Watcher UI Handler
 */
export function updateVariablesUI() {
  const tbody = document.getElementById('vars-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  const keys = Object.keys(state.variables);
  if (keys.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="2" class="placeholder-text" data-i18n="mem_empty">${TRANSLATIONS[state.lang].mem_empty}</td></tr>`;
    return;
  }
  
  keys.sort().forEach(key => {
    const val = state.variables[key];
    const tr = document.createElement('tr');
    
    const tdKey = document.createElement('td');
    tdKey.innerText = key;
    
    const tdVal = document.createElement('td');
    // Escape and truncate for preview
    const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
    tdVal.innerText = strVal.length > 50 ? strVal.substring(0, 50) + '...' : strVal;
    tdVal.title = strVal; // Full preview on hover
    
    tr.appendChild(tdKey);
    tr.appendChild(tdVal);
    tbody.appendChild(tr);
  });
}

/**
 * Synchronize settings panel UI values with initial state values
 */
export function initSettingsUI() {
  const provider = document.getElementById('settings-provider');
  if (provider) provider.value = state.llmProvider;
  
  const url = document.getElementById('settings-api-url');
  if (url) url.value = state.apiEndpoint || '';
  
  const model = document.getElementById('settings-api-model');
  if (model) model.value = state.apiModel || '';
  
  const key = document.getElementById('settings-api-key');
  if (key) key.value = state.apiKey || '';

  updateLlmProviderUI(state.llmProvider);
}
