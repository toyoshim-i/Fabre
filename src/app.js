// Fabre - Flow-based Agent Builder & Runtime Engine
// Module Entrypoint & Event Coordinator
'use strict';

import { state, NODE_TYPES } from './state.js';
import { checkChromeAi, updateLlmProvider, fetchModels } from './llm.js';
import { connectDirectory } from './file-system.js';
import { initCanvasControls, initGlobalDragAndDrop, createNode, deselectNodes } from './canvas.js';
import { log, applyLanguage, applyTheme, initTabs, initSettingsUI, updateVariablesUI } from './ui.js';

function initEvents() {
  // Sidebar tabs nav
  initTabs();
  
  // Language switcher
  const langSelect = document.getElementById('settings-language');
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      applyLanguage(e.target.value);
      checkChromeAi();
    });
  }

  // Theme switcher
  const themeSelect = document.getElementById('settings-theme');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });
  }

  // LLM Provider select
  const providerSelect = document.getElementById('settings-provider');
  if (providerSelect) {
    providerSelect.addEventListener('change', (e) => {
      updateLlmProvider(e.target.value);
    });
  }
  
  // API config inputs
  ['settings-api-url', 'settings-api-model', 'settings-api-key'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('change', (e) => {
        if (id === 'settings-api-url') {
          state.apiEndpoint = e.target.value;
          localStorage.setItem('fabre_settings_apiEndpoint', e.target.value);
          if (state.apiEndpoint.trim()) {
            fetchModels();
          }
        }
        if (id === 'settings-api-model') {
          state.apiModel = e.target.value;
          localStorage.setItem('fabre_settings_apiModel', e.target.value);
        }
        if (id === 'settings-api-key') {
          state.apiKey = e.target.value;
          localStorage.setItem('fabre_settings_apiKey', e.target.value);
        }
      });
    }
  });

  // Fetch models button wiring
  const fetchModelsBtn = document.getElementById('fetch-models-btn');
  if (fetchModelsBtn) {
    fetchModelsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      fetchModels();
    });
  }

  // Modal actions
  const closeErrorBtn = document.getElementById('close-error-modal-btn');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const errorModal = document.getElementById('error-modal');
  
  const closeModal = () => {
    if (errorModal) errorModal.classList.add('collapsed');
  };
  
  if (closeErrorBtn) closeErrorBtn.addEventListener('click', closeModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  
  const openSettingsBtn = document.getElementById('modal-open-settings-btn');
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      closeModal();
      
      // If Prompt Editor modal is open, autosave draft and close it
      const editorModal = document.getElementById('prompt-editor-modal');
      if (editorModal) {
        const textarea = document.getElementById('modal-prompt-textarea');
        if (textarea && state.selectedNodeId) {
          const node = state.nodes.find(n => n.id === state.selectedNodeId);
          if (node) {
            node.data.promptTemplate = textarea.value;
            // Update node card preview on canvas
            const cardField = document.getElementById(node.id).querySelector('.node-body div div');
            if (cardField) {
              const displayVal = node.data.promptTemplate ? (node.data.promptTemplate.substring(0, 30) + (node.data.promptTemplate.length > 30 ? '...' : '')) : '';
              cardField.innerHTML = displayVal ? displayVal : '<i>Empty Template</i>';
            }
          }
        }
        editorModal.remove();
        log(state.lang === 'en' 
          ? 'Prompt draft autosaved before redirecting to settings.' 
          : '設定画面に移動するため、プロンプトの下書きを自動保存しました。', 'info');
      }
      
      // Select the Config settings tab in the right sidebar
      const settingsTabBtn = document.querySelector('.tab-btn[data-tab="tab-settings"]');
      if (settingsTabBtn) {
        settingsTabBtn.click();
      }
    });
  }
  
  // Properties panel close
  const closePropsBtn = document.getElementById('close-properties-btn');
  if (closePropsBtn) {
    closePropsBtn.addEventListener('click', () => {
      deselectNodes();
    });
  }

  // Palette Click to Create Node
  document.querySelectorAll('.palette-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-node-type');
      
      const viewport = document.getElementById('canvas-viewport');
      const centerX = -state.pan.x + (viewport.clientWidth / 2 - 140) / state.zoom;
      const centerY = -state.pan.y + (viewport.clientHeight / 2 - 80) / state.zoom;
      
      createNode(type, centerX, centerY);
    });
  });

  // Connect Directory Click Handlers (Header and Sidebar button)
  const connectDirBtn = document.getElementById('connect-dir-btn');
  if (connectDirBtn) {
    connectDirBtn.addEventListener('click', connectDirectory);
  }
  
  const connectDirSidebarBtn = document.getElementById('connect-dir-sidebar-btn');
  if (connectDirSidebarBtn) {
    connectDirSidebarBtn.addEventListener('click', connectDirectory);
  }
}

// DomContentLoaded Initialization entrypoint
document.addEventListener('DOMContentLoaded', () => {
  // Load settings from localStorage
  const savedLang = localStorage.getItem('fabre_settings_lang');
  const savedTheme = localStorage.getItem('fabre_settings_theme');
  const savedLlmProvider = localStorage.getItem('fabre_settings_llmProvider');
  const savedApiEndpoint = localStorage.getItem('fabre_settings_apiEndpoint');
  const savedApiModel = localStorage.getItem('fabre_settings_apiModel');
  const savedApiKey = localStorage.getItem('fabre_settings_apiKey');
  
  if (savedLang) state.lang = savedLang;
  if (savedTheme) state.theme = savedTheme;
  if (savedLlmProvider) state.llmProvider = savedLlmProvider;
  if (savedApiEndpoint) state.apiEndpoint = savedApiEndpoint;
  if (savedApiModel) state.apiModel = savedApiModel;
  if (savedApiKey) state.apiKey = savedApiKey;

  // Set default theme and language
  applyTheme(state.theme);
  applyLanguage(state.lang);
  initSettingsUI();
  
  log('Initializing Fabre v0.1.0 workspace...', 'info');
  initCanvasControls();
  initGlobalDragAndDrop();
  initEvents();
  checkChromeAi();
  
  // Auto-fetch models on startup if using external API mode
  if (state.llmProvider === 'openai-compatible' && state.apiEndpoint) {
    fetchModels();
  }
  
  // Spawn basic Start & Output nodes as template placeholders
  createNode(NODE_TYPES.START, 100, 200);
  createNode(NODE_TYPES.OUTPUT, 600, 200);
  deselectNodes();
  
  // Initialize Variables Watching UI
  updateVariablesUI();
  
  log('Workspace initialized. Ready to build agents.', 'success');
});
