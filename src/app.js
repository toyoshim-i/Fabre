/**
 * Fabre - Flow-based Agent Builder & Runtime Engine
 * Core Application Script - Phase 1 Complete (with Themes & i18n)
 */

'use strict';

// ==========================================================================
// 1. Global Application State
// ==========================================================================
const state = {
  // Localization & Themes [NEW]
  lang: 'ja', // 'en' | 'ja'
  theme: 'theme-cyber-dark', // 'theme-cyber-dark' | 'theme-matrix-green' | 'theme-light-slate'

  // Graph Data
  nodes: [],
  links: [],
  
  // Viewport / Canvas Panning & Zooming
  zoom: 1,
  pan: { x: 0, y: 0 },
  isPanning: false,
  panStart: { x: 0, y: 0 },
  
  // Selection & Connection State
  selectedNodeId: null,
  activeDraggingNodeId: null,
  activeLinkDrag: null, // { fromNodeId, fromPortId, type, startX, startY }
  
  // Runtime Interpreter State
  runnerState: 'idle', // 'idle' | 'running' | 'paused' | 'error' | 'success'
  currentNodeId: null,
  executionDelay: 500, // ms
  variables: {},
  logs: [],
  totalSteps: 0,
  
  // Local File Access
  directoryHandle: null,
  filesList: [], // Flat list of file entries
  activeFileText: '',
  
  // LLM Config
  llmProvider: 'chrome-ai', // 'chrome-ai' | 'openai-compatible'
  apiEndpoint: 'http://localhost:11434/v1',
  apiModel: 'qwen2.5-coder:7b',
  apiKey: '',
  chromeAiAvailable: false,
  chromeAiCapabilities: null
};

