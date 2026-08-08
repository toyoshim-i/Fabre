// LLM Provider Integrations (Chrome Built-in AI & OpenAI-compatible APIs)
'use strict';

import { state, getDefaultSystemPrompt, setLlmProvider, normalizeString, normalizeNodeData } from './state.js';
import { log, showCorsErrorModal, showAlert, applyLanguage } from './ui.js';
import { getMcpToolsForOpenAi, resolveToolConfig } from './mcp.js';
import { t } from './i18n.js';

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
      // Determine availability or capabilities based on WICG standard Prompt API spec
      let available = 'no';
      let capabilities = null;
      const targetLang = state.lang === 'ja' ? 'ja' : 'en';
      const langOptions = {
        expectedInputLanguages: ['en', 'ja', 'es', 'fr', 'de'],
        outputLanguage: targetLang
      };
      
      if (typeof aiModel.availability === 'function') {
        try {
          available = await aiModel.availability(langOptions);
        } catch (e) {
          try {
            available = await aiModel.availability();
          } catch (e2) {
            available = 'no';
          }
        }
      }
      
      if ((available === 'no' || available === 'unavailable' || !available) && typeof aiModel.capabilities === 'function') {
        try {
          capabilities = await aiModel.capabilities(langOptions);
        } catch (e) {
          try {
            capabilities = await aiModel.capabilities();
          } catch (e2) {
            capabilities = null;
          }
        }
        available = (capabilities && capabilities.available) || available;
      }
      
      const isAvailable = (available === 'available' || available === 'readily' || available === 'after-download' || available === 'downloadable' || available === 'downloading' || available === true);

      if (!isAvailable) {
        state.chromeAiAvailable = false;
        desc.innerText = t('chrome_ai_status_unavailable', { status: available });
        statusBlock.className = 'info-block warning';
        badgeContainer.className = 'status-badge warning';
        badge.innerText = state.lang === 'en' ? 'LLM: Custom API' : 'LLM: 外部API';
        badge.removeAttribute('data-i18n');
        log(t('chrome_ai_status_unavailable', { status: available }), 'warning');
        updateLlmProvider('openai-compatible');
      } else {
        const needsDownload = (available === 'after-download' || available === 'downloadable' || available === 'downloading');
        
        if (needsDownload) {
          desc.innerText = t('chrome_ai_status_downloading', { status: available });
          statusBlock.className = 'info-block warning';
          badgeContainer.className = 'status-badge warning';
          badge.innerText = state.lang === 'en' ? 'LLM: Downloading...' : 'LLM: DL中...';
          log(t('chrome_ai_status_downloading', { status: available }), 'info');

          // Kick automatic model download
          triggerChromeAiModelDownload(aiModel, desc, statusBlock, badgeContainer, badge);
        } else {
          state.chromeAiAvailable = true;
          state.chromeAiCapabilities = capabilities;
          desc.innerText = t('chrome_ai_status_active');
          statusBlock.className = 'info-block success';
          badgeContainer.className = 'status-badge success';
          badge.innerText = 'LLM: Chrome AI';
          badge.removeAttribute('data-i18n');
          log(t('chrome_ai_status_active'), 'success');
        }
      }
    } catch (err) {
      state.chromeAiAvailable = false;
      desc.innerText = `${t('chrome_ai_status_unavailable', { status: 'error' })} (${err.message})`;
      statusBlock.className = 'info-block warning';
      badgeContainer.className = 'status-badge warning';
      badge.innerText = state.lang === 'en' ? 'LLM: Custom API' : 'LLM: 外部API';
      badge.removeAttribute('data-i18n');
      log(`Failed to initialize Chrome AI: ${err.message}`, 'error');
      updateLlmProvider('openai-compatible');
    }
  } else {
    state.chromeAiAvailable = false;
    desc.innerText = t('chrome_ai_status_unsupported');
    statusBlock.className = 'info-block warning';
    badgeContainer.className = 'status-badge warning';
    badge.innerText = state.lang === 'en' ? 'LLM: Custom API' : 'LLM: 外部API';
    badge.removeAttribute('data-i18n');
    log(t('chrome_ai_status_unsupported'), 'warning');
    updateLlmProvider('openai-compatible');
  }
}

