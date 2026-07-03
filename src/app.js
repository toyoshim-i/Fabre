/**
 * Fabre - Flow-based Agent Builder & Runtime Engine
 * Core Application Script - Phase 2 Complete (Canvas, Drag-Drop, Connections)
 */

'use strict';

// ==========================================================================
// 1. Global Application State
// ==========================================================================
const state = {
  // Localization & Themes
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
  dragOffset: { x: 0, y: 0 },
  activeLinkDrag: null, // { fromNodeId, fromPortId, type, startX, startY, isInput }
  activeResizingNodeId: null,
  resizeStartSize: { width: 0, height: 0 },
  resizeStartMouse: { x: 0, y: 0 },
  
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
// 2. Constants & Node Metadata Definitions
// ==========================================================================
const NODE_TYPES = {
  START: 'start',
  PROMPT: 'prompt',
  LLM: 'llm',
  EXTRACTOR: 'extractor',
  CONDITION: 'condition',
  SET_VAR: 'set_var',
  TOOL: 'tool',
  OUTPUT: 'output'
};

const NODE_COLORS = {
  start: 'var(--color-start)',
  prompt: 'var(--color-prompt)',
  llm: 'var(--color-llm)',
  extractor: 'var(--color-extractor)',
  condition: 'var(--color-condition)',
  set_var: 'var(--color-setvar)',
  tool: 'var(--color-tool)',
  output: 'var(--color-output)'
};

const NODE_ICONS = {
  start: '▶',
  prompt: '✎',
  llm: '🤖',
  extractor: '⚲',
  condition: '⇅',
  set_var: '⛃',
  tool: '🛠',
  output: '■'
};

const PORT_TEMPLATES = {
  start: {
    inputs: [],
    outputs: [
      { id: 'flow-out', name: 'Start', type: 'flow' },
      { id: 'data-out', name: 'Input', type: 'data' }
    ]
  },
  prompt: {
    inputs: [
      { id: 'flow-in', name: 'Exec', type: 'flow' },
      { id: 'data-in', name: 'Vars', type: 'data' }
    ],
    outputs: [
      { id: 'flow-out', name: 'Next', type: 'flow' },
      { id: 'prompt-out', name: 'Prompt', type: 'data' }
    ]
  },
  llm: {
    inputs: [
      { id: 'flow-in', name: 'Exec', type: 'flow' },
      { id: 'prompt-in', name: 'Prompt', type: 'data' }
    ],
    outputs: [
      { id: 'flow-success', name: 'Success', type: 'flow' },
      { id: 'flow-error', name: 'Error', type: 'flow' },
      { id: 'response-out', name: 'Response', type: 'data' }
    ]
  },
  extractor: {
    inputs: [
      { id: 'flow-in', name: 'Exec', type: 'flow' },
      { id: 'text-in', name: 'Text', type: 'data' }
    ],
    outputs: [
      { id: 'flow-out', name: 'Next', type: 'flow' },
      { id: 'value-out', name: 'Value', type: 'data' }
    ]
  },
  condition: {
    inputs: [
      { id: 'flow-in', name: 'Eval', type: 'flow' },
      { id: 'text-in', name: 'Text', type: 'data' }
    ],
    outputs: [
      { id: 'flow-true', name: 'True', type: 'flow' },
      { id: 'flow-false', name: 'False', type: 'flow' }
    ]
  },
  set_var: {
    inputs: [
      { id: 'flow-in', name: 'Exec', type: 'flow' },
      { id: 'value-in', name: 'Value', type: 'data' }
    ],
    outputs: [
      { id: 'flow-out', name: 'Next', type: 'flow' }
    ]
  },
  tool: {
    inputs: [
      { id: 'flow-in', name: 'Exec', type: 'flow' },
      { id: 'input-in', name: 'Input', type: 'data' }
    ],
    outputs: [
      { id: 'flow-out', name: 'Next', type: 'flow' },
      { id: 'output-out', name: 'Result', type: 'data' }
    ]
  },
  output: {
    inputs: [
      { id: 'flow-in', name: 'Done', type: 'flow' },
      { id: 'text-in', name: 'Result', type: 'data' }
    ],
    outputs: []
  }
};

// ==========================================================================
// 3. UI Translations & Helper Modules
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
    tab_files: 'Files',
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
    config_model_helper: 'Leave empty to use server\'s default model',
    config_fetch_models: 'Fetch Models',
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
    clear_canvas: 'Clear Canvas',
    
    // Node fields translations
    prop_node_id: 'Node ID',
    prop_node_title: 'Node Title',
    prop_start_val: 'Default Input Value',
    prop_prompt_tmpl: 'Prompt Template',
    prop_prompt_refine: 'Refine Prompt (LLM)',
    prop_prompt_revise: 'Revise Prompt with Feedback',
    prop_prompt_revise_comment: 'Feedback comment...',
    prop_prompt_revise_btn: 'Revise',
    prop_llm_temp: 'Temperature',
    prop_llm_tools: 'Enable Filesystem Tools',
    prop_extractor_type: 'Extraction Target',
    prop_extractor_pattern: 'Key / Pattern / Selector',
    prop_cond_type: 'Condition Rule',
    prop_cond_val: 'Comparison Value',
    prop_var_name: 'Target Variable Name',
    prop_tool_type: 'Mock/Local Tool Type',
    prop_output_label: 'Output Label'
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
    tab_files: 'ファイル',
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
    config_model_helper: '空欄の場合はサーバーのデフォルトモデルを使用します',
    config_fetch_models: 'モデル一覧を取得',
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
    clear_canvas: 'キャンバスを初期化',
    
    // Node fields translations
    prop_node_id: 'ノード ID',
    prop_node_title: 'ノード タイトル',
    prop_start_val: '初期デフォルト入力値',
    prop_prompt_tmpl: 'プロンプトテンプレート',
    prop_prompt_refine: 'プロンプト自動最適化 (LLM)',
    prop_prompt_revise: '指示・フィードバックによる改修',
    prop_prompt_revise_comment: '修正の指示を入力...',
    prop_prompt_revise_btn: '改修する',
    prop_llm_temp: 'サンプリング温度 (Temperature)',
    prop_llm_tools: 'ファイルシステムツールを有効化',
    prop_extractor_type: '抽出ターゲット',
    prop_extractor_pattern: '抽出キー / 正規表現 / デリミタ',
    prop_cond_type: '分岐ルール',
    prop_cond_val: '判定基準値',
    prop_var_name: '保存先変数名',
    prop_tool_type: 'ローカル/模擬ツール種類',
    prop_output_label: '出力表示ラベル'
  }
};

function applyLanguage(langCode) {
  state.lang = langCode;
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
}