// ==========================================================================
// 2. Localization Dictionary (i18n) [NEW]
// ==========================================================================
const TRANSLATIONS = {
  en: {
    status_llm_not_configured: 'LLM: Not Configured',
    status_folder_disconnected: 'Local Folder: Disconnected',
    btn_connect_dir: 'Connect Directory',
    palette_title: 'Palette',
    palette_subtitle: 'Drag or Click to Add',
    node_start: 'Start Node',
    node_prompt: 'Prompt Builder',
    node_llm: 'LLM Call',
    node_extractor: 'Extractor',
    node_condition: 'Condition',
    node_setvar: 'Set Variable',
    node_tool: 'Tool Exec',
    node_output: 'Output Node',
    dir_title: 'Target Directory',
    dir_placeholder: 'Connect a directory to browse files',
    tab_runner: 'Runner',
    tab_memory: 'Memory',
    tab_logs: 'Logs',
    tab_config: 'Config',
    runner_control_title: 'Execution Control',
    btn_run: 'Run',
    btn_step: 'Step',
    btn_pause: 'Pause',
    btn_reset: 'Reset',
    label_delay: 'Step Delay',
    runner_status: 'Status:',
    runner_current_node: 'Current Node:',
    runner_steps: 'Steps Run:',
    status_idle: 'IDLE',
    status_running: 'RUNNING',
    status_paused: 'PAUSED',
    status_success: 'SUCCESS',
    status_error: 'ERROR',
    preset_title: 'Load Presets',
    preset_loop_title: 'Self-Debugging Agent Loop',
    preset_loop_desc: 'Analyzes local code, runs compiler tests, and loops back to auto-correct bug until tests pass.',
    preset_chat_title: 'Simple Chat with Memory',
    preset_chat_desc: 'Conversational chatbot that accumulates memory using variables and prompt nodes.',
    props_title: 'Node Properties',
    props_placeholder: 'Select a node to inspect properties',
    mem_title: 'Variables Memory',
    btn_clear: 'Clear',
    th_variable: 'Variable',
    th_value: 'Value',
    mem_empty: 'No variables set yet',
    logs_title: 'Logs & LLM History',
    logs_empty: 'Logs will appear here during execution...',
    config_title: 'Global Config',
    config_lang: 'Language',
    config_theme: 'Color Theme',
    config_llm_title: 'LLM Configuration',
    config_provider: 'LLM Provider',
    chrome_ai_title: 'Chrome Built-in AI',
    config_endpoint: 'API Endpoint URL',
    config_endpoint_helper: 'For local Ollama, LM Studio, etc.',
    config_model: 'Model Name',
    config_apikey: 'API Key (Optional)',
    config_guide_title: 'Guide & Troubleshooting',
    config_cors_title: 'Local CORS Error',
    config_cors_desc: 'If connection fails to local API (Ollama, etc.), ensure CORS is enabled (e.g. OLLAMA_ORIGINS="*" ollama serve).',
    modal_error_title: 'Connection Error Detected',
    modal_error_desc: 'Failed to connect to the external LLM API. This is likely due to CORS restrictions or the server not running.',
    modal_ollama_mac: 'Ollama CORS Command (macOS / Linux):',
    modal_ollama_win: 'Windows (CMD):',
    modal_error_footer: 'Restart your local server with the environment variables above and retry.',
    btn_open_settings: 'Open Settings',
    btn_close: 'Close',
    clear_canvas: 'Clear Canvas'
  },
  ja: {
    status_llm_not_configured: 'LLM: 未設定',
    status_folder_disconnected: 'ローカルフォルダ: 未接続',
    btn_connect_dir: 'ディレクトリ接続',
    palette_title: 'パレット',
    palette_subtitle: 'ドラッグまたはクリックで追加',
    node_start: '開始ノード',
    node_prompt: 'プロンプト作成',
    node_llm: 'LLM呼び出し',
    node_extractor: '抽出ノード',
    node_condition: '条件分岐',
    node_setvar: '変数代入',
    node_tool: 'ツール実行',
    node_output: '出力ノード',
    dir_title: 'ターゲットフォルダ',
    dir_placeholder: 'ディレクトリを選択するとファイルが表示されます',
    tab_runner: '実行制御',
    tab_memory: '変数メモリ',
    tab_logs: '実行ログ',
    tab_config: '環境設定',
    runner_control_title: '実行制御・デバッガ',
    btn_run: '実行',
    btn_step: 'ステップ',
    btn_pause: '一時停止',
    btn_reset: 'リセット',
    label_delay: 'ステップ遅延',
    runner_status: '状態:',
    runner_current_node: '実行中ノード:',
    runner_steps: '実行ステップ数:',
    status_idle: '待機中',
    status_running: '実行中',
    status_paused: '一時停止中',
    status_success: '正常終了',
    status_error: '異常停止',
    preset_title: 'テンプレート読込',
    preset_loop_title: '自己修正型コーディングループ',
    preset_loop_desc: 'ローカルコードを検証し、テスト結果をフィードバックしてバグを自己修正するループフロー。',
    preset_chat_title: '履歴保持チャットボット',
    preset_chat_desc: '入力プロンプトと変数格納を組み合わせて会話履歴を保持するチャットボット。',
    props_title: 'ノード詳細設定',
    props_placeholder: 'ノードを選択するとプロパティが表示されます',
    mem_title: '変数メモリ一覧',
    btn_clear: 'クリア',
    th_variable: '変数名',
    th_value: '値',
    mem_empty: '変数はまだ設定されていません',
    logs_title: 'ログ・通信履歴',
    logs_empty: '実行を開始するとログが表示されます...',
    config_title: '一般設定',
    config_lang: '表示言語',
    config_theme: 'カラーテーマ',
    config_llm_title: 'LLM通信設定',
    config_provider: 'LLMプロバイダ',
    chrome_ai_title: 'Chrome組み込みAI',
    config_endpoint: 'APIエンドポイントURL',
    config_endpoint_helper: 'ローカルの Ollama や LM Studio など',
    config_model: '使用モデル名',
    config_apikey: 'APIキー（任意）',
    config_guide_title: 'ヘルプとトラブルシューティング',
    config_cors_title: 'ローカルAPIのCORSエラー',
    config_cors_desc: 'Ollama などのローカルAPI呼び出しで接続エラーが発生する場合、CORS設定（例: OLLAMA_ORIGINS="*" ollama serve）を確認してください。',
    modal_error_title: '接続エラーを検出しました',
    modal_error_desc: '外部LLM APIへの接続に失敗しました。CORS制限、またはサーバーが起動していないことが原因と考えられます。',
    modal_ollama_mac: 'Ollama CORS起動方法 (macOS / Linux):',
    modal_ollama_win: 'Windows (コマンドプロンプト):',
    modal_error_footer: '環境変数を設定してローカルサーバーを再起動し、もう一度実行してください。',
    btn_open_settings: '設定を開く',
    btn_close: '閉じる',
    clear_canvas: 'キャンバスを初期化'
  }
};

