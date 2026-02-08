---
name: ingest
description: Build and run ingestion pipeline for language specs
user-invocable: true
allowed-tools: Bash, Read
---

# Ingestion Pipeline

Build and run the language spec ingestion pipeline.

## Steps

1. **Build**: Run `npm run build` and verify success
2. **Ingest**: Run `npm run ingest` with optional language flag
   - If `$ARGUMENTS` contains a language name (e.g., `go`), run: `npm run ingest -- --language <lang>`
   - If no arguments, run: `npm run ingest`
3. **Report**: Summarize the ingestion output (inserted/updated/unchanged counts)

## Error Handling
- If build fails, stop and report the TypeScript errors
- If ingest fails, report the error and suggest checking the source URL or network
