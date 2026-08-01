// Pure Node.js MCP (Model Context Protocol) HTTP JSON-RPC 2.0 Test Server
// Run with: node samples/mcp-test-server.js
// Endpoint: http://localhost:3000/mcp

const http = require('http');

const PORT = 3000;

// Registered Test MCP Tools
const TOOLS = [
  {
    name: 'calculate_sum',
    description: 'Calculate the sum of two numbers (a + b)',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'fetch_mock_weather',
    description: 'Get current weather report for a specified location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City or location name' }
      },
      required: ['location']
    }
  },
  {
    name: 'get_system_status',
    description: 'Retrieve current server uptime and system load status',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

const server = http.createServer((req, res) => {
  // CORS Headers for Browser Access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'Fabre Test MCP Server Running', port: PORT }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      const payload = JSON.parse(body || '{}');
      const { jsonrpc, id, method, params } = payload;

      console.log(`[MCP Server Request] Method: ${method}, ID: ${id}`);

      // 1. Tool Discovery Request (tools/list)
      if (method === 'tools/list') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: id,
          result: {
            tools: TOOLS
          }
        }));
        return;
      }

      // 2. Tool Execution Request (tools/call)
      if (method === 'tools/call') {
        const toolName = params && params.name;
        const args = (params && params.arguments) || {};
        let resultText = '';

        if (toolName === 'calculate_sum') {
          const sum = (Number(args.a) || 0) + (Number(args.b) || 0);
          resultText = `Result of ${args.a} + ${args.b} = ${sum}`;
        } else if (toolName === 'fetch_mock_weather') {
          resultText = `Weather for ${args.location || 'Tokyo'}: Sunny, 24°C, Wind: 5km/h South`;
        } else if (toolName === 'get_system_status') {
          resultText = `System Status: OK | Uptime: ${Math.floor(process.uptime())}s | Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`;
        } else {
          resultText = `Executed tool '${toolName}' with arguments: ${JSON.stringify(args)}`;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: id,
          result: {
            content: [
              { type: 'text', text: resultText }
            ]
          }
        }));
        return;
      }

      // Unknown Method
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: id,
        error: { code: -32601, message: `Method '${method}' not found` }
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: `Parse Error: ${err.message}` }
      }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Fabre Test MCP Server is running!`);
  console.log(`📍 Endpoint URL: http://localhost:${PORT}/mcp`);
  console.log(`🛠️ Available Tools: calculate_sum, fetch_mock_weather, get_system_status`);
  console.log(`====================================================`);
});
