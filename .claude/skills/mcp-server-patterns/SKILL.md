---
name: mcp-server-patterns
description: MCP SDK patterns for TypeScript stdio servers
---

# MCP Server Patterns (@modelcontextprotocol/sdk v1.26.0)

## Server Setup
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'server-name', version: '1.0.0' },
  { capabilities: { tools: {} } }
);
```

## Tool Registration (setRequestHandler pattern)
```typescript
// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'tool_name',
    description: 'What the tool does',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query']
    }
  }]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  // Route to handler...
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
  };
});
```

## Tool Result Format
Always return: `{ content: [{ type: "text", text: string }] }`
For errors: `{ content: [{ type: "text", text: "Error: ..." }], isError: true }`

## Start Transport
```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[Server] Started'); // NEVER console.log
```

## Critical: stdio Transport
- NEVER use `console.log()` — it writes to stdout and breaks JSON-RPC
- Use `console.error()` for all logging
- stdin/stdout are reserved for MCP protocol communication
