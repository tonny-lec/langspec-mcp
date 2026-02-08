import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type Database from 'better-sqlite3';
import {
  ListLanguagesInputSchema,
  ListVersionsInputSchema,
  SearchSpecInputSchema,
  GetSectionInputSchema,
  BuildLearningPlanInputSchema,
} from './types.js';
import { getSupportedLanguages } from './config/languages.js';
import { listLanguages } from './tools/list-languages.js';
import { listVersions } from './tools/list-versions.js';
import { searchSpec } from './tools/search-spec.js';
import { getSection } from './tools/get-section.js';
import { buildLearningPlan } from './tools/build-learning-plan.js';

export async function startServer(db: Database.Database): Promise<void> {
  const server = new Server(
    { name: 'langspec-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  const languageEnum = getSupportedLanguages();

  // -- List Tools --
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'list_languages',
        description: 'List all available programming languages with indexed specifications',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      {
        name: 'list_versions',
        description: 'List all available versions for a specific language specification',
        inputSchema: {
          type: 'object' as const,
          properties: {
            language: {
              type: 'string',
              enum: languageEnum,
              description: 'Programming language',
            },
          },
          required: ['language'],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      {
        name: 'search_spec',
        description: 'Search language specification sections using full-text search. Returns citations with scores and snippets.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'Search query' },
            language: {
              type: 'string',
              enum: languageEnum,
              description: 'Programming language',
            },
            version: { type: 'string', description: 'Spec version (optional, defaults to latest)' },
            filters: {
              type: 'object',
              properties: {
                doc: { type: 'string', description: 'Filter by document name' },
                section_path_prefix: { type: 'string', description: 'Filter by section path prefix' },
                limit: { type: 'number', minimum: 1, maximum: 50, description: 'Max results (default: 10)' },
              },
              additionalProperties: false,
            },
          },
          required: ['query', 'language'],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      {
        name: 'get_section',
        description: 'Get full details and content for a specific specification section by its ID',
        inputSchema: {
          type: 'object' as const,
          properties: {
            language: {
              type: 'string',
              enum: languageEnum,
              description: 'Programming language',
            },
            version: { type: 'string', description: 'Spec version' },
            section_id: { type: 'string', description: 'Section identifier (anchor ID)' },
          },
          required: ['language', 'version', 'section_id'],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      {
        name: 'build_learning_plan',
        description: 'Generate a weekly learning plan from the specification table of contents. Distributes sections into balanced weeks by content volume.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            language: {
              type: 'string',
              enum: languageEnum,
              description: 'Programming language',
            },
            version: { type: 'string', description: 'Spec version (optional, defaults to latest)' },
            total_weeks: {
              type: 'number',
              minimum: 1,
              maximum: 12,
              description: 'Number of weeks for the plan (default: 4)',
            },
            focus_areas: {
              type: 'array',
              items: { type: 'string' },
              description: 'Topic names to prioritize (e.g. ["Types", "Expressions"])',
            },
          },
          required: ['language'],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
    ],
  }));

  // -- Call Tool --
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'list_languages': {
          ListLanguagesInputSchema.parse(args);
          const result = listLanguages(db);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        }

        case 'list_versions': {
          const params = ListVersionsInputSchema.parse(args);
          const result = listVersions(db, params.language);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        }

        case 'search_spec': {
          const params = SearchSpecInputSchema.parse(args);
          const result = searchSpec(db, params);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        }

        case 'get_section': {
          const params = GetSectionInputSchema.parse(args);
          const result = getSection(db, params);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        }

        case 'build_learning_plan': {
          const params = BuildLearningPlanInputSchema.parse(args);
          const result = buildLearningPlan(db, params);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        }

        default:
          return {
            content: [{ type: 'text' as const, text: `Error: Unknown tool "${name}"` }],
            isError: true,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Server] langspec-mcp started via stdio');
}
