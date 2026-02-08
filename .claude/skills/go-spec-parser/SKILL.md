---
name: go-spec-parser
description: Go language specification HTML structure and parsing patterns
---

# Go Spec HTML Structure

## Source
- URL: `https://go.dev/ref/spec`
- Single page, all sections in one HTML document
- Stable anchor IDs

## Heading Structure
- **h2**: Top-level sections (e.g., `<h2 id="Lexical_elements">`)
- **h3**: Subsections (e.g., `<h3 id="Semicolons">`)
- **h4**: Sub-subsections (e.g., `<h4 id="Basic_interfaces">`)

## Anchor ID Pattern
- PascalCase with underscores: `#Lexical_elements`, `#Semicolons`, `#Type_parameter_declarations`
- Derived from heading text: spaces → underscores, case preserved

## Top-Level Sections (h2)
Introduction, Notation, Source_code_representation, Lexical_elements,
Constants, Variables, Types, Properties_of_types_and_values, Blocks,
Declarations_and_scope, Expressions, Statements, Built-in_functions,
Packages, Program_initialization_and_execution, Errors, Run_time_panics,
System_considerations, Appendix

## Section Path Construction
Build hierarchical path using a stack:
```
h2: "Lexical elements"     → path: "Lexical elements"
  h3: "Semicolons"         → path: "Lexical elements > Semicolons"
  h3: "Identifiers"        → path: "Lexical elements > Identifiers"
h2: "Types"                → path: "Types"
  h3: "Array types"        → path: "Types > Array types"
    h4: "Basic interfaces" → path: "Types > Interface types > Basic interfaces"
```

## Content Extraction
- For each heading: collect all sibling elements until the next heading of same or higher level
- Text content of paragraphs, code blocks, lists, tables
- Strip HTML tags for fulltext indexing

## Language Version Markers
- Pattern: `[Go 1.18]` linking to `#Language_versions`
- Present throughout the spec to indicate when features were introduced
- Useful for version-aware searching

## Section ID: stableId Fallback
Not all headings in the Go spec have an `id` attribute. For headings without `id`:
- Generate a stable hash from the heading text content
- Format: `heading-<hash>` (e.g., `heading-a1b2c3d4`)
- This ensures consistent section_id across re-ingestion runs
- Implementation in `parser.ts`: check `elem.attribs.id` first, fall back to hash

## Canonical URL
`https://go.dev/ref/spec#${anchor_id}`