// ==========================================================================
// 3. UI Helper Modules (Logs, Badges, Tabs, Themes, Languages)
// ==========================================================================

/**
 * Apply the selected language translations to the UI
 * @param {string} langCode 'en' | 'ja'
 */
function applyLanguage(langCode) {
  state.lang = langCode;
  const t = TRANSLATIONS[langCode];
  if (!t) return;
  
  // Update elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      // If element has a child (like inline SVGs or badge dots), only update the text node
      if (el.children.length > 0) {
        // Find text node child or create one
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

  // Update elements with data-i18n-title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (t[key]) el.setAttribute('title', t[key]);
  });
  
  // Set dropdown value
  const select = document.getElementById('settings-language');
  if (select) select.value = langCode;
  
  log(langCode === 'en' ? 'Language switched to English.' : '言語が日本語に切り替わりました。', 'info');
}

/**
 * Apply the selected color theme class to body
 * @param {string} themeName Class name of the theme
 */
function applyTheme(themeName) {
  state.theme = themeName;
  
  // Remove all themes
  document.body.classList.remove('theme-cyber-dark', 'theme-matrix-green', 'theme-light-slate');
  
  // Add selected
  document.body.classList.add(themeName);
  
  // Set dropdown value
  const select = document.getElementById('settings-theme');
  if (select) select.value = themeName;
  
  log(state.lang === 'en' ? `Color theme switched to ${themeName}.` : `カラーテーマを ${themeName} に切り替えました。`, 'info');
}

/**
 * Append message to the console logger in the UI
 * @param {string} text Message text
 * @param {string} type 'info' | 'success' | 'warning' | 'error'
 * @param {object} details Optional details object for inspector
 */
function log(text, type = 'info', details = null) {
  const timestamp = new Date().toLocaleTimeString();
  const entry = { timestamp, text, type, details };
  state.logs.push(entry);
  
  const container = document.getElementById('logs-container');
  if (!container) return;
  
  // Clear placeholder text if first log
  if (state.logs.length === 1) {
    container.innerHTML = '';
  }
  
  const entryEl = document.createElement('div');
  entryEl.className = `log-entry ${type}`;
  
  const metaEl = document.createElement('div');
  metaEl.className = 'log-meta';
  metaEl.innerHTML = `<span>[${type.toUpperCase()}]</span><span>${timestamp}</span>`;
  
  const textEl = document.createElement('div');
  textEl.className = 'log-text';
  textEl.innerText = text;
  
  entryEl.appendChild(metaEl);
  entryEl.appendChild(textEl);
  
  if (details) {
    const detailsEl = document.createElement('pre');
    detailsEl.className = 'log-details-block';
    detailsEl.innerText = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
    entryEl.appendChild(detailsEl);
  }
  
  container.appendChild(entryEl);
  container.scrollTop = container.scrollHeight;
}

/**
 * Initialize Sidebar Navigation Tabs
 */
