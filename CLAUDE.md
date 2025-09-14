# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WordSmith is an AI-powered writing assistant plugin for Obsidian that provides inline text suggestions, transformations, and generation capabilities. The plugin supports multiple AI providers (OpenAI, Anthropic, Google, OpenRouter, local servers) and offers features like context-aware text processing, knowledge graph generation, and customizable prompts.

## Build and Development Commands

Use the `just` command runner for development tasks:

- **Build for development**: `just build-and-reload` - Builds the plugin and copies to test vault, then reloads Obsidian
- **Build only**: `node .esbuild.mjs` - Compiles TypeScript to main.js using esbuild
- **Code quality checks**: `just check-all` - Runs Biome linting, TypeScript compilation, and Markdownlint
  - Individual checks: `just check-tsc-qf` (TypeScript only)
- **Bundle analysis**: `just analyze` - Generates bundle size analysis
- **Release**: `just release` - Automated versioning and release process
- **Initialize project**: `just init` - Sets up git hooks and installs dependencies

**IMPORTANT**: Always run `just check-all` before committing changes. The pre-commit hook may not always trigger in all environments.

## Code Architecture

### Core Structure
- **Entry point**: `src/main.ts` - Main plugin class extending Obsidian's Plugin
- **Core logic**: 
  - `src/lib/core/textTransformer.ts` - Text transformation and AI interaction logic
  - `src/lib/core/graphGenerator.ts` - Knowledge graph generation using d3-force
- **Editor integration**: `src/lib/editor/` - CodeMirror6 extensions and suggestion handling
- **UI components**: `src/ui/` - Settings panels, modals, and context control panel
- **Services**: `src/services/` - Provider management, model selection, and favorites
- **LLM integration**: `src/llm/` - AI provider abstractions and prompt building

### Key Architectural Patterns
- **Service-oriented**: Core functionality split into service classes (ModelService, CustomProviderService, FavoritesService)
- **Settings management**: Centralized in `src/lib/settings-data.ts` with type-safe interfaces
- **CodeMirror6 integration**: Custom extensions for inline suggestions and decorations
- **Provider abstraction**: Unified interface for different AI providers with dynamic model loading
- **Context system**: Flexible context control (dynamic, full note, custom, section-based)

### Build System
- **Bundler**: esbuild with TypeScript compilation to ES2022
- **Linting**: Biome with comprehensive rules (all rules enabled with specific overrides)
- **Type checking**: Strict TypeScript configuration based on strictest.json
- **Obsidian compatibility**: Excludes Obsidian and CodeMirror modules from bundle

### Development Workflow
The plugin uses hot-reloading during development via the `just build-and-reload` command, which automatically copies files to a test vault and triggers Obsidian to reload the plugin using a custom URI scheme.

### Testing and Quality
- TypeScript strict mode with comprehensive checks
- Biome linting with nearly all rules enabled
- Markdownlint for documentation consistency
- Bundle analysis for performance monitoring