/**
 * Trigger background Chrome AI model download via LanguageModel.create with monitor listener,
 * updating UI progress and transitioning state to available upon completion.
 */
async function triggerChromeAiModelDownload(aiModel, desc, statusBlock, badgeContainer, badge) {
  try {
    const targetLang = state.lang === 'ja' ? 'ja' : 'en';
    const createOptions = {
      expectedInputLanguages: ['en', 'ja', 'es', 'fr', 'de'],
      outputLanguage: targetLang,
      monitor(m) {
        if (m && typeof m.addEventListener === 'function') {
          m.addEventListener('downloadprogress', (e) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            const progressMsg = t('chrome_ai_download_progress', { pct, loaded: e.loaded, total: e.total });
            log(progressMsg, 'info');
            badge.innerText = `LLM: DL ${pct}%`;
          });
        }
      }
    };

    let session;
    try {
      if (typeof aiModel.create === 'function') {
        session = await aiModel.create(createOptions);
      } else {
        session = await aiModel(createOptions);
      }
    } catch (createErr) {
      // Fallback create call with basic language options if monitor throws
      const basicOptions = { expectedInputLanguages: ['en', 'ja'], outputLanguage: targetLang };
      if (typeof aiModel.create === 'function') {
        session = await aiModel.create(basicOptions);
      } else {
        session = await aiModel(basicOptions);
      }
    }

    // Cleanup kick dummy session
    if (session && typeof session.destroy === 'function') {
      session.destroy();
    }

    // Model download completed successfully -> transition to available state!
    state.chromeAiAvailable = true;
    updateLlmProvider('chrome-ai');
    desc.innerText = t('chrome_ai_download_success');
    statusBlock.className = 'info-block success';
    badgeContainer.className = 'status-badge success';
    badge.innerText = 'LLM: Chrome AI';
    badge.removeAttribute('data-i18n');
    log(t('chrome_ai_download_success'), 'success');
  } catch (err) {
    log(t('chrome_ai_download_failed', { error: err.message }), 'warning');
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
 * Convert raw string, prompt, or structured object array into Fabre Canonical Messages
 * Schema: [ { role: 'system'|'user'|'assistant'|'tool', content: string, tool_name?: string } ]
 */
export function normalizeToCanonicalMessages(input, systemPrompt = '') {
  let messages = [];

  if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt.trim() });
  }

  if (Array.isArray(input)) {
    input.forEach(item => {
      if (typeof item === 'string') {
        messages.push({ role: 'user', content: item });
      } else if (item && typeof item === 'object' && item.content) {
        messages.push({
          role: item.role || 'user',
          content: String(item.content),
          ...(item.tool_name ? { tool_name: item.tool_name } : {})
        });
      }
    });
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    // Check if input is a JSON string of Canonical Messages array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeToCanonicalMessages(parsed, systemPrompt);
        }
      } catch (e) {}
    }

    // Check if input contains role annotations (User/Assistant/System/Tool)
    const roleRegex = /(?=(?:User Request|User Input|User|Assistant Reply|Assistant Response|Assistant|System Instruction|System Prompt|System|Tool Output|Tool Result|Tool):)/i;
    if (roleRegex.test(trimmed)) {
      const parts = trimmed.split(roleRegex);
      parts.forEach(part => {
        const p = part.trim();
        if (!p) return;
        
        if (/^(?:System Instruction|System Prompt|System):/i.test(p)) {
          const sysContent = p.replace(/^(?:System Instruction|System Prompt|System):/i, '').trim();
          if (sysContent) messages.push({ role: 'system', content: sysContent });
        } else if (/^(?:User Request|User Input|User):/i.test(p)) {
          const userContent = p.replace(/^(?:User Request|User Input|User):/i, '').trim();
          if (userContent) messages.push({ role: 'user', content: userContent });
        } else if (/^(?:Assistant Reply|Assistant Response|Assistant):/i.test(p)) {
          const asstContent = p.replace(/^(?:Assistant Reply|Assistant Response|Assistant):/i, '').trim();
          if (asstContent) messages.push({ role: 'assistant', content: asstContent });
        } else if (/^(?:Tool Output|Tool Result|Tool):/i.test(p)) {
          const toolContent = p.replace(/^(?:Tool Output|Tool Result|Tool):/i, '').trim();
          if (toolContent) messages.push({ role: 'tool', content: toolContent });
        } else {
          messages.push({ role: 'user', content: p });
        }
      });
    } else if (trimmed) {
      messages.push({ role: 'user', content: trimmed });
    }
  }

  // Deduplicate initial system prompt if system message already parsed
  if (messages.length > 1 && messages[0].role === 'system' && messages[1].role === 'system') {
    messages.shift();
  }

  return messages;
}

