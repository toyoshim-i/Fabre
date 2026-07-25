// LLM Provider Integrations (Chrome Built-in AI & OpenAI-compatible APIs)
'use strict';

import { state, getDefaultSystemPrompt, setLlmProvider } from './state.js';
import { log, showCorsErrorModal, showAlert, applyLanguage } from './ui.js';

/**
 * Global helper to locate Chrome's Built-in AI interface across changing specifications
 * @returns {object|null} The resolved LanguageModel/assistant interface object, or null
 */
export function getChromeAiInterface() {
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

/**
 * Detect browser local Chrome Built-in AI capability
 */
export async function checkChromeAi() {
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
      
      if (typeof aiModel.capabilities === 'function') {
        capabilities = await aiModel.capabilities();
        available = capabilities.available || 'no';
      } else if (typeof aiModel.availability === 'function') {
        available = await aiModel.availability();
      } else {
        // Fallback assumption if namespace exists but capabilities functions are missing
        available = 'readily';
      }
      
      if (available === 'no') {
        state.chromeAiAvailable = false;
        desc.innerText = state.lang === 'en'
          ? 'Chrome Built-in AI (window.ai) is supported by your browser, but the model is not downloaded or disabled. Enable flags and restart Chrome.'
          : 'Chrome 組み込み AI (window.ai) はサポートされていますが、モデルのダウンロードが未完了か、無効化されています。フラグの設定を確認してください。';
        statusBlock.className = 'info-block warning';
        badgeContainer.className = 'status-badge warning';
        badge.setAttribute('data-i18n', 'status_llm_not_configured');
        applyLanguage(state.lang); // Apply localized text
        log('Chrome Built-in AI is disabled or requires model download.', 'warning');
      } else {
        state.chromeAiAvailable = true;
        state.chromeAiCapabilities = capabilities;
        desc.innerText = state.lang === 'en'
          ? 'Chrome Built-in AI (Gemini Nano) is fully active and ready to execute offline queries.'
          : 'Chrome 組み込み AI (Gemini Nano) が有効です。ローカルAIモデルをオフラインで利用できます。';
        statusBlock.className = 'info-block success';
        badgeContainer.className = 'status-badge success';
        badge.innerText = 'LLM: Chrome AI';
        badge.removeAttribute('data-i18n');
        log(state.lang === 'en' ? 'Chrome Built-in AI (Gemini Nano) detected successfully.' : 'Chrome 組み込み AI (Gemini Nano) を検出しました。', 'success');
      }
    } catch (err) {
      state.chromeAiAvailable = false;
      desc.innerText = state.lang === 'en'
        ? `Error checking Chrome Built-in AI: ${err.message}. Defaulting to External API.`
        : `Chrome 組み込み AI の検出エラー: ${err.message}。外部APIを選択してください。`;
      statusBlock.className = 'info-block warning';
      badgeContainer.className = 'status-badge warning';
      badge.setAttribute('data-i18n', 'status_llm_not_configured');
      applyLanguage(state.lang); // Apply localized text
      log(`Failed to initialize Chrome AI: ${err.message}`, 'error');
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
export function updateLlmProvider(provider) {
  setLlmProvider(provider);
}

/**
 * Query external OpenAI-compatible server for available models list
 * and populate datalist options for autocomplete
 */
export async function fetchModels() {
  const fetchBtn = document.getElementById('fetch-models-btn');
  const datalist = document.getElementById('settings-model-datalist');
  const modelInput = document.getElementById('settings-api-model');
  const helper = document.getElementById('model-helper-text');
  
  if (!state.apiEndpoint || !fetchBtn || !datalist) return;
  
  let endpoint = state.apiEndpoint.trim();
  if (endpoint.endsWith('/')) {
    endpoint = endpoint.slice(0, -1);
  }
  if (endpoint.endsWith('/chat/completions')) {
    endpoint = endpoint.slice(0, -17);
  }
  
  fetchBtn.disabled = true;
  fetchBtn.innerHTML = `🔄 <span>${state.lang === 'en' ? 'Fetching...' : '取得中...'}</span>`;
  
  try {
    log(state.lang === 'en' ? 'Fetching models list from server...' : 'サーバーからモデル一覧を取得しています...', 'info');
    
    const headers = {};
    if (state.apiKey) {
      headers['Authorization'] = `Bearer ${state.apiKey}`;
    }
    
    const response = await fetch(`${endpoint}/models`, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    datalist.innerHTML = '';
    
    let models = [];
    if (Array.isArray(data.data)) {
      models = data.data.map(m => m.id);
    } else if (Array.isArray(data.models)) {
      models = data.models.map(m => m.name || m.id);
    } else if (data && typeof data === 'object') {
      // Direct array wrapper fallback
      const possibleArr = Object.values(data).find(val => Array.isArray(val));
      if (possibleArr) {
        models = possibleArr.map(m => m.id || m.name || m);
      }
    }
    
    if (models.length > 0) {
      models.forEach(modelName => {
        const option = document.createElement('option');
        option.value = modelName;
        datalist.appendChild(option);
      });
      
      log(state.lang === 'en' 
        ? `Loaded ${models.length} model autocomplete tags from endpoint.` 
        : `サーバーから ${models.length} 個の利用可能なモデル一覧を取得しました。`, 'success');
      
      if (helper) {
        helper.innerText = state.lang === 'en'
          ? `Found ${models.length} models. Defaulting to first if empty.`
          : `${models.length}個のモデルを発見。未入力時はリストの先頭を使用します。`;
      }
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

/**
 * Execute an LLM query string and wait for response
 * @param {string} systemPrompt System Instructions
 * @param {string} userPrompt User Prompt
 * @param {number} temperature Temperature settings parameter
 * @param {AbortSignal} signal AbortSignal signal
 * @returns {Promise<string>} Content response from LLM
 */
export async function runLlmQuery(systemPrompt, userPrompt, temperature = 0.7, signal = null) {
  let responseContent = '';
  console.log(`[LLM Query Request] Provider: ${state.llmProvider}`);
  if (state.llmProvider === 'chrome-ai') {
    const aiModel = window.ai && (window.ai.languageModel || window.ai.assistant);
    if (!state.chromeAiAvailable || !window.ai || !aiModel) {
      throw new Error(state.lang === 'en' 
        ? 'Chrome Built-in AI is not available. Please verify capability flags or select External API.'
        : 'Chrome 組み込み AI が利用できません。フラグが有効化されているか確認するか、外部APIを選択してください。');
    }

    console.log(`[Chrome AI Settings] Temperature: ${temperature}`);
    console.log(`[Chrome AI System Prompt]\n`, systemPrompt);
    console.log(`[Chrome AI User Prompt]\n`, userPrompt);

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

    console.log(`[External API Endpoint] POST ${endpoint}/chat/completions`);
    console.log(`[External API Headers]`, loggedHeaders);
    console.log(`[External API System Prompt]\n`, systemPrompt);
    console.log(`[External API User Prompt]\n`, userPrompt);
    console.log(`[External API Request Body]`, body);

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

  console.log(`[LLM Query Response]\n`, responseContent);

  log(
    state.lang === 'en' ? 'LLM response received successfully.' : 'LLMからの応答を受信しました。',
    'success',
    `[Response Content]\n${responseContent}`
  );
  return responseContent;
}
