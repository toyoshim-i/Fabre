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
  node_session: { en: 'Session Manager', ja: '対話セッション管理' },
  node_tool_config: { en: 'Tool Config', ja: 'ツール呼び出し設定' },
  btn_copy_defaults: { en: 'Copy App Defaults', ja: 'デフォルト設定を複製' },
  node_extractor: { en: 'Extractor', ja: '情報抽出' },
  node_condition: { en: 'Condition', ja: '条件分岐' },
  node_set_var: { en: 'Set Var', ja: '変数代入' },
  node_tool: { en: 'Tool Exec', ja: 'ツール実行' },
  node_wait: { en: 'Wait / Delay', ja: 'Wait / 遅延待機' },
  node_stream_view: { en: 'Stream View', ja: '出力ストリーム表示' },
  node_output: { en: 'Output Node', ja: '出力ノード' },
  btn_send_event: { en: 'Send Event', ja: 'イベント送信' },
  event_wait_placeholder: { en: 'Type event payload...', ja: 'イベントデータ・入力テキスト...' },
  stream_empty_placeholder: { en: 'Stream timeline output will appear here...', ja: '出力ストリームがここに表示されます...' },
  node_session_history: { en: 'History Memory', ja: '会話履歴メモリ' },
  btn_clear_session: { en: 'Clear History', ja: '履歴クリア' },
  prop_wait_delay: { en: 'Delay Interval (ms)', ja: '待機時間 (ms)' },
  wait_delay_started: { en: 'Wait node [{title}] pausing execution for {delay}ms...', ja: 'Waitノード [{title}] が {delay}ms 間待機を開始します...' },
  wait_delay_completed: { en: 'Wait node [{title}] delay finished ({delay}ms). Resuming flow.', ja: 'Waitノード [{title}] の待機が完了しました ({delay}ms)。処理を再開します。' },


  // Sidebar Tabs
  tab_runner: { en: 'Runner', ja: '実行制御' },
  tab_files: { en: 'Files & Projects', ja: 'ファイル / プロジェクト' },
  recent_projects_title: { en: 'Recent Projects', ja: '最近使ったプロジェクト' },
  no_recent_projects: { en: 'No recent projects found.', ja: '最近開いたプロジェクトはありません。' },
  tab_memory: { en: 'Memory', ja: '変数メモリ' },
  tab_logs: { en: 'Debug Console', ja: 'デバッグコンソール' },
  tab_console: { en: 'Debug Console', ja: 'デバッグコンソール' },
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
  llm_tool_call_emitted: { en: 'LLM emitted tool call [{tool}] via tool-call-out port', ja: 'LLMが tool-call-out ポートからツール呼び出し [{tool}] を出力しました' },
  llm_tool_call_unwired_warning: { en: 'LLM produced tool call [{tool}], but tool-call-out port is not connected.', ja: 'LLMがツール呼び出し [{tool}] を出力しましたが、tool-call-out ポートが未接続です。' },

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
  prop_node_id: { en: 'Node ID', ja: 'ノード ID' },
  prop_node_type: { en: 'Node Type', ja: 'ノードタイプ' },
  prop_node_title: { en: 'Node Title', ja: 'ノードタイトル' },
  label_initial_value: { en: 'Initial Value', ja: '初期入力値 (Text / Code)' },
  label_prompt_tmpl: { en: 'Prompt Template', ja: 'プロンプトテンプレート' },
  label_sys_prompt: { en: 'System Prompt', ja: 'システムプロンプト' },
  label_temp: { en: 'Temperature', ja: 'Temperature (ランダム性)' },
  label_max_retries: { en: 'Max Auto Retries on Failure', ja: '失敗時の自動リトライ回数' },
  label_retry_delay: { en: 'Retry Delay Interval (ms)', ja: 'リトライ間隔 (ms)' },
  label_enable_tools: { en: 'Enable Local Tools (ReAct Mode)', ja: 'ローカルツールの自動呼び出しを有効化 (ReAct)' },
  label_extract_type: { en: 'Extraction Type', ja: '抽出方式' },
  label_extract_pattern: { en: 'Key / Regex / Delimiter Pattern', ja: '抽出キー / 正規表現 / 区切り文字' },
  label_cond_type: { en: 'Condition Type', ja: '判定条件' },
  label_cond_val: { en: 'Target Value / Expression', ja: '判定文字列 / 式' },
  label_var_name: { en: 'Variable Name', ja: '変数名' },
  label_tool_type: { en: 'Local Tool Command', ja: '実行ツール' },
  btn_delete_node: { en: 'Delete Node', ja: 'このノードを削除' },
  llm_auto_retry_attempt: { en: 'LLM [{title}] temporary error occurred. Retrying attempt {attempt}/{max} in {delay}ms... ({error})', ja: 'LLM [{title}] で一時エラーが発生しました。{delay}ms 後に再試行します ({attempt}/{max} 回目)... ({error})' },
  llm_all_retries_failed: { en: 'LLM [{title}] all {max} retries failed.', ja: 'LLM [{title}] の全 {max} 回のリトライが失敗しました。' },


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
  confirm_clear_canvas: { en: 'Are you sure you want to clear the entire canvas?', ja: 'キャンバス上のすべてのノードと接続を消去しますか？' },
  btn_remove_recent: { en: 'Remove from list', ja: 'リストから削除' },
  mcp_name_placeholder: { en: 'e.g. Local MCP Server', ja: '例: ローカル MCP サーバー' },
  mcp_url_placeholder: { en: 'http://localhost:3000/sse', ja: 'http://localhost:3000/sse' },
  config_apikey_placeholder: { en: 'Enter API Key if needed', ja: 'APIキーを入力（必要な場合のみ）' },
  config_model_placeholder: { en: 'qwen2.5-coder:7b', ja: 'qwen2.5-coder:7b' },
  config_url_placeholder: { en: 'http://localhost:11434/v1', ja: 'http://localhost:11434/v1' },
  prop_session_system: { en: 'System Instruction', ja: 'システム指示' },
  prop_session_model: { en: 'Model Override (Optional)', ja: 'モデル名の上書き（任意）' },
  prop_session_endpoint: { en: 'Endpoint URL Override (Optional)', ja: 'APIエンドポイントの上書き（任意）' },
  prop_session_max_turns: { en: 'Max History Turns', ja: '最大保持ターン数' },

  // Chrome Built-in AI i18n keys
  chrome_ai_status_unavailable: { en: 'Chrome Built-in AI status: "{status}". Model is not downloaded or service is unavailable. Click "Download Model" below or check chrome://flags.', ja: 'Chrome 組み込み AI ステータス: "{status}"。モデルのダウンロード、または [モデルをダウンロード] ボタンのクリックが必要です。' },
  chrome_ai_status_downloading: { en: 'Chrome Built-in AI status: "{status}". Click "Download Model" button below to initiate model download.', ja: 'Chrome 組み込み AI ステータス: "{status}"。[モデルをダウンロード] ボタンをクリックしてダウンロードを開始してください。' },
  btn_download_chrome_ai: { en: '📥 Download Model', ja: '📥 モデルをダウンロード' },

  chrome_ai_status_active: { en: 'Chrome Built-in AI (Gemini Nano) is fully active and ready to execute offline queries.', ja: 'Chrome 組み込み AI (Gemini Nano) が有効です。ローカルAIモデルをオフラインで利用できます。' },
  chrome_ai_status_unsupported: { en: 'Chrome Built-in AI (window.ai / LanguageModel) is not supported in this browser.', ja: 'Chrome 組み込み AI (window.ai / LanguageModel) はこのブラウザでサポートされていません。' },
  chrome_ai_download_progress: { en: 'Downloading Chrome AI model (Gemini Nano): {pct}% ({loaded}/{total} bytes)...', ja: 'Chrome AI モデル (Gemini Nano) をダウンロード中: {pct}% ({loaded}/{total} バイト)...' },
  chrome_ai_download_success: { en: 'Chrome AI model download completed successfully. Ready to use.', ja: 'Chrome AI モデルのダウンロードが完了しました。利用可能です。' },
  chrome_ai_download_failed: { en: 'Chrome AI model download failed: {error}', ja: 'Chrome AI モデルのダウンロード失敗: {error}' },
  chrome_ai_executing: { en: 'Executing query via Chrome Built-in AI (Gemini Nano)...', ja: 'Chrome 組み込み AI (Gemini Nano) でクエリを実行中...' },
  chrome_ai_not_available_error: { en: 'Chrome Built-in AI is not available or model download is in progress.', ja: 'Chrome 組み込み AI が利用不可、またはモデルのダウンロード処理中です。' },
  chrome_ai_session_created: { en: 'LanguageModel session initialized (temp: {temp}, lang: {lang})', ja: 'LanguageModel セッションを初期化しました (temp: {temp}, lang: {lang})' },
  chrome_ai_prompt_sending: { en: 'Sending prompt to Chrome AI ({chars} chars)...', ja: 'Chrome AI へプロンプトを送信中 ({chars} 文字)...' },
  chrome_ai_query_completed: { en: 'Received response from Chrome AI in {duration}ms ({chars} chars)', ja: 'Chrome AI から応答を受信しました ({duration}ms, {chars} 文字)' },
  chrome_ai_session_destroyed: { en: 'LanguageModel session cleaned up successfully.', ja: 'LanguageModel セッションを正常に解放しました。' },
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

  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
  placeholderElements.forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key && DICTIONARY[key]) {
      el.setAttribute('placeholder', t(key));
    }
  });
}