export function getBuiltInToolsForOpenAi() {
  return [
    {
      type: 'function',
      function: {
        name: 'js_sandbox',
        description: 'Execute JavaScript code in browser sandbox and return the result. The return value of the last expression is automatically captured and returned as the tool result. For example, code "2 + 3" returns "5". Do NOT use console.log() to output results; instead, write the value as the final expression so it is returned directly.',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'JavaScript code to execute. The value of the last expression is returned as the result. Example: "123 * 456" returns "56088".' }
          },
          required: ['code']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read text content of a local file in connected directory',
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Relative path or file name' }
          },
          required: ['filePath']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write text content to a local file in connected directory',
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Relative path or file name' },
            content: { type: 'string', description: 'Text content to write' }
          },
          required: ['filePath', 'content']
        }
      }
    }
  ];
}

export function getAllAvailableToolsForOpenAi(toolConfigOverrides = null) {
  const resolved = resolveToolConfig(toolConfigOverrides || {});
  
  const allBuiltIn = getBuiltInToolsForOpenAi();
  const filteredBuiltIn = allBuiltIn.filter(t => resolved.enabledBuiltInTools.includes(t.function.name));

  const allMcp = getMcpToolsForOpenAi();
  const filteredMcp = allMcp.filter((t, idx) => {
    const rawMcp = state.mcpTools[idx];
    const fullId = rawMcp ? (rawMcp.fullId || rawMcp.name) : t.function.name;
    return resolved.enabledMcpTools.includes(fullId) || resolved.enabledMcpTools.includes(t.function.name);
  });

  return [...filteredBuiltIn, ...filteredMcp];
}

/**
 * Execute an LLM query string and wait for response
 * @param {string} systemPrompt System Instructions
 * @param {string} userPrompt User Prompt
 * @param {number} temperature Temperature settings parameter
 * @param {AbortSignal} signal AbortSignal signal
 * @param {object} options Options (tools, enableTools, returnStructured)
 * @returns {Promise<string|object>} Content response or structured object from LLM
 */
function generateSmartMockLlmResponse(systemPrompt, userPrompt, options) {
  const promptStr = String(userPrompt || '');
  const sysStr = String(systemPrompt || '');
  
  if (options && options.enableTools) {
    // Native Tool Calling sample: return expression-based code (not console.log)
    if (sysStr.includes('Tool-Calling') || promptStr.includes('Compute')) {
      return {
        type: 'tool_calls',
        content: '',
        tool_calls: [
          {
            id: 'call_mock_001',
            function: {
              name: 'js_sandbox',
              arguments: JSON.stringify({ code: '123 * 456' })
            }
          }
        ]
      };
    }
    if (promptStr.includes('alert') || sysStr.includes('automation assistant')) {
      return {
        type: 'tool_calls',
        content: '```js\nalert("HELLO");\n```',
        tool_calls: [
          {
            function: {
              name: 'js_sandbox',
              arguments: JSON.stringify({ code: 'alert("HELLO");' })
            }
          }
        ]
      };
    }
  }

  if (sysStr.includes('automation assistant') || promptStr.includes('Generate executable JavaScript')) {
    return "```js\nalert('HELLO');\n```";
  }

  if (promptStr.includes('PASS') || sysStr.includes('Condition')) {
    return 'TEST PASS - All checks completed successfully.';
  }

  if (promptStr.includes('sum(arr)') || sysStr.includes('Senior Engineer')) {
    return 'Analysis: Code contains potential edge case for empty array. Recommended check added.';
  }

  return 'WebAssembly (Wasm) is a binary instruction format for a stack-based virtual machine, designed as a portable compilation target for high-performance web applications.';
}

