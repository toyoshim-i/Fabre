// Model Context Protocol (MCP) Client Engine & Transport Manager
// Protocol Spec: JSON-RPC 2.0 (tools/list, tools/call)
'use strict';

import { state, addLog } from './state.js';
import { t } from './i18n.js';

/**
 * Register a new MCP Server URL and discover its available tools
 * @param {string} url Endpoint URL (e.g. http://localhost:3000/sse or http://localhost:8080/mcp)
 * @param {string} name Human-readable server alias
 */
export async function registerMcpServer(url, name) {
  if (!url || !url.trim()) return null;
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const serverName = name && name.trim() ? name.trim() : `MCP_${Date.now().toString(36).substr(-4)}`;

  const existing = state.mcpServers.find(s => s.url === cleanUrl);
  if (existing) {
    addLog(t('mcp_server_already_exists', { name: existing.name }), 'warning');
    return existing;
  }

  const server = {
    id: `mcp_srv_${Date.now()}`,
    name: serverName,
    url: cleanUrl,
    status: 'connecting',
    tools: [],
    addedAt: new Date().toISOString()
  };

  state.mcpServers.push(server);
  state.emit('mcpServersChanged', state.mcpServers);

  try {
    const tools = await fetchMcpTools(cleanUrl);
    server.status = 'connected';
    server.tools = tools;
    addLog(t('mcp_connected_success', { name: serverName, count: tools.length }), 'success');
  } catch (err) {
    server.status = 'error';
    server.error = err.message;
    addLog(t('mcp_connect_failed', { name: serverName, error: err.message }), 'error');
  }

  updateGlobalMcpTools();
  state.emit('mcpServersChanged', state.mcpServers);
  return server;
}

/**
 * Remove an MCP server from configuration
 * @param {string} serverId Server ID
 */
export function removeMcpServer(serverId) {
  state.mcpServers = state.mcpServers.filter(s => s.id !== serverId);
  updateGlobalMcpTools();
  state.emit('mcpServersChanged', state.mcpServers);
}

/**
 * Fetch available tools from an MCP endpoint via JSON-RPC 2.0 tools/list request
 * @param {string} serverUrl Endpoint URL
 * @returns {Promise<Array>} Array of tool schema objects
 */
export async function fetchMcpTools(serverUrl) {
  const jsonRpcPayload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/list',
    params: {}
  };

  const response = await fetch(`${serverUrl}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jsonRpcPayload)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to reach MCP server`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'JSON-RPC Error in tools/list');
  }

  const tools = (data.result && data.result.tools) || [];
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description || '',
    inputSchema: tool.inputSchema || { type: 'object', properties: {} }
  }));
}

/**
 * Call a remote tool on an MCP server via JSON-RPC 2.0 tools/call request
 * @param {string} serverUrl MCP Endpoint URL
 * @param {string} toolName Name of the tool to execute
 * @param {object|string} args Tool arguments
 * @returns {Promise<string>} Tool execution result string
 */
export async function callMcpTool(serverUrl, toolName, args = {}) {
  let parsedArgs = args;
  if (typeof args === 'string') {
    try {
      parsedArgs = JSON.parse(args);
    } catch (e) {
      parsedArgs = { input: args };
    }
  }

  const jsonRpcPayload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: parsedArgs
    }
  };

  addLog(t('mcp_executing_tool', { tool: toolName, url: serverUrl }), 'info');

  const response = await fetch(`${serverUrl}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jsonRpcPayload)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: MCP Tool Execution failed`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || `MCP Error executing ${toolName}`);
  }

  const contentList = data.result && data.result.content;
  if (Array.isArray(contentList)) {
    return contentList.map(item => item.text || item.content || JSON.stringify(item)).join('\n');
  }

  return typeof data.result === 'object' ? JSON.stringify(data.result) : String(data.result || 'Success');
}

/**
 * Aggregate all tools from connected MCP servers into state.mcpTools
 */
export function updateGlobalMcpTools() {
  const allTools = [];
  state.mcpServers.forEach(server => {
    if (server.status === 'connected' && Array.isArray(server.tools)) {
      server.tools.forEach(tool => {
        allTools.push({
          serverUrl: server.url,
          serverName: server.name,
          fullId: `mcp:${server.name}:${tool.name}`,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        });
      });
    }
  });

  state.mcpTools = allTools;
  state.emit('mcpToolsChanged', state.mcpTools);
}

/**
 * Convert all registered MCP tools into OpenAI Function Calling `tools` JSON Schema payload
 */
export function getMcpToolsForOpenAi() {
  return state.mcpTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || `MCP Tool from ${tool.serverName}`,
      parameters: tool.inputSchema || { type: 'object', properties: {} }
    }
  }));
}
