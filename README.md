# langspec-mcp

Programming language specification search and citation server, built on [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

Fetches official language specs, indexes them with SQLite FTS5, and exposes structured search tools for AI assistants like Claude.

## Features

- **Multi-language support** — Go, Java, Rust, TypeScript indexed from official sources
- **Full-text search** with BM25 ranking across language specification sections
- **Structured citations** with section paths, canonical URLs, and contextual snippets
- **Diff-based re-indexing** — only updates changed sections on re-ingestion
- **Stable section IDs** — headings without HTML anchors get deterministic IDs
- **Source policy control** — configurable excerpt-only or full-text access per language
- **Weekly learning plans** — auto-generated study schedules from spec TOC

## Supported Languages

| Language | Source | Sections | Strategy |
|----------|--------|----------|----------|
| Go | [The Go Programming Language Specification](https://go.dev/ref/spec) | ~162 | Single HTML |
| Java | [The Java Language Specification (SE21)](https://docs.oracle.com/javase/specs/jls/se21/html/index.html) | ~575 | Multi-page HTML (19 chapters) |
| Rust | [The Rust Reference](https://doc.rust-lang.org/reference/) | ~1,401 | GitHub Markdown (119 files) |
| TypeScript | [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/) | ~178 | GitHub Markdown (10 files) |

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

### Index Language Specs

```bash
# Index Go specification (default)
npm run ingest

# Specify a language
npm run ingest -- --language go
npm run ingest -- --language rust
npm run ingest -- --language java
npm run ingest -- --language typescript

# Index all languages at once
npm run ingest -- --language all
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
[
  { "language": "go", "docs": ["go-spec"] },
  { "language": "java", "docs": ["jls"] },
  { "language": "rust", "docs": ["rust-reference"] },
  { "language": "typescript", "docs": ["ts-handbook"] }
]
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

### `build_learning_plan`

Generate a weekly learning plan from the specification table of contents.

```json
// Input
{
  "language": "rust",
  "total_weeks": 6,
  "focus_areas": ["Types", "Traits"]
}

// Output
{
  "language": "rust",
  "version": "snapshot-20260208",
  "total_weeks": 6,
  "total_sections": 1401,
  "weeks": [
    {
      "week": 1,
      "theme": "Introduction, Notation",
      "sections": ["..."],
      "estimated_minutes": 45
    }
  ]
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
├── config/
│   └── languages.ts      # LanguageConfig registry (4 languages)
├── index.ts              # CLI entry point (ingest / serve)
├── server.ts             # MCP server + tool registration
├── types.ts              # TypeScript types + Zod schemas
├── db/
│   ├── schema.ts         # Database initialization + migrations
│   └── queries.ts        # Query methods + snippet extraction
├── ingestion/
│   ├── index.ts          # Pipeline orchestrator
│   ├── fetcher.ts        # Multi-strategy fetch (HTML / GitHub Markdown)
│   ├── parser.ts         # HTML + Markdown → structured sections
│   └── normalizer.ts     # Section normalization + canonical URLs
└── tools/
    ├── list-languages.ts
    ├── list-versions.ts
    ├── search-spec.ts
    ├── get-section.ts
    └── build-learning-plan.ts
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

# Run tests
npm test

# Re-index (diff-based — skips unchanged sections)
npm run ingest
```

## Roadmap

- [x] **M1**: Go spec + stdio MCP server + SQLite/FTS5
- [x] **M2**: Citation precision (diff-based re-index, snippets, stable IDs, source policy)
- [x] **M3**: `build_learning_plan` tool (weekly study plans from TOC)
- [x] **M4**: Multi-language support (Go, Java, Rust, TypeScript)
- [ ] **M5**: Non-functional (caching, rate limiting, observability, LAN auth)

## License

MIT