/**
 * Resolve effective LLM configuration by merging local node overrides with global state defaults.
 * @param {Object} [overrides={}] Local overrides
 * @returns {object} Fully resolved configuration
 */
export function resolveLlmConfig(overrides = {}) {
  const normalizedOverrides = normalizeNodeData(overrides);

  const provider = (normalizedOverrides.providerOverride && normalizedOverrides.providerOverride !== 'inherit') 
    ? normalizedOverrides.providerOverride 
    : (normalizedOverrides.llmProviderOverride && normalizedOverrides.llmProviderOverride !== 'inherit')
    ? normalizedOverrides.llmProviderOverride
    : (normalizedOverrides.llmProvider && normalizedOverrides.llmProvider !== 'inherit')
    ? normalizedOverrides.llmProvider
    : state.llmProvider;

  const endpoint = normalizeString(normalizedOverrides.endpointOverride)
    || normalizeString(normalizedOverrides.apiEndpoint)
    || normalizeString(state.apiEndpoint)
    || 'http://localhost:11434/v1';

  const model = normalizeString(normalizedOverrides.modelOverride)
    || normalizeString(normalizedOverrides.apiModel)
    || normalizeString(state.apiModel)
    || 'qwen2.5-coder:7b';

  const apiKey = normalizeString(normalizedOverrides.apiKeyOverride)
    || normalizeString(normalizedOverrides.apiKey)
    || normalizeString(state.apiKey)
    || '';

  const temperature = (normalizedOverrides.temperatureOverride !== undefined && normalizedOverrides.temperatureOverride !== null && normalizedOverrides.temperatureOverride !== '')
    ? Number(normalizedOverrides.temperatureOverride)
    : (normalizedOverrides.temperature !== undefined && normalizedOverrides.temperature !== null && normalizedOverrides.temperature !== '' ? Number(normalizedOverrides.temperature) : 0.7);

  return {
    provider,
    endpoint,
    model,
    apiKey,
    temperature
  };
}