function applyTheme(themeName) {
  state.theme = themeName;
  document.body.classList.remove('theme-cyber-dark', 'theme-matrix-green', 'theme-light-slate');
  document.body.classList.add(themeName);
  
  const select = document.getElementById('settings-theme');
  if (select) select.value = themeName;
  
  log(state.lang === 'en' ? `Color theme switched to ${themeName}.` : `カラーテーマを ${themeName} に切り替えました。`, 'info');
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
/**
 * Global helper to locate Chrome's Built-in AI interface across changing specifications
 * @returns {object|null} The resolved LanguageModel/assistant interface object, or null
 */
function getChromeAiInterface() {
  // 1. WICG standard Prompt API 'ai.languageModel'
  if (typeof ai !== 'undefined' && typeof ai.languageModel !== 'undefined') {
    return ai.languageModel;
  }
  // 2. window.ai.languageModel namespace
  if (typeof window !== 'undefined' && typeof window.ai !== 'undefined' && typeof window.ai.languageModel !== 'undefined') {
    return window.ai.languageModel;
  }
  // 3. window.ai.assistant namespace (older Canary spec)
  if (typeof window !== 'undefined' && typeof window.ai !== 'undefined' && typeof window.ai.assistant !== 'undefined') {
    return window.ai.assistant;
  }
  // 4. Global LanguageModel class (alternative draft spec)
  if (typeof LanguageModel !== 'undefined') {
    return LanguageModel;
  }
  return null;
}

async function checkChromeAi() {
  const badge = document.getElementById('provider-badge-text');
  const badgeContainer = document.getElementById('provider-badge');
  const desc = document.getElementById('chrome-ai-desc');
  const statusBlock = document.getElementById('chrome-ai-status-block');
  
  if (!desc || !badge || !statusBlock || !badgeContainer) return;
  
  const aiModel = getChromeAiInterface();
  
  if (aiModel) {
    try {
      // Determine availability or capabilities based on spec versions
      let available = 'no';
      let capabilities = null;
      
      if (typeof aiModel.availability === 'function') {
        const availRes = await aiModel.availability();
        available = (availRes === 'available' || availRes === 'downloadable' || availRes === 'downloading') ? 'yes' : 'no';
        capabilities = { available: availRes };
      } else if (typeof aiModel.capabilities === 'function') {
        const caps = await aiModel.capabilities();
        available = caps.available;
        capabilities = caps;
      }
      
      state.chromeAiAvailable = (available === 'yes' || available === 'available' || available === 'downloadable' || available === 'downloading');
      state.chromeAiCapabilities = capabilities;
      
      if (state.chromeAiAvailable) {
        const statusText = capabilities.available || available;
        desc.innerText = state.lang === 'en'
          ? `Gemini Nano detected and ready (Status: ${statusText}).`
          : `Gemini Nano が検出され、利用可能です (ステータス: ${statusText})。`;
        statusBlock.className = 'info-block success';
        badgeContainer.className = 'status-badge success';
        badge.innerText = 'LLM: Chrome AI';
        badge.removeAttribute('data-i18n');
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

/**
 * Query external OpenAI-compatible server for available models list
 * and populate datalist options for autocomplete
 */
async function fetchModels() {
  const fetchBtn = document.getElementById('fetch-models-btn');
  const datalist = document.getElementById('settings-model-datalist');
  if (!fetchBtn || !datalist) return;
  
  if (!state.apiEndpoint) {
    const msg = state.lang === 'en' ? 'Please set the API Endpoint URL first.' : '先にAPIエンドポイントURLを設定してください。';
    log(msg, 'warning');
    showAlert(state.lang === 'en' ? 'API Error' : 'APIエラー', msg);
    return;
  }
  
  let endpoint = state.apiEndpoint.trim();
  if (endpoint.endsWith('/')) {
    endpoint = endpoint.slice(0, -1);
  }
  if (endpoint.endsWith('/chat/completions')) {
    endpoint = endpoint.slice(0, -17);
  }
  
  const originalText = fetchBtn.innerHTML;
  fetchBtn.disabled = true;
  fetchBtn.innerHTML = `🔄 <span>${state.lang === 'en' ? 'Fetching...' : '取得中...'}</span>`;
  
  try {
    const headers = {};
    if (state.apiKey) {
      headers['Authorization'] = `Bearer ${state.apiKey}`;
    }
    
    log(state.lang === 'en' ? 'Fetching models list from server...' : 'サーバーからモデル一覧を取得しています...', 'info');
    
    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && Array.isArray(data.data)) {
      datalist.innerHTML = '';
      
      // Populate datalist options
      data.data.forEach(model => {
        if (model.id) {
          const opt = document.createElement('option');
          opt.value = model.id;
          datalist.appendChild(opt);
        }
      });
      
      const count = data.data.length;
      log(state.lang === 'en' 
        ? `Successfully fetched ${count} models from server.` 
        : `サーバーから ${count} 個のモデル一覧を正常に取得しました。`, 'success');
      
      // Trigger a visual highlight on the input helper
      const helper = document.getElementById('model-helper-text');
      if (helper && count > 0) {
        const firstModel = data.data[0].id;
        helper.innerText = state.lang === 'en'
          ? `Default: ${firstModel} (leave empty to use)`
          : `デフォルト: ${firstModel} (空欄の場合はこれが使用されます)`;
        helper.style.color = 'var(--primary)';
        setTimeout(() => {
          helper.style.color = '';
        }, 3000);
      }
    } else {
      throw new Error('Invalid response format (data array not found).');
    }
  } catch (err) {
    log(`Failed to fetch models: ${err.message}`, 'error');
    if (err.message.includes('Failed to fetch')) {
      showCorsErrorModal();
    } else {
      showAlert(state.lang === 'en' ? 'Fetch Models Failed' : 'モデル取得失敗', (state.lang === 'en' ? 'Failed to fetch models: ' : 'モデル取得失敗: ') + err.message);
    }
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.innerHTML = `🔄 <span>${state.lang === 'en' ? 'Fetch Models' : 'モデル一覧を取得'}</span>`;
  }
}

function log(text, type = 'info', details = null) {
  const timestamp = new Date().toLocaleTimeString();
  const entry = { timestamp, text, type, details };
  state.logs.push(entry);
  
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

// ==========================================================================
// 4. Canvas Panning & Zooming [Phase 2]
// ==========================================================================
function updateCanvasTransform() {
  const canvas = document.getElementById('node-canvas');
  if (!canvas) return;
  canvas.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
}

function initCanvasControls() {
  const viewport = document.getElementById('canvas-viewport');
  
  // Panning Event Listeners
  viewport.addEventListener('mousedown', (e) => {
    // Start panning if clicking directly on canvas/viewport (or SVG overlay) or using space/middle-click/right-click
    const isBgClick = e.target === viewport || e.target.id === 'node-canvas' || e.target.id === 'connections-overlay';
    const isPanTrigger = isBgClick || e.button === 1 || e.button === 2 || e.spaceKey;
    
    if (isPanTrigger) {
      state.isPanning = true;
      viewport.style.cursor = 'grabbing';
      state.panStart = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y };
      e.preventDefault();
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (state.isPanning) {
      state.pan.x = e.clientX - state.panStart.x;
      state.pan.y = e.clientY - state.panStart.y;
      updateCanvasTransform();
    }
  });

  document.addEventListener('mouseup', () => {
    if (state.isPanning) {
      state.isPanning = false;
      viewport.style.cursor = 'grab';
    }
  });

  // Prevent browser context menu on canvas right-click so it can be used for panning
  viewport.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Zooming Event (Mouse Wheel)
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.08;
    const rect = viewport.getBoundingClientRect();
    
    // Mouse coords relative to viewport
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Mouse coords relative to unscaled canvas
    const canvasX = (mouseX - state.pan.x) / state.zoom;
    const canvasY = (mouseY - state.pan.y) / state.zoom;
    
    const nextZoom = e.deltaY < 0 ? state.zoom * zoomFactor : state.zoom / zoomFactor;
    state.zoom = Math.min(2.0, Math.max(0.25, nextZoom));
    
    // Recalculate pan so zooming centers on mouse cursor
    state.pan.x = mouseX - canvasX * state.zoom;
    state.pan.y = mouseY - canvasY * state.zoom;
    
    updateCanvasTransform();
  });

  // Canvas Control Buttons
  document.getElementById('zoom-in-btn').addEventListener('click', () => {
    state.zoom = Math.min(2.0, state.zoom * 1.25);
    updateCanvasTransform();
  });
  
  document.getElementById('zoom-out-btn').addEventListener('click', () => {
    state.zoom = Math.max(0.25, state.zoom / 1.25);
    updateCanvasTransform();
  });
  
  document.getElementById('zoom-reset-btn').addEventListener('click', () => {
    state.zoom = 1.0;
    state.pan = { x: 0, y: 0 };
    updateCanvasTransform();
  });
  
  document.getElementById('clear-canvas-btn').addEventListener('click', () => {
    state.nodes = [];
    state.links = [];
    state.selectedNodeId = null;
    document.getElementById('nodes-container').innerHTML = '';
    drawConnections();
    document.getElementById('node-properties-section').classList.add('collapsed');
    log(state.lang === 'en' ? 'Canvas cleared.' : 'キャンバスを初期化しました。', 'warning');
  });
}

// ==========================================================================
// 5. Node Mechanics (Create, Drag, Delete, Select) [Phase 2]
// ==========================================================================

/**
 * Generate HTML representation of a node and add it to canvas
 * @param {object} node Node data definition
 */
function renderNode(node) {
  const container = document.getElementById('nodes-container');
  if (!container) return;

  const card = document.createElement('div');
  card.className = `node-card ${state.selectedNodeId === node.id ? 'selected' : ''}`;
  card.id = node.id;
  card.style.left = `${node.x}px`;
  card.style.top = `${node.y}px`;
  card.style.width = `${node.width || 280}px`;
  card.style.height = `${node.height || 160}px`;
  
  const template = PORT_TEMPLATES[node.type];

  // Compose Node UI Card markup
  let html = `
    <div class="node-header" style="background-color: ${NODE_COLORS[node.type]}">
      <div class="node-title">
        <span class="node-header-icon">${NODE_ICONS[node.type]}</span>
        <span>${node.title}</span>
      </div>
      <button class="node-delete-btn" title="Delete Node">&times;</button>
    </div>
    <div class="node-body">
  `;

  // Custom visual previews inside node card based on type
  if (node.type === NODE_TYPES.START) {
    html += `<div class="node-field-group"><label data-i18n="prop_start_val">Input Value</label><input type="text" class="node-input-text inline-edit" data-prop="inputValue" value="${node.data.inputValue || ''}" placeholder="Initial input text..."></div>`;
  } else if (node.type === NODE_TYPES.PROMPT) {
    const displayVal = node.data.promptTemplate ? (node.data.promptTemplate.substring(0, 30) + (node.data.promptTemplate.length > 30 ? '...' : '')) : '';
    html += `<div class="node-field-group"><label data-i18n="prop_prompt_tmpl">Prompt Template</label><div style="font-family: var(--font-mono); font-size:10px; color:var(--text-muted); min-height:16px;">${displayVal || '<i>Empty Template</i>'}</div></div>`;
  } else if (node.type === NODE_TYPES.LLM) {
    html += `<div class="node-field-group"><label data-i18n="prop_llm_temp">Temperature</label><div>${node.data.temperature !== undefined ? node.data.temperature : 0.7}</div></div>`;
  } else if (node.type === NODE_TYPES.SET_VAR) {
    html += `<div class="node-field-group"><label data-i18n="prop_var_name">Var Name</label><input type="text" class="node-input-text inline-edit" data-prop="variableName" value="${node.data.variableName || ''}" placeholder="e.g. current_code"></div>`;
  } else if (node.type === NODE_TYPES.EXTRACTOR) {
    html += `<div class="node-field-group"><label data-i18n="prop_extractor_type">Target</label><div>${node.data.extractorType || 'code_block'}</div></div>`;
  } else if (node.type === NODE_TYPES.CONDITION) {
    html += `<div class="node-field-group"><label data-i18n="prop_cond_type">Rule</label><div>${node.data.conditionType || 'contains'} : "${node.data.conditionValue || ''}"</div></div>`;
  } else if (node.type === NODE_TYPES.TOOL) {
    html += `<div class="node-field-group"><label data-i18n="prop_tool_type">Tool</label><div>${node.data.toolType || 'mock_test'}</div></div>`;
  } else if (node.type === NODE_TYPES.OUTPUT) {
    html += `<div class="node-field-group"><label data-i18n="prop_output_label">Label</label><input type="text" class="node-input-text inline-edit" data-prop="outputLabel" value="${node.data.outputLabel || 'Output'}" placeholder="e.g. Final Result"></div>`;
  }

  html += `</div>`; // End of body

  // Render ports
  html += `<div class="node-ports-wrapper">`;
  
  // Left Column: Inputs
  html += `<div class="ports-column inputs">`;
  template.inputs.forEach(port => {
    html += `
      <div class="port-item ${port.type}-color" data-port-id="${port.id}">
        <div class="port-dot ${port.type}-port" data-port-id="${port.id}" data-port-type="${port.type}" data-is-input="true" style="color: ${port.type === 'flow' ? 'var(--primary)' : 'var(--accent-purple)'}"></div>
        <span>${port.name}</span>
      </div>
    `;
  });
  html += `</div>`;
  
  // Right Column: Outputs
  html += `<div class="ports-column outputs">`;
  template.outputs.forEach(port => {
    html += `
      <div class="port-item ${port.type}-color" data-port-id="${port.id}">
        <span>${port.name}</span>
        <div class="port-dot ${port.type}-port" data-port-id="${port.id}" data-port-type="${port.type}" data-is-input="false" style="color: ${port.type === 'flow' ? 'var(--primary)' : 'var(--accent-purple)'}"></div>
      </div>
    `;
  });
  html += `</div>`;

  html += `</div>`; // End of ports wrapper
  html += `<div class="node-resize-handle"></div>`; // Resize handle

  card.innerHTML = html;
  container.appendChild(card);

  // Apply localization to node card content
  applyLanguageToNodeCard(card);

  // Setup Event Listeners for dragging, deleting, selecting
  setupNodeEvents(card, node);
}

/**
 * Update node title and labels inside the card on language switch
 */
function applyLanguageToNodeCard(cardEl) {
  const t = TRANSLATIONS[state.lang];
  if (!t) return;
  cardEl.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.innerText = t[key];
  });
}

/**
 * Bind pointer and mouse events to rendered Node Card
 */
function setupNodeEvents(cardEl, node) {
  const header = cardEl.querySelector('.node-header');
  
  // Selection
  cardEl.addEventListener('click', (e) => {
    // Avoid double trigger if clicking delete button
    if (e.target.classList.contains('node-delete-btn')) return;
    
    selectNode(node.id);
    e.stopPropagation(); // Prevent canvas background click deselecting
  });
  
  // Dragging Logic
  header.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('node-delete-btn')) return;
    
    state.activeDraggingNodeId = node.id;
    selectNode(node.id);
    
    // Start offset calculations
    state.dragOffset = {
      x: e.clientX - node.x * state.zoom,
      y: e.clientY - node.y * state.zoom
    };
    
    header.style.cursor = 'grabbing';
    e.preventDefault();
    e.stopPropagation();
  });
  
  // Inline Inputs updates
  cardEl.querySelectorAll('.inline-edit').forEach(input => {
    input.addEventListener('change', (e) => {
      const propName = e.target.getAttribute('data-prop');
      node.data[propName] = e.target.value;
      if (state.selectedNodeId === node.id) {
        showNodeProperties(node.id); // Sync right side inspector
      }
    });
    
    // Prevent dragging node when typing inside inputs
    input.addEventListener('mousedown', (e) => e.stopPropagation());
  });

  // Delete Node button click
  cardEl.querySelector('.node-delete-btn').addEventListener('click', (e) => {
    deleteNode(node.id);
    e.stopPropagation();
  });

  // Wire up port mouse events for connector lines dragging
  cardEl.querySelectorAll('.port-dot').forEach(dot => {
    dot.addEventListener('mousedown', (e) => {
      const portId = dot.getAttribute('data-port-id');
      const portType = dot.getAttribute('data-port-type');
      const isInput = dot.getAttribute('data-is-input') === 'true';
      
      const portCoords = getPortCenter(node.id, portId);
      
      state.activeLinkDrag = {
        fromNodeId: node.id,
        fromPortId: portId,
        type: portType,
        startX: portCoords.x,
        startY: portCoords.y,
        isInput: isInput
      };
      
      // Show temporary svg link dashed line
      const tempPath = document.getElementById('temp-link');
      if (tempPath) {
        tempPath.style.display = 'block';
        tempPath.setAttribute('stroke', portType === 'flow' ? 'var(--primary)' : 'var(--accent-purple)');
        tempPath.setAttribute('d', `M ${portCoords.x} ${portCoords.y} L ${portCoords.x} ${portCoords.y}`);
      }
      
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Double click node to open prompt editor [Phase 4]
  cardEl.addEventListener('dblclick', (e) => {
    if (e.target.closest('input') || e.target.closest('button') || e.target.closest('.port-dot')) return;
    if (node.type === NODE_TYPES.PROMPT) {
      openPromptEditor(node);
    }
  });

  // Drag Resizing Logic [Phase 4]
  const resizeHandle = cardEl.querySelector('.node-resize-handle');
  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', (e) => {
      state.activeResizingNodeId = node.id;
      state.resizeStartSize = {
        width: cardEl.offsetWidth,
        height: cardEl.offsetHeight
      };
      state.resizeStartMouse = {
        x: e.clientX,
        y: e.clientY
      };
      e.preventDefault();
      e.stopPropagation();
    });
  }
}