function initTabs() {
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
 * Detect browser local Chrome Built-in AI capability
 */
async function checkChromeAi() {
  const badge = document.getElementById('provider-badge-text');
  const badgeContainer = document.getElementById('provider-badge');
  const desc = document.getElementById('chrome-ai-desc');
  const statusBlock = document.getElementById('chrome-ai-status-block');
  
  if (!desc || !badge || !statusBlock || !badgeContainer) return;
  
  const isAvailable = typeof window.ai !== 'undefined' && typeof window.ai.languageModel !== 'undefined';
  
  if (isAvailable) {
    try {
      const capabilities = await window.ai.languageModel.capabilities();
      state.chromeAiAvailable = capabilities.available !== 'no';
      state.chromeAiCapabilities = capabilities;
      
      if (state.chromeAiAvailable) {
        desc.innerText = state.lang === 'en'
          ? `Gemini Nano detected and ready (Capability: ${capabilities.available}).`
          : `Gemini Nano が検出され、利用可能です (ステータス: ${capabilities.available})。`;
        statusBlock.className = 'info-block success';
        badgeContainer.className = 'status-badge success';
        badge.innerText = 'LLM: Chrome AI';
        badge.removeAttribute('data-i18n'); // Remove localization key to prevent overwrite
        log(state.lang === 'en' ? 'Chrome Built-in AI (Gemini Nano) detected successfully.' : 'Chrome 組み込み AI (Gemini Nano) を検出しました。', 'success');
        updateLlmProvider('chrome-ai');
      } else {
        desc.innerText = state.lang === 'en'
          ? 'Gemini Nano API exists, but the model is not currently downloaded or available.'
          : 'Gemini Nano API は存在しますが、モデルがダウンロードされていないか、現在利用できません。';
        statusBlock.className = 'info-block warning';
        badgeContainer.className = 'status-badge warning';
        badge.innerText = 'LLM: Unavailable';
        badge.removeAttribute('data-i18n');
        log('Chrome AI API exists, but model is unavailable.', 'warning');
        updateLlmProvider('openai-compatible');
      }
    } catch (e) {
      desc.innerText = `Error: ${e.message}`;
      statusBlock.className = 'info-block warning';
      log(`Error checking Chrome AI capabilities: ${e.message}`, 'error');
      updateLlmProvider('openai-compatible');
    }
  } else {
    state.chromeAiAvailable = false;
    desc.innerText = state.lang === 'en'
      ? 'Chrome Built-in AI (window.ai) is not supported in this browser. Please use Chrome Dev/Canary with flags enabled or select an external API.'
      : 'Chrome 組み込み AI (window.ai) はこのブラウザでサポートされていません。Chrome Dev/Canary でフラグを有効にするか、外部APIを指定してください。';
    statusBlock.className = 'info-block warning';
    badgeContainer.className = 'status-badge warning';
    badge.setAttribute('data-i18n', 'status_llm_not_configured');
    applyLanguage(state.lang); // Apply localized text
    log('Chrome Built-in AI is not supported. Defaulting to External API.', 'warning');
    updateLlmProvider('openai-compatible');
  }
}

/**
 * Change active LLM provider selection
 * @param {string} provider 'chrome-ai' | 'openai-compatible'
 */
function updateLlmProvider(provider) {
  state.llmProvider = provider;
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

// ==========================================================================
// 4. Initialization & Event Wiring
// ==========================================================================
function initEvents() {
  // Language Change Listener [NEW]
  const langSelect = document.getElementById('settings-language');
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      applyLanguage(e.target.value);
      checkChromeAi(); // Re-run AI check to update localized descriptions
    });
  }

  // Theme Change Listener [NEW]
  const themeSelect = document.getElementById('settings-theme');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });
  }

  // LLM Provider select change
  const providerSelect = document.getElementById('settings-provider');
  if (providerSelect) {
    providerSelect.addEventListener('change', (e) => {
      updateLlmProvider(e.target.value);
    });
  }
  
  // API settings inputs change
  ['settings-api-url', 'settings-api-model', 'settings-api-key'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('change', (e) => {
        if (id === 'settings-api-url') state.apiEndpoint = e.target.value;
        if (id === 'settings-api-model') state.apiModel = e.target.value;
        if (id === 'settings-api-key') state.apiKey = e.target.value;
      });
    }
  });

  // Modal closers
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
      const settingsTabBtn = document.querySelector('.tab-btn[data-tab="tab-settings"]');
      if (settingsTabBtn) settingsTabBtn.click();
    });
  }
}

// DomContentLoaded Setup
document.addEventListener('DOMContentLoaded', () => {
  // Set default theme and language
  applyTheme(state.theme);
  applyLanguage(state.lang);
  
  log('Initializing Fabre v0.1.0 workspace...', 'info');
  initTabs();
  initEvents();
  checkChromeAi();
  log('Workspace initialized. Ready to build agents.', 'success');
});
