// Global Application State & Configuration Constants
'use strict';

export const state = {
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

export const NODE_TYPES = {
  START: 'start',
  PROMPT: 'prompt',
  LLM: 'llm',
  EXTRACTOR: 'extractor',
  CONDITION: 'condition',
  SET_VAR: 'set_var',
  TOOL: 'tool',
  OUTPUT: 'output'
};

export const NODE_COLORS = {
  start: 'var(--color-start)',
  prompt: 'var(--color-prompt)',
  llm: 'var(--color-llm)',
  extractor: 'var(--color-extractor)',
  condition: 'var(--color-condition)',
  set_var: 'var(--color-setvar)',
  tool: 'var(--color-tool)',
  output: 'var(--color-output)'
};

export const NODE_ICONS = {
  start: '▶',
  prompt: '✎',
  llm: '🤖',
  extractor: '⚲',
  condition: '⇅',
  set_var: '⛃',
  tool: '🛠',
  output: '■'
};

export const PORT_TEMPLATES = {
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

export const TRANSLATIONS = {
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
    config_cors_desc: 'Ollama などのローカルAPI呼び出しで接続エラーが発生する場合、CORS設定（例: OLLAMA_ORIGINS=\"*\" ollama serve）を確認してください。',
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

/**
 * Retrieve the default system prompt instructions for optimizing templates
 * @param {string} lang Language code ('en' | 'ja')
 * @returns {string} The default optimization prompt
 */
export function getDefaultSystemPrompt(lang = state.lang) {
  if (lang === 'en') {
    return "You are a professional prompt engineering assistant. Your task is to refine and optimize the user's prompt template to make it clearer, more structured, and highly effective for LLMs. Maintain any double-bracket variable placeholders (like {{variable_name}} or {{file_content}}) exactly as they are. Output ONLY the optimized prompt template itself, without any introductory text, quotes, or markdown code blocks.";
  } else {
    return "あなたはプロフェッショナルなプロンプトエンジニアリングのアシスタントです。ユーザーのプロンプトテンプレートをより明確で構造化され、LLMにとって効果的なものに最適化・洗練することがタスクです。{{variable_name}}のような二重ブラケットの変数プレースホルダーはそのまま保持してください。説明や前置き、マークダウンのコードブロックは一切出力せず、最適化されたプロンプトテンプレートのみを出力してください。";
  }
}
