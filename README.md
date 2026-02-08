# langspec-mcp

Programming language specification search and citation server, built on [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

Fetches official language specs, indexes them with SQLite FTS5, and exposes structured search tools for AI assistants like Claude.

## Features

- **Full-text search** with BM25 ranking across language specification sections
- **Structured citations** with section paths, canonical URLs, and contextual snippets
- **Diff-based re-indexing** — only updates changed sections on re-ingestion
- **Stable section IDs** — headings without HTML anchors get deterministic IDs
- **Source policy control** — configurable excerpt-only or full-text access per language

## Supported Languages

| Language | Source | Status |
|----------|--------|--------|
| Go | [The Go Programming Language Specification](https://go.dev/ref/spec) | Available |
| Java | JLS / JVMS | Planned (M4) |
| Rust | The Rust Reference | Planned (M4) |
| TypeScript | Handbook + ECMA-262 | Planned (M4) |

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Install & Build

```bash
git clone <repository-url>
cd langspec-mcp
npm install
npm run build
```

### Index a Language Spec

```bash
# Index Go specification (default)
npm run ingest

# Explicitly specify language
npm run ingest -- --language go
```

Output:
```
[Ingestion] Summary: 162 inserted, 0 updated, 0 unchanged
```

### Start the MCP Server

```bash
npm run serve
```

The server communicates via stdio using JSON-RPC 2.0.

## MCP Tools

### `list_languages`

List all indexed languages and their documents.

```json
// Input
{}

// Output
[{ "language": "go", "docs": ["go-spec"] }]
```

### `list_versions`

List available versions for a language.

```json
// Input
{ "language": "go" }

// Output
[{ "version": "snapshot-20260208", "fetched_at": "2026-02-08T...", "source_url": "https://go.dev/ref/spec" }]
```

### `search_spec`

Full-text search across specification sections.

```json
// Input
{
  "query": "goroutine",
  "language": "go",
  "filters": { "limit": 5 }
}

// Output — array of citations with snippets centered on query matches
[{
  "section_id": "Go_statements",
  "title": "Go statements",
  "section_path": "Statements > Go statements",
  "url": "https://go.dev/ref/spec#Go_statements",
  "snippet": { "text": "...A \"go\" statement starts the execution of a function call as an independent concurrent thread of control, or goroutine...", "start_char": 0, "end_char": 300 },
  "score": -8.23
}]
```

### `get_section`

Retrieve full details for a specific section.

```json
// Input
{ "language": "go", "version": "snapshot-20260208", "section_id": "Go_statements" }

// Output
{
  "citation": { "..." },
  "content": {
    "excerpt": "A \"go\" statement starts...",
    "is_truncated": false,
    "fulltext_available": false
  }
}
```

## Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "langspec": {
      "command": "node",
      "args": ["/absolute/path/to/langspec-mcp/dist/index.js", "serve"]
    }
  }
}
```

## Project Structure

```
src/
├── index.ts              # CLI entry point (ingest / serve)
├── server.ts             # MCP server + tool registration
├── types.ts              # TypeScript types + Zod schemas
├── db/
│   ├── schema.ts         # Database initialization + migrations
│   └── queries.ts        # Query methods + snippet extraction
├── ingestion/
│   ├── index.ts          # Pipeline orchestrator
│   ├── fetcher.ts        # HTTP fetch with ETag support
│   ├── parser.ts         # HTML → structured sections (cheerio)
│   └── normalizer.ts     # Section normalization + hashing
└── tools/
    ├── list-languages.ts
    ├── list-versions.ts
    ├── search-spec.ts
    └── get-section.ts
```

## Tech Stack

- **TypeScript** (ES modules)
- **@modelcontextprotocol/sdk** — MCP server framework
- **better-sqlite3** + **FTS5** — Storage and full-text search
- **cheerio** — HTML parsing
- **zod** — Input validation

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Re-index (diff-based — skips unchanged sections)
npm run ingest
```

## Roadmap

- [x] **M1**: Go spec + stdio MCP server + SQLite/FTS5
- [x] **M2**: Citation precision (diff-based re-index, snippets, stable IDs, source policy)
- [ ] **M3**: `build_learning_plan` tool (weekly study plans from TOC)
- [ ] **M4**: Language expansion (Java, Rust, TypeScript)
- [ ] **M5**: Non-functional (caching, rate limiting, observability, LAN auth)

## License

MIT
