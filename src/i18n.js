// Fabre - Flow-based Agent Builder & Runtime Engine
// Centralized i18n Architecture & Dynamic Translation Module
'use strict';

import { state } from './state.js';

/**
 * i18n Dictionary mapping translation keys to English and Japanese strings
 */
export const DICTIONARY = {
  // General UI & Header
  app_title: { en: 'Fabre', ja: 'Fabre' },
  app_subtitle: { en: 'Flow-based Agent Builder & Runtime Engine', ja: 'Flow-based Agent Builder & Runtime Engine' },
  btn_connect_dir: { en: 'Connect Directory', ja: 'フォルダ接続' },
  btn_export_project: { en: 'Save Project (.fabre)', ja: 'プロジェクト保存 (.fabre)' },
  btn_import_project: { en: 'Open Project', ja: 'プロジェクト読み込み' },

  // Palette Sidebar
  palette_title: { en: 'Palette', ja: 'パレット' },
  palette_subtitle: { en: 'Drag or Click to Add', ja: 'ドラッグまたはクリックで追加' },
  node_start: { en: 'Start Node', ja: '開始ノード' },
  node_event_wait: { en: 'Event Wait', ja: 'イベント待機・受領' },
  node_prompt: { en: 'Prompt Builder', ja: 'プロンプト作成' },
  node_llm: { en: 'LLM Call', ja: 'LLM実行' },
  node_extractor: { en: 'Extractor', ja: '情報抽出' },
  node_condition: { en: 'Condition', ja: '条件分岐' },
  node_set_var: { en: 'Set Var', ja: '変数代入' },
  node_tool: { en: 'Tool Exec', ja: 'ツール実行' },
  node_stream_view: { en: 'Stream View', ja: '出力ストリーム表示' },
  node_output: { en: 'Output Node', ja: '出力ノード' },
  btn_send_event: { en: 'Send Event', ja: 'イベント送信' },
  event_wait_placeholder: { en: 'Type event payload...', ja: 'イベントデータ・入力テキスト...' },
  stream_empty_placeholder: { en: 'Stream timeline output will appear here...', ja: '出力ストリームがここに表示されます...' },

  // Sidebar Tabs
  tab_runner: { en: 'Runner', ja: '実行制御' },
  tab_files: { en: 'Files & Projects', ja: 'ファイル / プロジェクト' },
  recent_projects_title: { en: 'Recent Projects', ja: '最近のプロジェクト' },
  no_recent_projects: { en: 'No recent projects found.', ja: '最近開いたプロジェクトはありません。' },
  tab_memory: { en: 'Memory', ja: '変数メモリ' },
  tab_logs: { en: 'Logs', ja: 'ログ・履歴' },
  tab_config: { en: 'Config', ja: '設定' },

  // MCP Server Management
  mcp_servers_title: { en: 'MCP Servers (Model Context Protocol)', ja: 'MCP サーバー登録 (Model Context Protocol)' },
  mcp_name_label: { en: 'Server Alias', ja: 'サーバーエイリアス' },
  mcp_url_label: { en: 'Endpoint URL', ja: 'エンドポイント URL' },
  mcp_url_placeholder: { en: 'http://localhost:3000/sse', ja: 'http://localhost:3000/sse' },
  btn_add_mcp_server: { en: '+ Add MCP Server', ja: '+ MCP サーバーを追加' },
  mcp_server_already_exists: { en: 'MCP Server [{name}] is already registered.', ja: 'MCP サーバー [{name}] は既に登録されています。' },
  mcp_connected_success: { en: 'Connected to MCP server [{name}] ({count} tools discovered)', ja: 'MCP サーバー [{name}] に接続しました ({count} 個のツールを発見)' },
  mcp_connect_failed: { en: 'Failed to connect to MCP server [{name}]: {error}', ja: 'MCP サーバー [{name}] への接続に失敗しました: {error}' },
  mcp_executing_tool: { en: 'Executing MCP Tool [{tool}] on {url}...', ja: 'MCP ツール [{tool}] を {url} で実行中...' },
  llm_retry_tool_required: { en: 'LLM returned plain text instead of a tool call. Retrying with directive (Attempt {attempt}/{max})...', ja: 'LLMがツール呼び出しではなく平文を返却しました。指示を強化して再試行中 (試行 {attempt}/{max})...' },

  // Execution Debugger Controls
  runner_control_title: { en: 'Execution Control', ja: 'ワークフロー実行制御' },
  btn_run: { en: 'Run', ja: '自動実行' },
  btn_step: { en: 'Step', ja: 'ステップ実行' },
  btn_pause: { en: 'Pause', ja: '一時停止' },
  btn_reset: { en: 'Reset', ja: 'リセット' },
  label_delay: { en: 'Step Delay', ja: 'ステップ間隔' },
  runner_status: { en: 'Status:', ja: '状態:' },
  runner_current_node: { en: 'Current Node:', ja: '実行中ノード:' },
  runner_steps: { en: 'Steps Run:', ja: '実行ステップ数:' },

  // Runner States
  status_idle: { en: 'IDLE', ja: '待帰中' },
  status_running: { en: 'RUNNING', ja: '実行中' },
  status_paused: { en: 'PAUSED', ja: '一時停止' },
  status_success: { en: 'FINISHED', ja: '正常終了' },
  status_error: { en: 'ERROR', ja: 'エラー' },

  // Recent Files
  recent_files_title: { en: 'Recent Files', ja: '最近開いたファイル' },
  no_recent_files: { en: 'No recent files.', ja: '最近開いたファイルはありません。' },
  btn_clear_history: { en: 'Clear', ja: '履歴クリア' },
  log_cleared_recent: { en: 'Cleared recent files history.', ja: '最近開いたファイルの履歴をクリアしました。' },

  // Files Tab
  dir_title: { en: 'Target Directory', ja: '対象フォルダ' },
  dir_placeholder: { en: 'Connect a directory to browse files', ja: 'フォルダを接続するとファイルが表示されます' },

  // Memory Tab
  mem_title: { en: 'Variables Memory', ja: '変数メモリ' },
  btn_clear: { en: 'Clear', ja: 'クリア' },
  th_variable: { en: 'Variable', ja: '変数名' },
  th_value: { en: 'Value', ja: '値' },
  mem_empty: { en: 'No variables set yet', ja: '値はまだ設定されていません' },

  // Logs Tab
  logs_title: { en: 'Logs & LLM History', ja: 'ログ・LLM実行履歴' },
  logs_empty: { en: 'Logs will appear here during execution...', ja: '実行ログがここに表示されます...' },

  // Config Tab
  config_title: { en: 'Global Config', ja: '全体設定' },
  config_lang: { en: 'Language', ja: '言語 (Language)' },
  config_theme: { en: 'Theme', ja: 'テーマ (Theme)' },
  theme_cyber_dark: { en: 'Cyber Dark', ja: 'サイバーダーク' },
  theme_matrix_green: { en: 'Matrix Green', ja: 'マトリックスグリーン' },
  theme_light_slate: { en: 'Light Slate', ja: 'ライトスレート' },
  config_llm_mode: { en: 'LLM Provider Mode', ja: 'LLMプロバイダモード' },
  provider_chrome_ai: { en: 'Chrome Built-in AI (Gemini Nano)', ja: 'Chrome組み込みAI (Gemini Nano)' },
  provider_custom_api: { en: 'Custom OpenAI-Compatible API (Ollama / vLLM)', ja: '外部OpenAI互換API (Ollama / vLLM)' },
  config_api_endpoint: { en: 'API Base URL Endpoint', ja: 'APIエンドポイントURL' },
  config_api_model: { en: 'Model Name (or Select Below)', ja: 'モデル名（または下記選択）' },
  config_fetch_models: { en: 'Fetch Available Models', ja: '使用可能モデルを取得' },
  config_api_key: { en: 'API Key (Optional)', ja: 'APIキー（任意）' },

  // Canvas Controls
  clear_canvas: { en: 'Clear Canvas', ja: 'キャンバス全消去' },
  canvas_cleared_log: { en: 'Canvas cleared.', ja: 'キャンバスを全消去しました。' },

  // Node Properties Panel
  props_title: { en: 'Node Properties', ja: 'ノード詳細設定' },
  props_placeholder: { en: 'Select a node to inspect properties', ja: 'ノードを選択するとプロパティが表示されます' },
  label_node_title: { en: 'Node Title', ja: 'ノードタイトル' },
  label_initial_value: { en: 'Initial Value', ja: '初期入力値 (Text / Code)' },
  label_prompt_tmpl: { en: 'Prompt Template', ja: 'プロンプトテンプレート' },
  label_sys_prompt: { en: 'System Prompt', ja: 'システムプロンプト' },
  label_temp: { en: 'Temperature', ja: 'Temperature (ランダム性)' },
  label_enable_tools: { en: 'Enable Local Tools (ReAct Mode)', ja: 'ローカルツールの自動呼び出しを有効化 (ReAct)' },
  label_extract_type: { en: 'Extraction Type', ja: '抽出方式' },
  label_extract_pattern: { en: 'Key / Regex / Delimiter Pattern', ja: '抽出キー / 正規表現 / 区切り文字' },
  label_cond_type: { en: 'Condition Type', ja: '判定条件' },
  label_cond_val: { en: 'Target Value / Expression', ja: '判定文字列 / 式' },
  label_var_name: { en: 'Variable Name', ja: '変数名' },
  label_tool_type: { en: 'Local Tool Command', ja: '実行ツール' },
  btn_delete_node: { en: 'Delete Node', ja: 'このノードを削除' },

  // Modals & Dialogs
  save_meta_modal_title: { en: 'Save Project (.fabre)', ja: 'プロジェクト保存 (.fabre)' },
  label_meta_title: { en: 'Project Title', ja: 'プロジェクト名' },
  label_meta_desc: { en: 'Description', ja: '説明文' },
  label_meta_author: { en: 'Author', ja: '作成者' },
  btn_save_download: { en: 'Save & Download', ja: '保存してダウンロード' },
  btn_cancel: { en: 'Cancel', ja: 'キャンセル' },
  btn_close: { en: 'Close', ja: '閉じる' },
  btn_open_settings: { en: 'Open Settings', ja: '設定を開く' },

  // Runtime Logs & Messages
  canvas_empty_log: { en: 'Canvas is empty. Create nodes to run.', ja: 'キャンバスが空です。ノードを作成してください。' },
  current_node_not_found: { en: 'Current node not found.', ja: '現在のノードが見つかりません。' },
  executing_node: { en: 'Executing node: [{title}] ({type})', ja: 'ノードを実行中: [{title}] ({type})' },
  workflow_completed: { en: 'Workflow execution completed successfully. Result: {result}', ja: 'ワークフローの実行が正常終了しました。結果: {result}' },
  end_of_flow: { en: 'Reached end of flow.', ja: '制御フローの終端に達しました。' },
  workflow_paused: { en: 'Workflow paused.', ja: '実行を一時停止しました。' },
  workflow_reset: { en: 'Workflow reset.', ja: '実行状態をリセットしました。' },
  react_tool_detected: { en: 'ReAct Tool Call detected: {tool}', ja: 'ReAct ツール呼び出しを検出: {tool}' },
  cond_evaluated: { en: 'Condition evaluated: {result} (Branch: {branch})', ja: '条件分岐判定結果: {result} (分岐: {branch})' },
  set_var_log: { en: 'Set variable [{name}] = {val}', ja: '変数 [{name}] に値を格納しました: {val}' },
  loaded_workflow: { en: 'Loaded workflow: {title}', ja: 'ワークフロー「{title}」を読み込みました。' },
  exported_fabre: { en: 'Exported project as .fabre file.', ja: 'プロジェクト (.fabre) を保存・ダウンロードしました。' },
  failed_load_file: { en: 'Failed to load .fabre file: {error}', ja: 'ファイル読み込み失敗: {error}' },
  confirm_clear_canvas: { en: 'Are you sure you want to clear the entire canvas?', ja: 'キャンバス上のすべてのノードと接続を消去しますか？' }
};

/**
 * Get localized translation string for a given key with parameter interpolation
 * @param {string} key - Dictionary key
 * @param {Object} [params] - Key-value pair parameters to interpolate
 * @returns {string} Translated string
 */
export function t(key, params = {}) {
  const entry = DICTIONARY[key];
  const lang = state.lang === 'ja' ? 'ja' : 'en';
  let str = entry ? (entry[lang] || entry.en || key) : key;

  // Replace placeholders: {paramName}
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v !== undefined ? v : '');
    });
  }

  return str;
}

/**
 * Update all DOM elements with `data-i18n` attributes reactively
 */
export function updateDomTranslations() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && DICTIONARY[key]) {
      el.textContent = t(key);
    }
  });

  const titleElements = document.querySelectorAll('[data-i18n-title]');
  titleElements.forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key && DICTIONARY[key]) {
      el.setAttribute('title', t(key));
    }
  });
}
