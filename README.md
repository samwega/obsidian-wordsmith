# WordSmith - AI Writing Assistant for Obsidian

**Current Version:** 3.2.0

WordSmith is the ultimate AI-powered writing assistant for Obsidian—your all-in-one tool for seamless editing, contextual content generation, effortless refinement, and knowledge graphs generation, right inside your notes. It excels at **stylistic improvements**, **proofreading**, **translation**, and **prompt-based generation**—all *context-aware*!

**Review and accept or reject individual AI suggestions inline** directly in your editor. Leverage a modular user prompt construction and mangement System, powered by a dynamic provider framework giving you access to **over 400 models** from OpenAI, Anthropic, Google, OpenRouter, and even local AI servers like Ollama & LM Studio, and benefit from advanced context control—all fully keyboard-driven. Use your own API keys and only spend what you use, plus a [coffee for me](https://revolut.me/alexanderglavan) if you love my first plugin!

Initially forked from the narrowly focused [obsidian-proofreader](https://github.com/chrisgrieser/obsidian-proofreader) by Christopher Grieser, WordSmith has evolved into a feature-complete AI writing assistant.

![WordSmith suggestions in action](https://github.com/user-attachments/assets/55831bae-bc4b-4a4a-9448-cf1bc1fb5787)

![WordSmith shorten prompt](https://github.com/user-attachments/assets/0ad1de0f-0d62-4710-9afd-26c1d8ba38a5)


## Features

* **Inline AI suggestions**: additions as "ghost text" & addition/deletion highlighting are rendered as CodeMirror6 decorations (doesn't modify your text in any way unless you accept)
* **Granular suggestion management**: accept/reject per-suggestion, selection/paragraph, or all  
* **User & Preset Prompt Palette** for text transformation (improve, shorten, lengthen, fix grammar, refine structure, translate, and many more, or user defined ones
* Ad-hoc **Generation at Cursor** with prompt input
* **All Processing and Generation is Context-Aware**—the AI doesn't just receive the selected text to be processed or the prompt: you include as much (or as little) context as you wish  
* **Context control in Side Pane:**
  * Dynamic Context (configurable lines before and after)
  * Whole Note
  * Custom Context (including embedded note linking with [[wikilinks]]!)  
* **Keyboard-first workflow**: hotkeys for all main actions and suggestion navigation  
* **BYOK:** Bring your own API keys—only pay what you use  
* **ALL AI providers supported**—OpenAI, Anthropic, Google AI Studio, OpenRouter (400+ models!), and more
* **ALL AI local models supported**—through Ollama, LM Studio, or anything else
* **Automatically Generate Canvas Knowledge Graphs** based on your notes!
* **Great Prompt Management Settings UI:** enable/disable prompts or create new one
* Robust error handling, performance
* **Theme-Adaptive Styles** (detects dark/light Obsidian theme)
* **Multilingual**—the AI should autodetect the language from Context, selection and/or ad-hoc prompt, and return suggestions in the same language
* **Full Runtime Debug Logging in Console**
* Manual and (planned) community plugin installation
* Many more! Check the [WordSmith Wiki](https://github.com/samwega/obsidian-wordsmith/wiki) for more tricks and uses.

![WordSmith Settings and Context Side Pane](https://github.com/user-attachments/assets/dad71548-0cf3-48fa-99e7-b86967b282d2)

## Table of contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
- [WordSmith - AI Writing Assistant for Obsidian](#wordsmith---ai-writing-assistant-for-obsidian)
  - [Features](#features)
  - [Table of contents](#table-of-contents)
  - [Usage](#usage)
    - [Commands](#commands)
    - [Using the AI Context Control Panel](#using-the-ai-context-control-panel)
    - [Customizing Prompts](#customizing-prompts)
    - [API Key Setup, AI Providers \& Models Info](#api-key-setup-ai-providers--models-info)
  - [Release History](#release-history)
    - [w͜s Verion 3.2.0 - New Feature: Current Section (by markdown header) Option in Context Menu](#w͜s-verion-320---new-feature-current-section-by-markdown-header-option-in-context-menu)
    - [w͜s Version v3.0.0 - New Feature: 400+ Models \& Local AI Provider Support](#w͜s-version-v300---new-feature-400-models--local-ai-provider-support)
      - [Minor Versions of v.3.1.x](#minor-versions-of-v31x)
    - [w͜s What's New in v2.2.0 - Knowledge Graph Generation](#w͜s-whats-new-in-v220---knowledge-graph-generation)
      - [Minor Versions of v.2.2.x](#minor-versions-of-v22x)
    - [w͜s What's New in v2.1.0 - Context Panel Save State Across Sessions](#w͜s-whats-new-in-v210---context-panel-save-state-across-sessions)
      - [Minor Versions of v.2.1.x](#minor-versions-of-v21x)
  - [Installation \& Setup](#installation--setup)
    - [Manual Installation](#manual-installation)
    - [Plugin Installation (via Community Store)](#plugin-installation-via-community-store)
  - [About the Developer](#about-the-developer)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Usage

WordSmith is designed for a keyboard-centric workflow. Configure your preferred hotkeys in Obsidian's settings for the commands below. In the screenshot you can see a workable suggested setup, but feel free to make it your own:

![WordSmith - Add Model Providers Settings](https://github.com/user-attachments/assets/5c88c1d0-75c3-40f0-bf43-7c3de8f100c1)

Check out the [WordSmith Wiki](https://github.com/samwega/obsidian-wordsmith/wiki) for more advanced use guides.

### Commands

1. `WordSmith: Open Al Context Control Panel`: no need to hotkey this, just trigger it once from the drop-down menu to add it to the Side Panel (then move it wherever)
2. `WordSmith: Transform selection/paragraph`: This is your main command.
    * If you have text selected, it will be used for transformation.
    * If no text is selected, the current paragraph (where your cursor is) will be targeted.
    * Invoking this command opens the Prompt Palette, allowing you to choose from enabled default and custom prompts.
3. `WordSmith: Prompt Based Context Aware Generation at Cursor`: set up your context, type a prompt, et voilà! Type `[[` to include any note in your context.
4. `WordSmith Accept/Reject next suggestion`:  whether your next (highlighted) suggestion is red (to be removed) or green (to be added), you can accept or reject it with these commands
5. `WordSmith Accept/Reject in selection/paragraph`: accept/reject the whole paragraph where the cursor currently is
6. `WordSmith: Focus previous/next suggestion`: moves the cursor at the beginning of the next/previous suggestion, highlighting it (brighter, with glowing border)
7. `WordSmith: Clear all active suggestions (reject all)`: reject all the *remaining* suggestions. Note: suggestions that have already been accepted or rejected will not be undone. You can use Ctrl-Z to undo those.

### Using the AI Context Control Panel

The AI Context Control Panel allows you to manage what contextual information is sent to the AI with your text.

**How to Open the Panel:**

1. **Plugin Enable State:** Make sure the WordSmith plugin is enabled in `Settings` -> `Community plugins`. The icon and panel will only be available if the plugin is active.
2. **Command Palette:** Search in the command palette (usually `Ctrl/Cmd+P`) for the command `"WordSmith: Open AI Context Control Panel"`.

Once the panel is open, you can drag its icon to reorder is, or drag the panel itself to different parts of your workspace (e.e., left sidebar, right sidebar, or even as a new tab in the main workspace).

**Panel Options:**

Once open, you can use the toggles for:

* **Dynamic Context:** Toggle on to automatically include a configurable number of lines (paragraphs) surrounding your selection/current paragraph as
    context for the AI. Adjust the line count in the plugin settings (`Settings → WordSmith → Dynamic context lines`).
* **Entire Note as Context:** Toggle on to send the entire content of the current note as context.
* **Custom Context:** Toggle on and paste any specific text into the provided text area to use as context. This overrides Dynamic and Entire Note context
    if active.

### Customizing Prompts

Tailor WordSmith to your exact needs:

* **Add User Prompts:** In plugin settings
    (`Settings → WordSmith → Prompt Management`), click "Add User Prompt". Give your prompt a name and provide the instructional text for the AI.
* **Manage Prompts:** Enable or disable any default or custom prompt using the toggles in the settings.
* **Edit/Delete User Prompts:** Use the pencil and trash icons next to your custom prompts.
* **Advanced - Modify Preset Prompts:** If you wish to alter the behavior of preset prompts, you can find the full text in `[YourVault]/.obsidian/plugins/text-transformer/data.json`. Do not edit this file as it gets reset every time. Instead, copy the Built-In prompts you wish to customize and make new User Prompts based on them. Prompts also show up in Console if Debug Logging is turned on in Settings—you can quickly copy it from there.

### API Key Setup, AI Providers & Models Info

The setup is very simple and intuitive—go to the WordSmith Settigns, select the `Model Providers` tab, click the `Add Provider` button, choose your model provider, paste the API Key, and that's it!

![WordSmith Model Provider Setup](https://github.com/user-attachments/assets/4ef4d09d-4087-4e7c-9279-fd6c4123a780)


## Release History

### w͜s Verion 3.2.0 - New Feature: Current Section (by markdown header) Option in Context Menu

Introducing a powerful new **Section** context mode, perfect for topic-focused tasks. This new option intelligently sends the content from the current markdown header to the next, ensuring relevant AI responses. In line with this addition, the Context Control Panel's UI has been significantly streamlined for clarity and simplicity. The former expandable description area has been removed in favor of a cleaner layout, with concise and helpful tooltips now located directly on each toggle button for improved discoverability. This redesign declutters the panel, making it faster and more intuitive to control exactly what context the AI receives for any given task.

### w͜s Version v3.0.0 - New Feature: 400+ Models & Local AI Provider Support

This major release introduces a complete architectural overhaul brings Dynamic AI Model Providers to WordSmith. The hardcoded model list has been replaced with a dynamic, provider-agnostic framework. This unlocks access to **over 400 models** from top-tier services like **OpenAI, Anthropic, Google, and OpenRouter**, others you wish to add, and crucially, brings first-class support for running AI completely offline with **local servers like Ollama and LM Studio**. You now have ultimate control over your AI toolkit.

Key features and improvements include:

* **Massive Model Expansion:** Connect to any service with a standard chat completions API. The new system provides immediate access to hundreds of models, from the latest flagships to specialized open-source variants.
* **First-Class Local AI Support:** Run your transformations and generations privately and for free by adding your local Ollama or LM Studio endpoints as providers.
* **Comprehensive Model Browser:** A new "Browse All Models" modal displays every available model from all your configured providers in a single, searchable interface.
* **Favorites System:** Stared models are moved to the top of the list for quick selection.
* **Future-Proof Foundation:** WordSmith no longer requires manual updates to support new models. As providers add models to their APIs, they will automatically become available in your browser.
* **Overhauled the prompt engineering system** for significantly improved AI reliability and instruction-following. Now that we have access to thousands of models, each trained with different prompt and system instruction structures, we had to construct prompts in a way to maximize compliance by as many models as possible. This change enhances performance across all models, from top-tier APIs to local servers.
* **Improved Settings Menu:** Now with tabs, free from clutter.

![WordSmith Model Selection Modal](https://github.com/user-attachments/assets/8b2bec9c-27c2-43dc-b1f5-eb5716d324e8)

#### Minor Versions of v.3.1.x

* **3.1.0**—Prompt Constructor Update

This release introduces a powerful **Modular Prompt Constructor** for text generation, transforming it from a simple input box into a flexible workspace for building and managing complex prompts. Version 3.1.0 also brings significant under-the-hood improvements to model management, performance, and API reliability.

* **Feat: Modular Generation Prompt System:** The "Prompt Based Context Aware Generation" command has been completely revamped. You now have a library of **User Generation Prompts** at your fingertips.
  * **Palette-First Workflow:** The generation command now opens a palette populated with your own saved prompt.
  * **In-Modal Prompt Composition:** A new "Insert Saved Prompt" dropdown inside the generation modal lets you append any of your saved prompts to the text area. Combine prompts like Lego blocks to build the perfect instruction for any task, on the fly.
* **Improved Model Selection & Caching:** The "Browse Models" modal is now faster and more responsive. It uses an intelligent caching strategy to load your model list instantly while refreshing it in the background, eliminating the initial loading delay.
* **Advanced Temperature Management:** WordSmith now automatically adjusts the temperature slider's range and default value based on the selected model. We've researched and embedded optimal default temperatures for dozens of popular models to give you better results out of the box.
* **Enhanced API Reliability:**
  * **Fixed Anthropic API Integration:** Direct connections to Anthropic's API now use the correct request format and endpoint.
  * **Smarter API Logic:** The underlying logic for communicating with different providers (OpenAI, OpenRouter, Anthropic, Google, local servers) has been simplified and made more robust, correctly leveraging each service's capabilities.
* **Refined UI & Efficiency:** Various UI elements have been polished for a smoother and more intuitive user experience.

**3.1.1**—This version includes a significant under-the-hood architectural refactoring to enhance the plugin's stability, maintainability, and developer ergonomics. Core logic functions and UI components that previously used long, ordered lists of parameters have been updated to use a modern "Options Object" pattern. This extensive refactoring brings:

- Increasing readability and self-documentation at call sites.
- Enhancing type safety and eliminating the risk of parameter-swapping bugs.
- Making the function signature more robust and easier to extend in the future.
**3.1.2**—Extensive refactoring and cleanup; Typescript consolidation; improved model selection loading logic, to significantly improve startup time; UI improvements; minor bug fixes.

### w͜s What's New in v2.2.0 - Knowledge Graph Generation

This is a major feature release that introduces a powerful new way to visualize your ideas. With the new **Knowledge Graph Generator**, you can now transform your notes and research into beautiful, editable Obsidian Canvases.

Key features and improvements include:

* **AI-Powered Knowledge Graph Generation**—This is the centerpiece of the update!
  * A new command, **`Generate knowledge graph`**, analyzes your context to extract key entities and their relationships.
  * **Intelligent & Context-Aware**—Fully integrated with the Context Control Panel. Use your full note and/or provide detailed instructions and linked notes in the "Custom Context" field to guide the generation.
  * **Spacious & Readable Layouts**—Utilizes the `d3-force` engine to automatically arrange nodes in a clean, expanded layout with plenty of breathing room, avoiding cluttered clusters.
  * **Automatic Node Sizing & Coloring** Nodes perfectly expand to fit their entire text content—no more manual resizing! To improve readability, the most central "hub" nodes in your graph are automatically highlighted with a random color.
* **Tested Successfully With Several Models**—Not all models are capable of generating the precise JSON format required for the graph generation, but I have successfully tested with GPT 4.1 & 4o, Gemini 2.5 Flash, Grok 3, any of the Claude models, DeepSeek v3, Command A is a champ, all of the Llama models including the small 3.3 70B, and to my surprise, even small models like Qwen 3 32B succeeded! The size of the content to graph is a factor.
* **All WordSmith Standard Functionality Works in Canvas Cards Seamlessly.**

#### Minor Versions of v.2.2.x

* **2.2.1**—Added a Max Output Tokens input box. Larger models were failing at Knowledge Graph generation because the output was too large and got truncated by legacy hardcoded max 2k tokens output.
* **2.2.2**—Improved Name Format for Knowledge Graph, more flexible and human readable. Also changed WordSmith logo to W-shaped Lucide icon `crown`.

![WordSmith Knowledge Graph](https://github.com/user-attachments/assets/1c06ee58-6518-4866-96fb-026f82ec406f)

### w͜s What's New in v2.1.0 - Context Panel Save State Across Sessions

* **Feat: Persistent & Decoupled AI Context Control**—Your preferred context settings (Dynamic, Full Note, Custom Context Toggle & Text) are now saved automatically across sessions, and the plugin can utilize them even when the Context Control Panel is closed.
* Bug Fix: was sending thinking budget to all "Flash" models causing Gemini 2.0 Flash-Lite to throw an error.

#### Minor Versions of v.2.1.x

* **2.1.1** 🛠️ Under The Hood Improvements—The plugin's internal prompt construction logic has been centralized, leading to more robust and consistent AI interactions across all supported models.

See full [Release History](https://github.com/samwega/obsidian-wordsmith/wiki/Release-History) in the wiki page.

## Installation & Setup

### Manual Installation

1. Go to the [Releases page](<https://github.com/samwega/obsidian-wordsmith/releases>) on GitHub.
2. Find the latest release and download the `main.js`, `manifest.json`, and
    `styles.css` files from the "Assets" section.
3. In your Obsidian vault, navigate to the `.obsidian/plugins/` directory.
4. Create a new folder named `wordsmith`.
5. Copy the downloaded `main.js`, `manifest.json`, and `styles.css` files into
    this new `text-transformer` folder.
6. Reload Obsidian (e.g., close and reopen the app, or use the "Reload app
    without saving" command).
7. Go to `Settings` -> `Community plugins`, find "WordSmith" in your
    list of installed plugins, and enable it.
8. In the command palette, select `WordSmith: Open Al Context Control Panel` and place the panel wherever you prefer.

### Plugin Installation (via Community Store)

Coming soon! We are working on getting WordSmith added to the official
Obsidian community plugin store.

## About the Developer

Coming soon!