export async function runLlmQuery(systemPrompt, userPrompt, temperature = 0.7, signal = null, options = {}) {
  if (state.useMockLlm || state.mockLlmHandler) {
    if (typeof state.mockLlmHandler === 'function') {
      const mockRes = await state.mockLlmHandler(systemPrompt, userPrompt, options);
      if (typeof mockRes === 'string') {
        return options.returnStructured ? { type: 'text', content: mockRes } : mockRes;
      }
      return mockRes;
    }
    
    const mockContent = generateSmartMockLlmResponse(systemPrompt, userPrompt, options);
    if (options.returnStructured && typeof mockContent === 'object') {
      return mockContent;
    }
    return options.returnStructured ? { type: 'text', content: mockContent } : mockContent;
  }

  const llmConfig = resolveLlmConfig({ ...options, temperatureOverride: options.temperatureOverride !== undefined ? options.temperatureOverride : temperature });
  let responseContent = '';
  let toolCalls = null;
  
  let canonicalMessages = Array.isArray(options.messagesPayload) && options.messagesPayload.length > 0
    ? options.messagesPayload.map(m => ({ role: m.role || 'user', content: m.content || '' }))
    : normalizeToCanonicalMessages(userPrompt, systemPrompt);

  if (systemPrompt && !canonicalMessages.some(m => m.role === 'system')) {
    canonicalMessages.unshift({ role: 'system', content: systemPrompt });
  }

  if (llmConfig.provider === 'chrome-ai') {
    const aiModel = getChromeAiInterface();
    if (!aiModel || !state.chromeAiAvailable) {
      throw new Error(t('chrome_ai_not_available_error'));
    }
    
    // Create new LanguageModel session for isolation with language options & download monitor
    const targetLang = state.lang === 'ja' ? 'ja' : 'en';
    const sessionOptions = {
      temperature: llmConfig.temperature,
      expectedInputLanguages: ['en', 'ja', 'es', 'fr', 'de'],
      outputLanguage: targetLang,
      monitor(m) {
        if (m && typeof m.addEventListener === 'function') {
          m.addEventListener('downloadprogress', (e) => {
            const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
            log(t('chrome_ai_download_progress', { pct, loaded: e.loaded, total: e.total }), 'info');
          });
        }
      }
    };
    let effectiveSystemPrompt = systemPrompt || '';
    let toolsPayload = options.tools;
    if (!toolsPayload && options.enableTools) {
      toolsPayload = getAllAvailableToolsForOpenAi();
    }

    if (options.enableTools && toolsPayload && Array.isArray(toolsPayload) && toolsPayload.length > 0) {
      const toolDescs = toolsPayload.map(t => {
        const fn = t.function || t;
        const params = fn.parameters ? ` (Parameters: ${JSON.stringify(fn.parameters.properties || {})})` : '';
        return `- ${fn.name}: ${fn.description || ''}${params}`;
      }).join('\n');

      const exampleTool = toolsPayload[0]?.function?.name || 'js_sandbox';
      const exampleArg = exampleTool === 'js_sandbox' ? '123 * 456' : (exampleTool === 'read_file' ? 'app.js' : 'input_value');

      const reactInstruction = `\n\n[CRITICAL INSTRUCTION - TOOL CALLING MANDATE]
Do NOT answer, calculate, or generate natural language explanations yourself.
You MUST select an appropriate tool from the list below and respond ONLY using the exact ReAct format below.

[Available Tools]
${toolDescs}

[Required Response Format]
Action: <tool_name>
Action Input: <input_code_or_args>

[FEW-SHOT EXAMPLE]
User: Compute 123 * 456
Assistant:
Action: ${exampleTool}
Action Input: ${exampleArg}`;

      effectiveSystemPrompt += reactInstruction;
      log(
        state.lang === 'en'
          ? `Injected Few-shot ReAct Tool Mandate (${toolsPayload.length} tools) into Chrome AI system prompt.`
          : `Chrome AI システムプロンプトに Few-shot 応答例付き ReAct ツール定義 (${toolsPayload.length} 個) を自動注入しました。`,
        'info',
        `[Injected ReAct System Instruction]\n${reactInstruction}`
      );
    }


    if (effectiveSystemPrompt) {
      sessionOptions.systemPrompt = effectiveSystemPrompt;
    }
    
    log(t('chrome_ai_executing'), 'info');

    
    const startTime = performance.now();
    let session;
    if (typeof aiModel.create === 'function') {
      session = await aiModel.create(sessionOptions);
    } else {
      // Direct session instantiation fallback
      session = await aiModel(sessionOptions);
    }
    
    log(t('chrome_ai_session_created', { temp: llmConfig.temperature, lang: targetLang }), 'info');
    
    try {
      const promptText = canonicalMessages
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const fullPromptPayload = promptText || String(userPrompt);
      log(t('chrome_ai_prompt_sending', { chars: fullPromptPayload.length }), 'info', fullPromptPayload);

      if (typeof session.prompt === 'function') {
        responseContent = await session.prompt(fullPromptPayload);
      } else if (typeof session.execute === 'function') {
        responseContent = await session.execute(fullPromptPayload);
      } else {
        throw new Error('Unsupported Chrome AI session API version.');
      }

      const duration = Math.round(performance.now() - startTime);
      log(t('chrome_ai_query_completed', { duration, chars: (responseContent || '').length }), 'success', responseContent);
    } finally {
      if (session && typeof session.destroy === 'function') {
        session.destroy(); // Always cleanup sessions
        log(t('chrome_ai_session_destroyed'), 'info');
      }
    }
  } else {
    // External OpenAI-compatible API call
    let rawEndpoint = llmConfig.endpoint;
    if (!rawEndpoint) {
      throw new Error(state.lang === 'en' ? 'API Endpoint URL is not configured in settings or session override.' : 'APIエンドポイントURLが設定されていません。');
    }
    
    let endpoint = rawEndpoint;
    if (endpoint.endsWith('/')) {
      endpoint = endpoint.slice(0, -1);
    }
    if (endpoint.endsWith('/chat/completions')) {
      endpoint = endpoint.slice(0, -17);
    }
    
    const headers = { 'Content-Type': 'application/json' };
    if (llmConfig.apiKey) {
      headers['Authorization'] = `Bearer ${llmConfig.apiKey}`;
    }
    
    let selectedModel = llmConfig.model;
    if (!selectedModel) {
      const datalist = document.getElementById ? document.getElementById('settings-model-datalist') : null;
      if (datalist && datalist.options && datalist.options.length > 0) {
        selectedModel = datalist.options[0].value;
      } else {
        selectedModel = 'qwen2.5-coder:7b';
      }
    }
    
    const body = {
      model: selectedModel,
      messages: canonicalMessages.map(m => ({ role: m.role, content: m.content })),
      temperature: llmConfig.temperature
    };

    // Inject tool definitions for OpenAI Function Calling if provided or enabled
    let toolsPayload = options.tools;
    if (!toolsPayload && options.enableTools) {
      toolsPayload = getAllAvailableToolsForOpenAi();
    }
    if (toolsPayload && Array.isArray(toolsPayload) && toolsPayload.length > 0) {
      body.tools = toolsPayload;
      if (options.requireToolCall) {
        body.tool_choice = 'required';
      }
    }


    const loggedHeaders = { ...headers };
    if (loggedHeaders['Authorization']) {
      loggedHeaders['Authorization'] = 'Bearer ******'; // Mask API Key
    }

    console.log(`[External API Endpoint] POST ${endpoint}/chat/completions`);
    console.log(`[External API Headers]`, loggedHeaders);
    console.log(`[Canonical Messages]`, canonicalMessages);
    console.log(`[External API Request Body]`, body);

    log(
      state.lang === 'en'
        ? `Sending query to External API via endpoint: ${endpoint}`
        : `外部APIエンドポイント: ${endpoint} へクエリを送信中...`,
      'http',
      `[POST Endpoint] ${endpoint}/chat/completions\n\n[Headers]\n${JSON.stringify(loggedHeaders, null, 2)}\n\n[Request Body]\n${JSON.stringify(body, null, 2)}`
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
            ? (errorData.error.message || JSON.stringify(errorData.error, null, 2)) 
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

    const messagePayload = data.choices[0].message;
    responseContent = messagePayload.content || '';
    if (messagePayload.tool_calls && Array.isArray(messagePayload.tool_calls) && messagePayload.tool_calls.length > 0) {
      toolCalls = messagePayload.tool_calls;
    }
  }

  console.log(`[LLM Query Response]\n`, responseContent, toolCalls);

  log(
    state.lang === 'en' ? 'LLM response received successfully.' : 'LLMからの応答を受信しました。',
    'http',
    `[Response Content]\n${responseContent || '(No plain text output)'}${toolCalls ? `\n\n[Tool Calls Received]\n${JSON.stringify(toolCalls, null, 2)}` : ''}`
  );
  if (options.returnStructured) {
    if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
      return { type: 'tool_calls', content: responseContent, tool_calls: toolCalls };
    }
    return { type: 'text', content: responseContent };
  }

  return responseContent;
}