/**
 * Handle document pointermove and pointerup globally for node dragging and link connection
 */
function initGlobalDragAndDrop() {
  document.addEventListener('mousemove', (e) => {
    // 1. Handle Active Node Dragging
    if (state.activeDraggingNodeId) {
      const node = state.nodes.find(n => n.id === state.activeDraggingNodeId);
      if (node) {
        // Calculate new X,Y corrected by the viewport zoom scale!
        node.x = (e.clientX - state.dragOffset.x) / state.zoom;
        node.y = (e.clientY - state.dragOffset.y) / state.zoom;
        
        const card = document.getElementById(node.id);
        if (card) {
          card.style.left = `${node.x}px`;
          card.style.top = `${node.y}px`;
        }
        
        // Redraw SVG link wires
        drawConnections();
      }
    }
    
    // 2. Handle Port Link Connection Dragging
    if (state.activeLinkDrag) {
      const canvas = document.getElementById('node-canvas');
      const canvasRect = canvas.getBoundingClientRect();
      
      // Calculate cursor relative to unscaled canvas
      const mouseX = (e.clientX - canvasRect.left) / state.zoom;
      const mouseY = (e.clientY - canvasRect.top) / state.zoom;
      
      const tempPath = document.getElementById('temp-link');
      if (tempPath) {
        // Beautify current temporary path drawing
        const x1 = state.activeLinkDrag.startX;
        const y1 = state.activeLinkDrag.startY;
        const x2 = mouseX;
        const y2 = mouseY;
        
        // Curved line dynamically bent based on direction
        const dx = Math.abs(x2 - x1);
        const offset = Math.max(50, dx * 0.4);
        const ctrlX1 = state.activeLinkDrag.isInput ? x1 - offset : x1 + offset;
        const ctrlX2 = state.activeLinkDrag.isInput ? x2 + offset : x2 - offset;
        
        tempPath.setAttribute('d', `M ${x1} ${y1} C ${ctrlX1} ${y1}, ${ctrlX2} ${y2}, ${x2} ${y2}`);
      }
    }

    // 3. Handle Active Node Resizing [Phase 4]
    if (state.activeResizingNodeId) {
      const node = state.nodes.find(n => n.id === state.activeResizingNodeId);
      if (node) {
        const card = document.getElementById(node.id);
        const dx = (e.clientX - state.resizeStartMouse.x) / state.zoom;
        const dy = (e.clientY - state.resizeStartMouse.y) / state.zoom;
        
        const newWidth = Math.max(200, state.resizeStartSize.width + dx);
        const newHeight = Math.max(120, state.resizeStartSize.height + dy);
        
        node.width = newWidth;
        node.height = newHeight;
        
        card.style.width = `${newWidth}px`;
        card.style.height = `${newHeight}px`;
        
        // Redraw SVG link wires
        drawConnections();
      }
    }
  });

  document.addEventListener('mouseup', (e) => {
    // 1. Release Node Dragging
    if (state.activeDraggingNodeId) {
      const card = document.getElementById(state.activeDraggingNodeId);
      if (card) {
        card.querySelector('.node-header').style.cursor = 'move';
      }
      state.activeDraggingNodeId = null;
    }
    
    // 2. Release Link Dragging (Establish Connection)
    if (state.activeLinkDrag) {
      const tempPath = document.getElementById('temp-link');
      if (tempPath) tempPath.style.display = 'none';
      
      // Check if released mouse cursor over an opposite port-dot
      const targetDot = document.elementFromPoint(e.clientX, e.clientY);
      const isPortDot = targetDot && targetDot.classList.contains('port-dot');
      
      if (isPortDot) {
        const targetPortId = targetDot.getAttribute('data-port-id');
        const targetPortType = targetDot.getAttribute('data-port-type');
        const targetIsInput = targetDot.getAttribute('data-is-input') === 'true';
        
        // Find parent Node Card ID
        const targetCard = targetDot.closest('.node-card');
        const targetNodeId = targetCard ? targetCard.id : null;
        
        const sourceNodeId = state.activeLinkDrag.fromNodeId;
        const sourcePortId = state.activeLinkDrag.fromPortId;
        const sourceIsInput = state.activeLinkDrag.isInput;
        const sourceType = state.activeLinkDrag.type;
        
        // Validation constraints:
        // - Different nodes
        // - Connect flow to flow, data to data only
        // - Input connects to output or vice-versa
        const isValidLink = targetNodeId && 
                            targetNodeId !== sourceNodeId &&
                            targetPortType === sourceType &&
                            targetIsInput !== sourceIsInput;
                            
        if (isValidLink) {
          // Identify source and destination port correctly
          const fromNode = sourceIsInput ? targetNodeId : sourceNodeId;
          const fromPort = sourceIsInput ? targetPortId : sourcePortId;
          const toNode = sourceIsInput ? sourceNodeId : targetNodeId;
          const toPort = sourceIsInput ? sourcePortId : targetPortId;
          
          // Prevent duplicates
          const exists = state.links.some(l => 
            l.fromNode === fromNode && l.fromPort === fromPort &&
            l.toNode === toNode && l.toPort === toPort
          );
          
          if (!exists) {
            // Remove previous connections connected to Flow Input port (Flow inputs usually accept only 1 incoming connection!)
            // Data inputs can also accept only 1 incoming connection.
            // Let's delete any existing links targeting (toPort) on (toNode)
            state.links = state.links.filter(l => !(l.toNode === toNode && l.toPort === toPort));
            
            const newLink = {
              id: `link_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              fromNode,
              fromPort,
              toNode,
              toPort,
              type: sourceType
            };
            
            state.links.push(newLink);
            log(state.lang === 'en' ? `Connected port ${fromPort} ➔ ${toPort}.` : `ポート接続を確立しました: ${fromPort} ➔ ${toPort}`, 'success');
            drawConnections();
          }
        }
      }
      state.activeLinkDrag = null;
    }

    // 3. Release Node Resizing [Phase 4]
    if (state.activeResizingNodeId) {
      state.activeResizingNodeId = null;
    }
  });

  // Double click canvas to deselect nodes
  document.getElementById('canvas-viewport').addEventListener('click', (e) => {
    if (e.target === document.getElementById('canvas-viewport') || 
        e.target.id === 'node-canvas' || 
        e.target.id === 'connections-overlay') {
      deselectNodes();
    }
  });
}

/**
 * Select a specific Node and highlight it
 * @param {string} nodeId Target Node ID
 */
function selectNode(nodeId) {
  state.selectedNodeId = nodeId;
  document.querySelectorAll('.node-card').forEach(card => {
    if (card.id === nodeId) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
  
  // Show properties panel
  showNodeProperties(nodeId);
}

/**
 * Clear Node selections
 */
function deselectNodes() {
  state.selectedNodeId = null;
  document.querySelectorAll('.node-card').forEach(card => card.classList.remove('selected'));
  
  // Collapse property sidebar
  const propSection = document.getElementById('node-properties-section');
  if (propSection) propSection.classList.add('collapsed');
}

/**
 * Add a node to the canvas based on selected type
 * @param {string} type Node type
 * @param {number} x Canvas relative X coordinate
 * @param {number} y Canvas relative Y coordinate
 */
function createNode(type, x, y) {
  const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const template = PORT_TEMPLATES[type];
  
  const defaultTitle = TRANSLATIONS[state.lang][`node_${type}`] || type;
  
  const newNode = {
    id: nodeId,
    type: type,
    title: defaultTitle,
    x: x,
    y: y,
    width: type === NODE_TYPES.START ? 240 : (type === NODE_TYPES.PROMPT ? 300 : 280),
    height: type === NODE_TYPES.START ? 130 : 160,
    data: {
      promptTemplate: type === NODE_TYPES.PROMPT ? 'Review the following code:\n{{file_content}}\n\nIs it secure?' : '',
      systemPrompt: type === NODE_TYPES.LLM ? 'You are a professional software engineer.' : '',
      temperature: 0.7,
      conditionType: 'contains',
      conditionValue: 'PASS',
      variableName: type === NODE_TYPES.SET_VAR ? 'current_code' : '',
      toolType: 'mock_test',
      outputLabel: type === NODE_TYPES.OUTPUT ? 'Verification Report' : '',
      inputValue: type === NODE_TYPES.START ? 'Initial source code here' : '',
      extractorType: 'code_block',
      extractorPattern: ''
    }
  };
  
  state.nodes.push(newNode);
  renderNode(newNode);
  selectNode(nodeId);
  drawConnections();
  
  log(state.lang === 'en' ? `Added ${type} node.` : `${defaultTitle}ノードを作成しました。`, 'info');
  return newNode;
}

/**
 * Remove node and all connected link wires from canvas
 * @param {string} nodeId Target Node ID
 */
function deleteNode(nodeId) {
  state.nodes = state.nodes.filter(n => n.id !== nodeId);
  
  // Remove links connected to this node
  state.links = state.links.filter(l => l.fromNode !== nodeId && l.toNode !== nodeId);
  
  const el = document.getElementById(nodeId);
  if (el) el.remove();
  
  if (state.selectedNodeId === nodeId) {
    deselectNodes();
  }
  
  drawConnections();
  log(state.lang === 'en' ? `Deleted node ${nodeId}.` : `ノードを削除しました。`, 'warning');
}

// ==========================================================================
// 6. SVG Connection Lines Drawer [Phase 2]
// ==========================================================================

/**
 * Retrieve absolute coordinates of a port dot center relative to unscaled canvas
 */
function getPortCenter(nodeId, portId) {
  const nodeEl = document.getElementById(nodeId);
  if (!nodeEl) return { x: 0, y: 0 };
  
  const portEl = nodeEl.querySelector(`[data-port-id="${portId}"]`);
  if (!portEl) return { x: 0, y: 0 };
  
  const canvasEl = document.getElementById('node-canvas');
  const portRect = portEl.getBoundingClientRect();
  const canvasRect = canvasEl.getBoundingClientRect();
  
  // Remove viewport transform zoom factor to get exact pixel coordinate representation
  return {
    x: (portRect.left + portRect.width / 2 - canvasRect.left) / state.zoom,
    y: (portRect.top + portRect.height / 2 - canvasRect.top) / state.zoom
  };
}

/**
 * Render all lines in SVG connections overlay
 */
function drawConnections() {
  const linksGroup = document.getElementById('links-group');
  if (!linksGroup) return;
  
  linksGroup.innerHTML = '';
  
  state.links.forEach(link => {
    const start = getPortCenter(link.fromNode, link.fromPort);
    const end = getPortCenter(link.toNode, link.toPort);
    
    // Draw smooth cubic bezier
    const dx = Math.abs(end.x - start.x);
    const offset = Math.max(80, dx * 0.4); // Bending offset
    
    const x1 = start.x;
    const y1 = start.y;
    const x2 = end.x;
    const y2 = end.y;
    
    const d = `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('data-link-id', link.id);
    path.className.baseVal = `${link.type}-connection`;
    
    // Highlight if active step running (pulse signal animation class)
    if (state.currentNodeId === link.fromNode && state.runnerState === 'running') {
      path.className.baseVal += ' active-signal';
    }
    
    // Delete link on double click
    path.addEventListener('dblclick', () => {
      deleteLink(link.id);
    });
    
    // Give cursor indication
    path.addEventListener('mouseover', () => {
      path.setAttribute('stroke-width', '4');
    });
    path.addEventListener('mouseout', () => {
      path.setAttribute('stroke-width', '2.5');
    });
    
    linksGroup.appendChild(path);
  });
}

function deleteLink(linkId) {
  state.links = state.links.filter(l => l.id !== linkId);
  drawConnections();
  log(state.lang === 'en' ? 'Link removed.' : '接続線を削除しました。', 'warning');
}

// ==========================================================================
// 7. Right Properties Inspector Panel [Phase 2]
// ==========================================================================

/**
 * Open the large overlay Prompt Editor Dialog
 * @param {object} node Target Prompt Node
 */
function openPromptEditor(node) {
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
        <div style="flex: 1; display: flex; flex-direction: column; padding: 20px; gap: 16px; background-color: rgba(0, 0, 0, 0.15); overflow-y: auto;">
          <h4 style="margin-bottom: 4px;">LLM Actions</h4>
          
          <div class="form-group">
            <button id="modal-prompt-refine-btn" class="btn btn-primary btn-sm" style="width: 100%;">
              ✨ ${state.lang === 'en' ? 'Refine Template (LLM)' : 'プロンプト自動最適化 (LLM)'}
            </button>
          </div>
          
          <div class="border-top" style="padding-top: 16px; margin-top: 8px; border-color: var(--border-color);">
            <h4 style="margin-bottom: 8px;">${state.lang === 'en' ? 'Revise with Instructions' : '指示・フィードバック改修'}</h4>
            <div class="form-group">
              <textarea id="modal-prompt-revise-comment" class="node-input-text node-textarea" style="min-height: 80px;" placeholder="${state.lang === 'en' ? 'e.g. Write in Japanese, make it concise...' : '例：日本語で出力して、箇条書きにして...' }"></textarea>
            </div>
            <button id="modal-prompt-revise-btn" class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 8px;" disabled>
              🔄 ${state.lang === 'en' ? 'Apply Instructions (LLM)' : '指示を反映する (LLM)'}
            </button>
          </div>
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
  const reviseBtn = document.getElementById('modal-prompt-revise-btn');
  const commentInput = document.getElementById('modal-prompt-revise-comment');
  commentInput.value = node.data.reviseComment || '';
  
  console.log('Prompt Editor Elements:', { closeX, cancelBtn, saveBtn, refineBtn, reviseBtn, commentInput });
  
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
          ? 'An LLM optimization or revision is currently in progress. Are you sure you want to cancel and abort the query?' 
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
    node.data.promptTemplate = textarea.value;
    node.data.reviseComment = commentInput.value;
    
    // Update inline card preview
    const cardField = document.getElementById(node.id).querySelector('.node-body div div');
    if (cardField) {
      const displayVal = node.data.promptTemplate ? (node.data.promptTemplate.substring(0, 30) + (node.data.promptTemplate.length > 30 ? '...' : '')) : '';
      cardField.innerHTML = displayVal ? displayVal : '<i>Empty Template</i>';
    }
    
    // Update sidebar inspector if active
    if (state.selectedNodeId === node.id) {
      showNodeProperties(node.id);
    }
    
    log(state.lang === 'en' ? 'Prompt template saved.' : 'プロンプトテンプレートを保存しました。', 'info');
    closeEditor();
  };

  saveBtn.addEventListener('click', () => {
    if (isOptimizing) {
      const isEn = state.lang === 'en';
      showChoiceDialog({
        title: isEn ? 'AI Query In Progress' : 'AI処理を実行中',
        body: isEn 
          ? 'An LLM optimization or revision is currently in progress. What would you like to save?' 
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
  const originalReviseText = reviseBtn.innerText;

  // Restore visual buttons state if running in background
  if (runningReq) {
    refineBtn.disabled = true;
    reviseBtn.disabled = true;
    if (runningReq.type === 'refine') {
      refineBtn.innerText = state.lang === 'en' ? 'Optimizing...' : '最適化中...';
    } else if (runningReq.type === 'revise') {
      reviseBtn.innerText = state.lang === 'en' ? 'Revising...' : '改修中...';
      commentInput.value = runningReq.comment || '';
      commentInput.disabled = true;
    }
  } else {
    // Keep disabled until user types feedback
    reviseBtn.disabled = !commentInput.value.trim();
  }

  // Dynamically enable/disable Apply Instructions button based on user typing
  commentInput.addEventListener('input', () => {
    if (!isOptimizing) {
      reviseBtn.disabled = !commentInput.value.trim();
    }
  });

  // Hook state.activeEditor callbacks to reset buttons when background query finishes
  state.activeEditor = {
    nodeId: node.id,
    setOptimizing: (val) => { isOptimizing = val; },
    setAbortController: (ctrl) => { activeAbortController = ctrl; },
    resetButtons: (success = false) => {
      refineBtn.disabled = false;
      refineBtn.innerText = originalRefineText;
      reviseBtn.innerText = originalReviseText;
      commentInput.disabled = false;
      
      if (success) {
        node.data.reviseComment = '';
        commentInput.value = '';
        reviseBtn.disabled = true;
      } else {
        // Keep comment text and keep button enabled if comment is not empty on failure
        reviseBtn.disabled = !commentInput.value.trim();
      }
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
    reviseBtn.disabled = true;
    
    let success = false;
    try {
      const systemPrompt = "You are a professional prompt engineering assistant. Your task is to refine and optimize the user's prompt template to make it clearer, more structured, and highly effective for LLMs. Maintain any double-bracket variable placeholders (like {{variable_name}} or {{file_content}}) exactly as they are. Output ONLY the optimized prompt template itself, without any introductory text, quotes, or markdown code blocks.";
      const userPrompt = `Optimize this prompt template:\n\n${textarea.value}`;
      
      console.log('Sending LLM query to provider:', state.llmProvider);
      const optimized = await runLlmQuery(systemPrompt, userPrompt, 0.7, activeAbortController.signal);
      console.log('Received response from LLM:', optimized);
      
      // Determine if we should save directly to node (if modal was closed)
      const modalTextarea = document.getElementById('modal-prompt-textarea');
      if (modalTextarea) {
        modalTextarea.value = optimized.trim();
        log(state.lang === 'en' ? 'Prompt optimized inside editor.' : 'エディタ内でプロンプトの最適化を行いました。', 'success');
      } else {
        node.data.promptTemplate = optimized.trim();
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
        if (state.llmProvider === 'openai-compatible') showCorsErrorModal();
      }
    } finally {
      isOptimizing = false;
      
      // Always cleanup request registry and indicator
      if (state.activeLlmRequests) delete state.activeLlmRequests[node.id];
      if (card) card.classList.remove('executing');
      
      if (state.activeEditor && state.activeEditor.nodeId === node.id) {
        state.activeEditor.setOptimizing(false);
        state.activeEditor.setAbortController(null);
        state.activeEditor.resetButtons(success);
      }
      activeAbortController = null;
    }
  });

  reviseBtn.addEventListener('click', async () => {
    if (isOptimizing) return;
    if (!commentInput.value.trim()) {
      showAlert(
        state.lang === 'en' ? 'Input Required' : '入力が必要です',
        state.lang === 'en' ? 'Please enter a feedback comment.' : '指示コメントを入力してください。'
      );
      return;
    }
    
    isOptimizing = true;
    saveOnLlmFinish = false;
    activeAbortController = new AbortController();
    state.activeLlmRequests = state.activeLlmRequests || {};
    state.activeLlmRequests[node.id] = {
      controller: activeAbortController,
      type: 'revise',
      comment: commentInput.value
    };
    
    // Add executing class to node card on canvas to pulse yellow
    const card = document.getElementById(node.id);
    if (card) card.classList.add('executing');
    
    refineBtn.disabled = true;
    reviseBtn.disabled = true;
    reviseBtn.innerText = state.lang === 'en' ? 'Revising...' : '改修中...';
    commentInput.disabled = true;
    
    let success = false;
    try {
      const systemPrompt = "You are a professional prompt engineering assistant. Your task is to revise the existing prompt template based on the user's specific feedback or instructions. Ensure you keep the double-bracket variable placeholders (like {{variable_name}}) intact, and apply the requested feedback details. Output ONLY the revised prompt template, without any explanation, intro, or markdown fences.";
      const userPrompt = `Please revise the following prompt template according to the user instructions. Make sure to apply the instructions precisely.

[User Instructions]
${commentInput.value}

[Original Prompt Template]
${textarea.value}`;
      
      log(state.lang === 'en' 
        ? `Applying revision instructions: "${commentInput.value}"` 
        : `指示コメント:「${commentInput.value}」を適用中...`, 'info');
      
      console.log('Sending LLM query to provider:', state.llmProvider);
      const revised = await runLlmQuery(systemPrompt, userPrompt, 0.7, activeAbortController.signal);
      console.log('Received response from LLM:', revised);
      
      const modalTextarea = document.getElementById('modal-prompt-textarea');
      if (modalTextarea) {
        modalTextarea.value = revised.trim();
        log(state.lang === 'en' ? 'Prompt revised inside editor.' : 'エディタ内でプロンプトの改修を行いました。', 'success');
        node.data.reviseComment = '';
      } else {
        node.data.promptTemplate = revised.trim();
        node.data.reviseComment = '';
        log(state.lang === 'en' 
          ? `Background prompt revision finished successfully for node: ${node.title}.` 
          : `ノード「${node.title}」のバックグラウンド プロンプト改修が完了しました。`, 'success');
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
        log(state.lang === 'en' ? 'Revision canceled.' : '改修処理がキャンセルされました。', 'info');
      } else {
        console.error('Revise failed:', e);
        log(`Revision failed: ${e.message}`, 'error');
        if (state.llmProvider === 'openai-compatible') showCorsErrorModal();
      }
    } finally {
      isOptimizing = false;
      
      // Always cleanup request registry and indicator
      if (state.activeLlmRequests) delete state.activeLlmRequests[node.id];
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
 * Display selected node parameters in the inspector sidebar panel
 * @param {string} nodeId Node ID
 */
function showNodeProperties(nodeId) {
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

/**
 * Global LLM Query Executor helper supporting Chrome Built-in AI and OpenAI-compatible API
 * @param {string} systemPrompt System Instructions
 * @param {string} userPrompt User Prompt
 * @param {number} temperature Temperature sampling parameter
 * @returns {Promise<string>} Content response from LLM
 */
async function runLlmQuery(systemPrompt, userPrompt, temperature = 0.7, signal = null) {
  let responseContent = '';
  if (state.llmProvider === 'chrome-ai') {
    const aiModel = window.ai && (window.ai.languageModel || window.ai.assistant);
    if (!state.chromeAiAvailable || !window.ai || !aiModel) {
      throw new Error(state.lang === 'en' 
        ? 'Chrome Built-in AI is not available. Please verify capability flags or select External API.'
        : 'Chrome 組み込み AI が利用できません。フラグが有効化されているか確認するか、外部APIを選択してください。');
    }

    log(
      state.lang === 'en'
        ? `Sending query via Chrome Built-in AI...`
        : `Chrome 組み込み AI 経由でクエリを送信中...`,
      'info',
      `[API Engine] Chrome Built-in AI (window.ai)
[System Prompt]
${systemPrompt}

[User Prompt]
${userPrompt}

[Temperature]
${temperature}`
    );
    
    // Create new session with system prompt instructions
    const session = await aiModel.create({
      systemPrompt: systemPrompt,
      temperature: temperature,
      signal: signal
    });
    
    try {
      responseContent = await session.prompt(userPrompt, { signal });
    } finally {
      session.destroy(); // Always cleanup sessions
    }
  } else {
    // External OpenAI-compatible API call
    if (!state.apiEndpoint) {
      throw new Error(state.lang === 'en' ? 'API Endpoint URL is not configured in settings.' : 'APIエンドポイントURLが設定されていません。');
    }
    
    let endpoint = state.apiEndpoint.trim();
    if (endpoint.endsWith('/')) {
      endpoint = endpoint.slice(0, -1);
    }
    if (endpoint.endsWith('/chat/completions')) {
      endpoint = endpoint.slice(0, -17);
    }
    
    const headers = { 'Content-Type': 'application/json' };
    if (state.apiKey) {
      headers['Authorization'] = `Bearer ${state.apiKey}`;
    }
    
    // Resolve model name:
    // 1. User specified model in settings
    // 2. First model from our loaded datalist
    // 3. Fallback default 'qwen2.5-coder:7b'
    let selectedModel = state.apiModel ? state.apiModel.trim() : '';
    if (!selectedModel) {
      const datalist = document.getElementById('settings-model-datalist');
      if (datalist && datalist.options.length > 0) {
        selectedModel = datalist.options[0].value;
      } else {
        selectedModel = 'qwen2.5-coder:7b';
      }
    }
    
    const body = {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: temperature
    };

    const loggedHeaders = { ...headers };
    if (loggedHeaders['Authorization']) {
      loggedHeaders['Authorization'] = 'Bearer ******'; // Mask API Key
    }

    log(
      state.lang === 'en'
        ? `Sending query to External API via endpoint: ${endpoint}`
        : `外部APIエンドポイント: ${endpoint} へクエリを送信中...`,
      'info',
      `[POST Endpoint] ${endpoint}/chat/completions
[Headers]
${JSON.stringify(loggedHeaders, null, 2)}

[Request Body]
${JSON.stringify(body, null, 2)}`
    );
    
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      signal: signal
    });
    
    if (!response.ok) {
      let errorMsg = '';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMsg = typeof errorData.error === 'object' 
            ? (errorData.error.message || JSON.stringify(errorData.error)) 
            : errorData.error;
        } else if (errorData && errorData.message) {
          errorMsg = errorData.message;
        }
      } catch (jsonErr) {
        try {
          errorMsg = await response.clone().text();
        } catch (txtErr) {
          errorMsg = 'Unknown server error';
        }
      }
      
      const details = errorMsg ? ` - ${errorMsg}` : '';
      throw new Error(`HTTP ${response.status}${details}`);
    }
    
    const data = await response.json();
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
      throw new Error('API returned an empty or invalid chat completion payload.');
    }
    responseContent = data.choices[0].message.content;
  }

  log(
    state.lang === 'en' ? 'LLM response received successfully.' : 'LLMからの応答を受信しました。',
    'success',
    `[Response Content]\n${responseContent}`
  );
  return responseContent;
}

/**
 * Show a sleek, non-blocking custom confirmation dialog with multiple options.
 * @param {object} options Configuration for the dialog (title, body, borderTheme, buttons, layout, width)
 */
function showChoiceDialog(options) {
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
function showAlert(title, message) {
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
function showCorsErrorModal() {
  const modal = document.getElementById('error-modal');
  if (modal) {
    modal.classList.remove('collapsed');
  }
}

/**
 * Listen to input modifications inside the Property Inspector Form
 * @param {object} node Target Node data
 */
function wirePropertyControls(node) {
  // Title modify
  const titleInput = document.getElementById('prop-title-input');
  if (titleInput) {
    titleInput.addEventListener('input', (e) => {
      node.title = e.target.value;
      const cardTitleSpan = document.getElementById(node.id).querySelector('.node-title span:last-child');
      if (cardTitleSpan) cardTitleSpan.innerText = node.title;
    });
  }

  // Start Node input value modify
  const startInput = document.getElementById('prop-start-input');
  if (startInput) {
    startInput.addEventListener('input', (e) => {
      node.data.inputValue = e.target.value;
      const inlineInput = document.getElementById(node.id).querySelector('.inline-edit[data-prop="inputValue"]');
      if (inlineInput) inlineInput.value = node.data.inputValue;
    });
  }

  // Prompt Node edit trigger [Phase 4]
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
      node.data.temperature = parseFloat(e.target.value);
      // Update label in properties panel
      tempRange.previousElementSibling.innerText = `${TRANSLATIONS[state.lang].prop_llm_temp} (${node.data.temperature})`;
      // Update card preview
      const tempDiv = document.getElementById(node.id).querySelector('.node-body div div');
      if (tempDiv) tempDiv.innerText = node.data.temperature;
    });
  }
  
  const toolsCheck = document.getElementById('prop-llm-tools');
  if (toolsCheck) {
    toolsCheck.addEventListener('change', (e) => {
      node.data.enableTools = e.target.checked;
    });
  }

  // Extractor selections
  const extractSelect = document.getElementById('prop-extractor-type');
  if (extractSelect) {
    extractSelect.addEventListener('change', (e) => {
      node.data.extractorType = e.target.value;
      const patternGroup = document.getElementById('prop-extractor-pattern-group');
      if (patternGroup) {
        patternGroup.style.display = node.data.extractorType === 'code_block' ? 'none' : 'block';
      }
      
      const cardTypeDiv = document.getElementById(node.id).querySelector('.node-body div div');
      if (cardTypeDiv) cardTypeDiv.innerText = node.data.extractorType;
    });
  }
  
  const extractPattern = document.getElementById('prop-extractor-pattern');
  if (extractPattern) {
    extractPattern.addEventListener('input', (e) => {
      node.data.extractorPattern = e.target.value;
    });
  }

  // Condition rules selection
  const condSelect = document.getElementById('prop-cond-type');
  if (condSelect) {
    condSelect.addEventListener('change', (e) => {
      node.data.conditionType = e.target.value;
      updateConditionPreview(node);
    });
  }
  
  const condVal = document.getElementById('prop-cond-val');
  if (condVal) {
    condVal.addEventListener('input', (e) => {
      node.data.conditionValue = e.target.value;
      updateConditionPreview(node);
    });
  }

  // Set Var name input
  const varInput = document.getElementById('prop-var-input');
  if (varInput) {
    varInput.addEventListener('input', (e) => {
      node.data.variableName = e.target.value;
      const inlineInput = document.getElementById(node.id).querySelector('.inline-edit[data-prop="variableName"]');
      if (inlineInput) inlineInput.value = node.data.variableName;
    });
  }

  // Tool type select
  const toolSelect = document.getElementById('prop-tool-type');
  if (toolSelect) {
    toolSelect.addEventListener('change', (e) => {
      node.data.toolType = e.target.value;
      const cardToolDiv = document.getElementById(node.id).querySelector('.node-body div div');
      if (cardToolDiv) cardToolDiv.innerText = node.data.toolType;
    });
  }

  // Output label input
  const outputInput = document.getElementById('prop-output-input');
  if (outputInput) {
    outputInput.addEventListener('input', (e) => {
      node.data.outputLabel = e.target.value;
      const inlineInput = document.getElementById(node.id).querySelector('.inline-edit[data-prop="outputLabel"]');
      if (inlineInput) inlineInput.value = node.data.outputLabel;
    });
  }
}

function updateConditionPreview(node) {
  const cardDiv = document.getElementById(node.id).querySelector('.node-body div div');
  if (cardDiv) {
    cardDiv.innerText = `${node.data.conditionType || 'contains'} : "${node.data.conditionValue || ''}"`;
  }
}

// ==========================================================================
// 8. Variables Watcher UI Handler [Phase 3]
// ==========================================================================
function updateVariablesUI() {
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

// ==========================================================================
// 9. File System Access API & File Tree [Phase 3]
// ==========================================================================

async function connectDirectory() {
  if (typeof window.showDirectoryPicker === 'undefined') {
    const msg = state.lang === 'en'
      ? 'Browser Directory Access API is not supported in this browser. Please use Chrome/Edge.'
      : 'ブラウザの Directory Access API がサポートされていません。Chrome または Edge をご使用ください。';
    log(msg, 'error');
    showAlert(state.lang === 'en' ? 'Browser Compatibility' : 'ブラウザの互換性', msg);
    return;
  }
  try {
    const dirHandle = await window.showDirectoryPicker();
    state.directoryHandle = dirHandle;
    
    const badgeText = document.getElementById('dir-badge-text');
    const badge = document.getElementById('dir-badge');
    if (badge && badgeText) {
      badge.className = 'status-badge success';
      badgeText.innerText = `Folder: ${dirHandle.name}`;
      badgeText.removeAttribute('data-i18n');
    }
    
    log(state.lang === 'en' ? `Connected to directory: ${dirHandle.name}` : `ディレクトリに接続しました: ${dirHandle.name}`, 'success');
    
    // Auto-focus the Files tab in the right sidebar
    const filesTabBtn = document.querySelector('.tab-btn[data-tab="tab-files"]');
    if (filesTabBtn) {
      filesTabBtn.click();
    }
    
    await refreshFileTree();
  } catch (e) {
    log(`Failed to connect directory: ${e.message}`, 'error');
  }
}

async function refreshFileTree() {
  if (!state.directoryHandle) return;
  state.filesList = [];
  
  try {
    await scanDirectory(state.directoryHandle);
    renderFileTree();
  } catch (e) {
    log(`Error scanning directory: ${e.message}`, 'error');
  }
}

async function scanDirectory(dirHandle, path = '') {
  for await (const entry of dirHandle.values()) {
    // Exclude common build directories, hidden files, and git
    if (entry.name.startsWith('.') || 
        entry.name === 'node_modules' || 
        entry.name === 'dist' || 
        entry.name === 'build') {
      continue;
    }
    
    if (entry.kind === 'directory') {
      await scanDirectory(entry, path + entry.name + '/');
    } else if (entry.kind === 'file') {
      state.filesList.push({
        name: entry.name,
        path: path + entry.name,
        handle: entry
      });
    }
  }
}

function renderFileTree() {
  const container = document.getElementById('file-tree');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (state.filesList.length === 0) {
    container.innerHTML = `<span class="placeholder-text">${state.lang === 'en' ? 'No files found' : 'ファイルが見つかりません'}</span>`;
    return;
  }
  
  // Build nested folder/files structure
  const root = { files: [], subdirs: {} };
  
  state.filesList.forEach(file => {
    const parts = file.path.split('/');
    let current = root;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current.subdirs[part]) {
        current.subdirs[part] = { files: [], subdirs: {} };
      }
      current = current.subdirs[part];
    }
    
    current.files.push(file);
  });
  
  // Recursive render helper
  function renderSubtree(dir, name, depth = 0) {
    const ul = document.createElement('ul');
    ul.className = 'tree-subdir';
    ul.style.paddingLeft = name ? '10px' : '0px';
    ul.style.listStyle = 'none';
    
    if (name) {
      const liDir = document.createElement('li');
      liDir.className = 'tree-dir-header';
      liDir.style.fontWeight = '600';
      liDir.style.margin = '4px 0';
      liDir.style.cursor = 'default';
      liDir.innerHTML = `📁 <span style="opacity:0.95;">${name}</span>`;
      ul.appendChild(liDir);
    }
    
    // Sort and append subdirs
    Object.keys(dir.subdirs).sort().forEach(subdirName => {
      const subdirEl = renderSubtree(dir.subdirs[subdirName], subdirName, depth + 1);
      ul.appendChild(subdirEl);
    });
    
    // Sort and append files
    dir.files.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => {
      const liFile = document.createElement('li');
      liFile.className = 'file-item';
      liFile.innerHTML = `<span class="file-icon">📄</span> <span class="file-name-text">${file.name}</span>`;
      liFile.addEventListener('click', () => {
        document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
        liFile.classList.add('active');
        previewFile(file);
      });
      ul.appendChild(liFile);
    });
    
    return ul;
  }
  
  const treeHTML = renderSubtree(root, '');
  container.appendChild(treeHTML);
}

async function previewFile(file) {
  try {
    const fileObj = await file.handle.getFile();
    const text = await fileObj.text();
    
    // Create preview modal dynamically
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'file-preview-modal';
    
    // Escape HTML contents
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      
    overlay.innerHTML = `
      <div class="modal-card" style="width: 760px; max-width: 90vw; border-color: rgba(56, 189, 248, 0.4); max-height: 80vh;">
        <div class="modal-header">
          <span style="font-weight:600; display:flex; align-items:center; gap:8px;">
            <span style="color:var(--primary); filter:none; font-size:16px;">📄</span>
            <span>${file.path}</span>
          </span>
          <button id="close-preview-modal-x" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body" style="padding: 0; overflow: auto; background-color: #05080f;">
          <pre style="margin: 0; padding: 16px; font-family: var(--font-mono); font-size: 11px; color: #f1f5f9; line-height: 1.5; white-space: pre-wrap; word-break: break-all;">${escapedText}</pre>
        </div>
        <div class="modal-footer" style="padding: 10px 20px;">
          <button id="modal-select-as-input-btn" class="btn btn-primary btn-sm">${state.lang === 'en' ? 'Load to Variables' : '変数メモリに読み込む'}</button>
          <button id="close-preview-modal-btn" class="btn btn-secondary btn-sm">${state.lang === 'en' ? 'Close' : '閉じる'}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    const closeX = document.getElementById('close-preview-modal-x');
    const closeBtn = document.getElementById('close-preview-modal-btn');
    const loadBtn = document.getElementById('modal-select-as-input-btn');
    
    const closePreview = () => {
      overlay.remove();
    };
    
    closeX.addEventListener('click', closePreview);
    closeBtn.addEventListener('click', closePreview);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePreview();
    });
    
    loadBtn.addEventListener('click', () => {
      state.variables['file_content'] = text;
      updateVariablesUI();
      log(state.lang === 'en' 
        ? `Loaded file content to variable: file_content` 
        : `ファイル内容を変数「file_content」に読み込みました。`, 'success');
      closePreview();
    });
  } catch (e) {
    log(`Failed to read file: ${e.message}`, 'error');
  }
}

// ==========================================================================
// 10. Event wiring and initial presets creation
// ==========================================================================
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
          if (state.apiEndpoint.trim()) {
            fetchModels();
          }
        }
        if (id === 'settings-api-model') state.apiModel = e.target.value;
        if (id === 'settings-api-key') state.apiKey = e.target.value;
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
        const commentInput = document.getElementById('modal-prompt-revise-comment');
        if (textarea && state.selectedNodeId) {
          const node = state.nodes.find(n => n.id === state.selectedNodeId);
          if (node) {
            node.data.promptTemplate = textarea.value;
            if (commentInput) {
              node.data.reviseComment = commentInput.value;
            }
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

  // Connect Directory Click Handlers (Header and Sidebar button) [Phase 3]
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
  // Set default theme and language
  applyTheme(state.theme);
  applyLanguage(state.lang);
  
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
