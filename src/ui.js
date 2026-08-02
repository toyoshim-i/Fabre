// Themed Custom Dialog Modals, Prompt Overlay Editor, Inspector Panels, and Language/Theme Switching
'use strict';

import { 
  state, 
  TRANSLATIONS, 
  getDefaultSystemPrompt, 
  NODE_TYPES,
  NODE_ICONS,
  NODE_COLORS,
  setLanguage,
  setTheme,
  setLlmProvider,
  addNode,
  addLink,
  clearCanvasState,
  resetRunner,
  setVariable,
  initRecentFiles,
  addRecentFile,
  removeRecentFile,
  clearChatMessages,
  updateNodeTitle,
  updateNodeData,
  setSelectedNode,
  addLog,
  setExecutionDelay
} from './state.js';
import { runLlmQuery } from './llm.js';
import { runWorkflow, stepWorkflow, pauseWorkflow, resetWorkflow, runChatTurn } from './runtime.js';
import { drawConnections } from './canvas.js';
import { t, updateDomTranslations } from './i18n.js';
import { registerMcpServer, removeMcpServer } from './mcp.js';

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
 * Initialize Sidebar Mouse Drag Resizer
 */
export function initSidebarResizer() {
  const resizer = document.getElementById('sidebar-resizer');
  const sidebar = document.getElementById('inspector-sidebar');
  if (!resizer || !sidebar) return;

  // Restore saved width from localStorage
  const savedWidth = localStorage.getItem('fabre_sidebar_width');
  if (savedWidth) {
    const parsedWidth = parseInt(savedWidth, 10);
    if (!isNaN(parsedWidth) && parsedWidth >= 220 && parsedWidth <= 800) {
      sidebar.style.width = `${parsedWidth}px`;
    }
  }

  let startX = 0;
  let startWidth = 0;
  let isResizing = false;

  const onMouseMove = (e) => {
    if (!isResizing) return;
    const dx = startX - e.clientX;
    const maxAllowedWidth = Math.min(800, window.innerWidth - 300);
    const newWidth = Math.min(Math.max(startWidth + dx, 220), maxAllowedWidth);
    sidebar.style.width = `${newWidth}px`;
    localStorage.setItem('fabre_sidebar_width', newWidth);
    
    // Dynamically update SVG links as sidebar width resizes
    drawConnections();
  };

  const onMouseUp = () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('dragging');
      document.body.classList.remove('dragging-resizer');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      drawConnections();
    }
  };

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    resizer.classList.add('dragging');
    document.body.classList.add('dragging-resizer');
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
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

  // 10. Recent Files changes
  state.on('recentFilesChanged', (recentFiles) => {
    renderRecentFilesUI(recentFiles);
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

export function renderRecentFilesUI(recentFiles) {
  const listEl = document.getElementById('recent-files-list');
  if (!listEl) return;

  if (!recentFiles || recentFiles.length === 0) {
    listEl.innerHTML = `<p style="font-size: 11px; color: var(--text-muted); padding: 8px 0;">${t('no_recent_projects')}</p>`;
    return;
  }

  listEl.innerHTML = '';
  recentFiles.forEach(file => {
    const card = document.createElement('div');
    card.className = 'recent-file-card';
    const dateFormatted = new Date(file.updatedAt).toLocaleDateString(state.lang === 'ja' ? 'ja-JP' : 'en-US');
    card.innerHTML = `
      <div class="recent-file-card-header">
        <div class="recent-file-card-title">${file.title}</div>
        <button class="recent-file-remove-btn" title="${t('btn_remove_recent')}">&times;</button>
      </div>
      <div class="recent-file-card-desc">${file.description || ''}</div>
      <div class="recent-file-card-footer">
        <span>.fabre</span>
        <span>${dateFormatted}</span>
      </div>
    `;

    card.addEventListener('click', async (e) => {
      if (e.target.classList.contains('recent-file-remove-btn')) {
        e.stopPropagation();
        removeRecentFile(file.id);
        return;
      }

      let workflowData = file.data;
      if (file.filePath) {
        try {
          const res = await fetch(file.filePath);
          if (res.ok) {
            workflowData = await res.json();
            file.data = workflowData;
            file.updatedAt = new Date().toISOString();
            addRecentFile(file); // Refresh cached contents
          }
        } catch (err) {
          console.warn(`Failed to fetch fresh workflow from ${file.filePath}:`, err);
        }
      }

      if (workflowData) {
        loadWorkflowData(workflowData, file.title);
      }
    });

    listEl.appendChild(card);
  });
}

export function renderMcpServersUI(mcpServers = state.mcpServers) {
  const container = document.getElementById('mcp-servers-list');
  if (!container) return;

  if (!mcpServers || mcpServers.length === 0) {
    container.innerHTML = `<p class="placeholder-text" style="font-size:10px;">${state.lang === 'en' ? 'No MCP servers registered yet.' : '登録済みの MCP サーバーはありません。'}</p>`;
    return;
  }

  let html = '';
  mcpServers.forEach(server => {
    const isSuccess = server.status === 'connected';
    const isError = server.status === 'error';
    const badgeColor = isSuccess ? 'var(--color-success)' : (isError ? 'var(--color-error)' : 'var(--primary)');
    const toolCount = (server.tools || []).length;

    html += `
      <div class="mcp-server-card" style="padding:8px; border-radius:6px; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:11px; font-weight:600; color:var(--text-main); display:flex; align-items:center; gap:6px;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${badgeColor};"></span>
            <span>${server.name}</span>
          </div>
          <div style="font-size:9px; color:var(--text-muted); margin-top:2px;">${server.url}</div>
          <div style="font-size:9px; color:${badgeColor}; margin-top:2px;">${server.status.toUpperCase()} (${toolCount} tools)</div>
        </div>
        <button class="btn btn-secondary btn-xs remove-mcp-btn" data-mcp-id="${server.id}" style="font-size:10px; padding:2px 6px;">&times;</button>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.remove-mcp-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-mcp-id');
      if (id) removeMcpServer(id);
    });
  });
}

export function loadWorkflowData(data, title = '') {
  clearCanvasState();
  resetRunner();

  (data.nodes || []).forEach(n => addNode(n));
  (data.links || []).forEach(l => addLink(l));
  if (data.variables) {
    Object.entries(data.variables).forEach(([k, v]) => setVariable(k, v));
  }

  addLog(t('loaded_workflow', { title: title || 'Project' }), 'success');
}

export function openSaveProjectModal() {
  const modal = document.getElementById('save-meta-modal');
  const titleInput = document.getElementById('save-meta-title');
  const descInput = document.getElementById('save-meta-desc');
  const authorInput = document.getElementById('save-meta-author');

  if (modal) {
    modal.style.display = 'flex';
    if (titleInput) titleInput.value = `My Workflow Agent`;
    if (descInput) descInput.value = '';
    if (authorInput) authorInput.value = 'User';
  }
}

export function exportProjectWithMeta(meta) {
  const projectData = {
    format: 'fabre-workflow',
    version: '0.1.0',
    meta: {
      title: meta.title || 'My Workflow Agent',
      description: meta.description || '',
      author: meta.author || 'User',
      createdAt: meta.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    nodes: state.nodes,
    links: state.links,
    variables: state.variables
  };

  const jsonStr = JSON.stringify(projectData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = (meta.title || 'workflow').toLowerCase().replace(/[^a-z0-9]/g, '_');
  a.download = `${fileName}.fabre`;
  a.click();
  URL.revokeObjectURL(url);

  addRecentFile({
    id: `file_${Date.now()}`,
    title: meta.title || 'My Workflow Agent',
    description: meta.description || '',
    updatedAt: new Date().toISOString(),
    data: projectData
  });

  addLog(t('exported_fabre'), 'success');
}

export function importProject(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.nodes || !data.links) {
        throw new Error('Invalid Fabre workflow file format.');
      }
      loadWorkflowData(data, data.meta?.title || file.name);

      // Add to recent files history
      addRecentFile({
        id: `file_${Date.now()}`,
        title: data.meta?.title || file.name.replace(/\.(fabre|json)$/i, ''),
        description: data.meta?.description || 'Custom loaded workflow',
        updatedAt: new Date().toISOString(),
        data: data
      });

    } catch (err) {
      addLog(t('failed_load_file', { error: err.message }), 'error');
    }
  };
  reader.readAsText(file);
}

export function initProjectFileControls() {
  const exportBtn = document.getElementById('export-project-btn');
  if (exportBtn) exportBtn.addEventListener('click', openSaveProjectModal);

  const saveConfirmBtn = document.getElementById('save-meta-confirm-btn');
  const saveCancelBtn = document.getElementById('save-meta-cancel-btn');
  const saveCloseX = document.getElementById('save-meta-close-x');
  const saveModal = document.getElementById('save-meta-modal');

  const closeSaveModal = () => {
    if (saveModal) saveModal.style.display = 'none';
  };

  if (saveCloseX) saveCloseX.addEventListener('click', closeSaveModal);
  if (saveCancelBtn) saveCancelBtn.addEventListener('click', closeSaveModal);

  if (saveConfirmBtn) {
    saveConfirmBtn.addEventListener('click', () => {
      const title = document.getElementById('save-meta-title')?.value.trim();
      const description = document.getElementById('save-meta-desc')?.value.trim();
      const author = document.getElementById('save-meta-author')?.value.trim();
      
      exportProjectWithMeta({ title, description, author });
      closeSaveModal();
    });
  }

  const importBtn = document.getElementById('import-project-btn');
  const importInput = document.getElementById('import-project-input');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importProject(e.target.files[0]);
        importInput.value = '';
      }
    });
  }

  const clearRecentBtn = document.getElementById('clear-recent-btn');
  if (clearRecentBtn) {
    clearRecentBtn.addEventListener('click', () => {
      state.recentFiles = [];
      try { localStorage.removeItem('fabre_recent_files'); } catch (e) {}
      state.emit('recentFilesChanged', state.recentFiles);
      addLog(t('log_cleared_recent'), 'info');
    });
  }
}

/**
 * Update Language DOM representation
 */
function updateLanguageUI(langCode) {
  updateDomTranslations();
  
  const select = document.getElementById('settings-language');
  if (select) select.value = langCode;
  
  log(langCode === 'en' ? 'Language switched to English.' : '言語が日本語に切り替わりました。', 'info');
  
  // Re-render properties panel and recent files to apply language changes
  if (state.selectedNodeId) {
    showNodeProperties(state.selectedNodeId);
  }
  renderRecentFilesUI(state.recentFiles);
  document.querySelectorAll('.node-card').forEach(card => applyLanguageToNodeCard(card));
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

let currentConsoleFilter = 'all';

export function setupConsoleLogFilter() {
  const filterSelect = document.getElementById('console-log-filter');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      currentConsoleFilter = e.target.value;
      reRenderAllLogs();
    });
  }
}

function reRenderAllLogs() {
  const container = document.getElementById('logs-container');
  if (!container) return;
  container.innerHTML = '';
  const filtered = (state.logs || []).filter(e => currentConsoleFilter === 'all' || e.type === currentConsoleFilter);
  if (filtered.length === 0) {
    container.innerHTML = `<span class="placeholder-text" data-i18n="logs_empty">${t('logs_empty')}</span>`;
    return;
  }
  filtered.forEach(entry => renderLogEntry(entry, true));
}

/**
 * Render log entry DOM element in log console panel
 */
function renderLogEntry(entry, isBulk = false) {
  const { timestamp, text, type, details } = entry;
  const container = document.getElementById('logs-container');
  if (!container) return;
  
  if (!isBulk && currentConsoleFilter !== 'all' && type !== currentConsoleFilter) {
    return;
  }

  if (!isBulk && state.logs.length === 1) {
    container.innerHTML = '';
  }
  
  const entryEl = document.createElement('div');
  entryEl.className = `log-entry ${type}`;
  
  const metaEl = document.createElement('div');
  metaEl.className = 'log-meta';
  const badgeLabel = type === 'http' ? 'HTTP/API' : type.toUpperCase();
  metaEl.innerHTML = `<span class="log-badge ${type}">[${badgeLabel}]</span><span>${timestamp}</span>`;
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
      <label>${t.prop_node_id || 'Node ID'}</label>
      <input type="text" class="node-input-text" value="${node.id}" readonly style="opacity: 0.6; font-family: var(--font-mono); font-size:10px;">
    </div>
    <div class="form-group">
      <label>${t.prop_node_type || (state.lang === 'en' ? 'Node Type' : 'ノードタイプ')}</label>
      <div style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); border-radius: 6px; font-size: 11px;">
        <span style="font-size: 14px;">${NODE_ICONS[node.type] || '⚙'}</span>
        <span style="font-weight: 600; color: ${NODE_COLORS[node.type] || 'var(--primary)'};">${node.type.toUpperCase()}</span>
        <span style="color: var(--text-muted); font-size: 10px; margin-left: auto;">(${node.type})</span>
      </div>
    </div>
    <div class="form-group">
      <label>${t.prop_node_title || 'Node Title'}</label>
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
      <div class="form-group" style="flex-direction:row; justify-content:space-between; align-items:center; margin-top:8px;">
        <label for="prop-llm-require-tools">${state.lang === 'en' ? 'Require Tool Call (Retry on Text)' : 'ツール呼び出しを強制（平文時に再試行）'}</label>
        <input type="checkbox" id="prop-llm-require-tools" ${node.data.requireToolCall ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;">
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
    let toolOptions = `
      <option value="mock_test" ${node.data.toolType === 'mock_test' ? 'selected' : ''}>Mock Code Compiler/Tester</option>
      <option value="list_files" ${node.data.toolType === 'list_files' ? 'selected' : ''}>Local FS: List Files</option>
      <option value="read_file" ${node.data.toolType === 'read_file' ? 'selected' : ''}>Local FS: Read File</option>
      <option value="write_file" ${node.data.toolType === 'write_file' ? 'selected' : ''}>Local FS: Write File</option>
      <option value="js_sandbox" ${node.data.toolType === 'js_sandbox' ? 'selected' : ''}>Real Custom JS Sandbox</option>
    `;
    if (state.mcpTools && state.mcpTools.length > 0) {
      toolOptions += `<optgroup label="MCP Tools (Model Context Protocol)">`;
      state.mcpTools.forEach(tool => {
        toolOptions += `<option value="${tool.fullId}" ${node.data.toolType === tool.fullId ? 'selected' : ''}>${tool.serverName}: ${tool.name}</option>`;
      });
      toolOptions += `</optgroup>`;
    }
    html += `
      <div class="form-group">
        <label>${t.prop_tool_type}</label>
        <select id="prop-tool-type">
          ${toolOptions}
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

  const requireToolsCheck = document.getElementById('prop-llm-require-tools');
  if (requireToolsCheck) {
    requireToolsCheck.addEventListener('change', (e) => {
      updateNodeData(node.id, 'requireToolCall', e.target.checked);
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
  const langSelect = document.getElementById('settings-language');
  if (langSelect) {
    langSelect.value = state.lang;
    langSelect.addEventListener('change', (e) => setLanguage(e.target.value));
  }

  const themeSelect = document.getElementById('settings-theme');
  if (themeSelect) {
    themeSelect.value = state.theme;
    themeSelect.addEventListener('change', (e) => setTheme(e.target.value));
  }

  const provider = document.getElementById('settings-provider');
  if (provider) {
    provider.value = state.llmProvider;
    provider.addEventListener('change', (e) => setLlmProvider(e.target.value));
  }
  
  const url = document.getElementById('settings-api-url');
  if (url) {
    url.value = state.apiEndpoint || '';
    url.addEventListener('input', (e) => setApiEndpoint(e.target.value));
  }
  
  const model = document.getElementById('settings-api-model');
  if (model) {
    model.value = state.apiModel || '';
    model.addEventListener('input', (e) => setApiModel(e.target.value));
  }
  
  const key = document.getElementById('settings-api-key');
  if (key) {
    key.value = state.apiKey || '';
    key.addEventListener('input', (e) => setApiKey(e.target.value));
  }

  const addMcpBtn = document.getElementById('add-mcp-server-btn');
  if (addMcpBtn) {
    addMcpBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('mcp-server-name');
      const urlInput = document.getElementById('mcp-server-url');
      const name = nameInput ? nameInput.value : '';
      const serverUrl = urlInput ? urlInput.value : '';
      if (serverUrl) {
        registerMcpServer(serverUrl, name);
        if (nameInput) nameInput.value = '';
        if (urlInput) urlInput.value = '';
      }
    });
  }

  state.on('mcpServersChanged', (servers) => renderMcpServersUI(servers));
  state.on('mcpToolsChanged', () => {
    if (state.selectedNodeId) {
      showNodeProperties(state.selectedNodeId);
    }
  });

  renderMcpServersUI();
  updateLlmProviderUI(state.llmProvider);
  setupConsoleLogFilter();
}
