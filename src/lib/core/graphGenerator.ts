// src/lib/core/graphGenerator.ts
import {
	SimulationNodeDatum,
	forceCenter,
	forceCollide,
	forceLink,
	forceManyBody,
	forceSimulation,
} from "d3-force";
import { App, Editor, Notice, normalizePath } from "obsidian";

import type TextTransformer from "../../main";
import { SingleInputModal, SingleInputModalOptions } from "../../ui/modals/single-input-modal";

import {
	type ChatCompletionRequestParams,
	chatCompletionRequest,
} from "../../llm/chat-completion-handler";
import { type GeminiRequestParams, geminiRequest } from "../../llm/gemini";
import { buildGraphPrompt } from "../../llm/prompt-builder";
import type { GraphCanvasMetadata, LlmKnowledgeGraph } from "../graph/types";
import { formatDateForFilename, getCmEditorView, logDebug, logError } from "../utils";
import { AssembledContextForLLM, gatherContextForAI } from "./textTransformer";

const CANVAS_NODE_WIDTH = 480;
const D3_SIMULATION_TICKS = 400;
const CANVAS_COLLISION_PADDING = 50;
const INITIAL_SPREAD_FACTOR = 1000;

type LayoutNode = LlmKnowledgeGraph["nodes"][number] & {
	width: number;
	height: number;
	x?: number;
	y?: number;
};

function calculateNodeHeight(container: HTMLElement, text: string, width: number): number {
	const tempDiv = container.createDiv({ cls: "wordsmith-height-calculator" });
	tempDiv.style.width = `${width}px`; // Dynamic width must stay inline

	const lines = text.split("\n");

	for (const line of lines) {
		const h2Match = line.match(/^## (.*)/);
		if (h2Match) {
			const h2Div = tempDiv.createDiv({ cls: "wordsmith-height-calculator-h2" });
			h2Div.textContent = h2Match[1];
		} else {
			const p = tempDiv.createEl("p", { cls: "wordsmith-height-calculator-p" });
			p.textContent = line || "\u00A0"; // Use non-breaking space for empty lines
		}
	}

	const height = tempDiv.scrollHeight;
	tempDiv.remove(); // Clean up the temporary element
	return Math.max(height, 60);
}

function promptForBaseName(app: App): Promise<string | null> {
	return new Promise((resolve) => {
		const defaultDateName = `${formatDateForFilename(new Date())} `;
		const modalOptions: SingleInputModalOptions = {
			title: "Enter a name for the knowledge graph canvas",
			placeholder: "My knowledge graph",
			initialValue: defaultDateName,
			onSubmit: (result) => resolve(result),
			onCancel: () => resolve(null),
		};
		new SingleInputModal(app, modalOptions).open();
	});
}

function validateLlmResponse(data: unknown): LlmKnowledgeGraph {
	if (typeof data !== "object" || data === null) {
		throw new Error("LLM response is not a valid object.");
	}
	const graph = data as LlmKnowledgeGraph;
	if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
		throw new Error("LLM response must contain 'nodes' and 'edges' arrays.");
	}
	const nodeIds = new Set<string>();
	for (const node of graph.nodes) {
		if (
			typeof node.id !== "string" ||
			!node.id ||
			typeof node.label !== "string" ||
			!node.label ||
			typeof node.description !== "string"
		) {
			throw new Error("Invalid node structure in LLM response.");
		}
		if (nodeIds.has(node.id)) {
			throw new Error(`Duplicate node ID found: ${node.id}`);
		}
		nodeIds.add(node.id);
	}
	for (const edge of graph.edges) {
		if (
			typeof edge.source !== "string" ||
			!edge.source ||
			typeof edge.target !== "string" ||
			!edge.target ||
			typeof edge.label !== "string"
		) {
			throw new Error("Invalid edge structure in LLM response.");
		}
		if (!nodeIds.has(edge.source)) {
			throw new Error(`Edge source ID '${edge.source}' does not exist in nodes.`);
		}
		if (!nodeIds.has(edge.target)) {
			throw new Error(`Edge target ID '${edge.target}' does not exist in nodes.`);
		}
	}
	return graph;
}

function determineHubNodesAndColor(edges: LlmKnowledgeGraph["edges"]): {
	hubNodeIds: Set<string>;
	hubColor: string | null;
} {
	if (edges.length === 0) {
		return { hubNodeIds: new Set(), hubColor: null };
	}
	const connectionCounts = new Map<string, number>();
	for (const edge of edges) {
		connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
		connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
	}
	let maxConnections = 0;
	for (const count of connectionCounts.values()) {
		if (count > maxConnections) {
			maxConnections = count;
		}
	}
	if (maxConnections === 0) {
		return { hubNodeIds: new Set(), hubColor: null };
	}
	const hubNodeIds = new Set<string>();
	for (const [id, count] of connectionCounts.entries()) {
		if (count === maxConnections) {
			hubNodeIds.add(id);
		}
	}
	const obsidianPaletteColors = ["1", "2", "3", "4", "5", "6"];
	const hubColor = obsidianPaletteColors[Math.floor(Math.random() * obsidianPaletteColors.length)];
	return { hubNodeIds, hubColor };
}

function calculateLayout(
	nodesWithDimensions: LayoutNode[],
	edges: LlmKnowledgeGraph["edges"],
): LayoutNode[] {
	nodesWithDimensions.forEach((node) => {
		node.x = (Math.random() - 0.5) * INITIAL_SPREAD_FACTOR;
		node.y = (Math.random() - 0.5) * INITIAL_SPREAD_FACTOR;
	});
	const links = edges.map((e) => ({ ...e }));
	const simulation = forceSimulation(nodesWithDimensions)
		.force(
			"link",
			forceLink(links)
				.id((d: SimulationNodeDatum) => (d as LayoutNode).id)
				.distance(350)
				.strength(0.6),
		)
		.force("charge", forceManyBody().strength(-2500))
		.force("center", forceCenter(0, 0).strength(0.05))
		.force(
			"collide",
			forceCollide<LayoutNode>()
				.radius(
					(d) =>
						Math.sqrt((d.width / 2) ** 2 + (d.height / 2) ** 2) + CANVAS_COLLISION_PADDING,
				)
				.strength(1),
		)
		.stop();
	for (let i = 0; i < D3_SIMULATION_TICKS; ++i) {
		simulation.tick();
	}
	return nodesWithDimensions;
}

function constructCanvasJson(
	nodesWithLayout: LayoutNode[],
	edges: LlmKnowledgeGraph["edges"],
	hubNodeIds: Set<string>,
	hubColor: string | null,
): string {
	const nodeMap = new Map(nodesWithLayout.map((node) => [node.id, node]));
	const canvasNodes = nodesWithLayout.map((node) => {
		const canvasNode: {
			id: string;
			x: number;
			y: number;
			width: number;
			height: number;
			type: "text";
			text: string;
			color?: string;
		} = {
			id: node.id,
			x: node.x ?? 0,
			y: node.y ?? 0,
			width: node.width,
			height: node.height,
			type: "text",
			text: `## ${node.label}\n\n${node.description}`,
		};
		if (hubColor && hubNodeIds.has(node.id)) {
			canvasNode.color = hubColor;
		}
		return canvasNode;
	});
	const canvasEdges = edges.map((edge, index) => {
		const sourceNode = nodeMap.get(edge.source);
		const targetNode = nodeMap.get(edge.target);
		let fromSide: "top" | "bottom" | "left" | "right" = "bottom";
		let toSide: "top" | "bottom" | "left" | "right" = "top";
		if (sourceNode && targetNode) {
			const dx = (targetNode.x ?? 0) - (sourceNode.x ?? 0);
			const dy = (targetNode.y ?? 0) - (sourceNode.y ?? 0);
			if (Math.abs(dx) > Math.abs(dy)) {
				if (dx > 0) {
					fromSide = "right";
					toSide = "left";
				} else {
					fromSide = "left";
					toSide = "right";
				}
			} else if (dy > 0) {
				fromSide = "bottom";
				toSide = "top";
			} else {
				fromSide = "top";
				toSide = "bottom";
			}
		}
		return {
			id: `edge_${index}_${Date.now()}`,
			fromNode: edge.source,
			fromSide,
			toNode: edge.target,
			toSide,
			label: edge.label,
		};
	});
	return JSON.stringify({ nodes: canvasNodes, edges: canvasEdges }, null, 2);
}

function generateUniqueFilename(baseName: string): string {
	const sanitizedName = baseName
		.trim()
		.replace(/[^a-zA-Z0-9\s-]/g, "")
		.replace(/\s+/g, "-");
	const uniqueId = Date.now().toString().slice(-6);
	return `${sanitizedName}--${uniqueId}.canvas`;
}

function getGraphChatCompletionsRequestOptions(plugin: TextTransformer): {
	apiUrl: string;
	apiKey: string;
	modelId: string;
	additionalHeaders?: Record<string, string>;
} | null {
	const { settings } = plugin;
	const { customProviders, selectedModelId } = settings;

	if (!selectedModelId) {
		new Notice("No model selected. Please select a model for graph generation.", 6000);
		return null;
	}

	const [providerName, modelApiId] = selectedModelId.split("//");
	if (!providerName || !modelApiId) {
		new Notice(`Invalid selected model ID format: ${selectedModelId}. Please re-select.`, 6000);
		return null;
	}

	const provider = customProviders.find((p) => p.name === providerName);
	if (!provider || !provider.isEnabled) {
		new Notice(
			`Provider "${providerName}" not found or is disabled. Please check WordSmith settings.`,
			6000,
		);
		return null;
	}

	const chatOptions: ReturnType<typeof getGraphChatCompletionsRequestOptions> = {
		apiUrl: `${provider.endpoint}/chat/completions`,
		apiKey: provider.apiKey,
		modelId: modelApiId,
	};

	if (provider.name.toLowerCase().includes("openrouter")) {
		chatOptions.additionalHeaders = {
			"HTTP-Referer": plugin.manifest.id,
			"X-Title": plugin.manifest.name,
		};
	}

	return chatOptions;
}

/**
 * Handles the API request and validation for graph data.
 * @throws An error if the API call, JSON parsing, or validation fails.
 */
async function fetchAndValidateGraphData(
	plugin: TextTransformer,
	assembledContext: AssembledContextForLLM,
	abortSignal?: AbortSignal,
): Promise<LlmKnowledgeGraph> {
	const { settings } = plugin;
	const { customProviders, selectedModelId } = settings;

	const [providerName, modelApiId] = selectedModelId.split("//");
	const provider = customProviders.find((p) => p.name === providerName);
	if (!provider) {
		// This check is technically redundant due to earlier checks, but good for safety.
		throw new Error(`Provider "${providerName}" is not configured or disabled.`);
	}

	const promptComponents = buildGraphPrompt({ assembledContext });
	const adHocPrompt: (typeof settings.prompts)[number] = {
		id: "graph-generation",
		name: "Graph generation",
		text: promptComponents.userContent,
		isDefault: false,
		enabled: true,
	};

	let response: { newText: string } | undefined;
	const isGeminiProvider = provider.endpoint.includes("generativelanguage.googleapis.com");

	if (isGeminiProvider) {
		const geminiParams: GeminiRequestParams = {
			settings,
			prompt: adHocPrompt,
			isGenerationTask: true,
			provider,
			modelApiId,
			assembledContext,
			...(abortSignal && { abortSignal }),
		};
		response = await geminiRequest(plugin, geminiParams);
	} else {
		const requestOptions = getGraphChatCompletionsRequestOptions(plugin);
		if (!requestOptions) {
			throw new Error("Could not construct valid request options for graph generation.");
		}
		const chatParams: ChatCompletionRequestParams = {
			settings,
			prompt: adHocPrompt,
			isGenerationTask: true,
			assembledContext,
			...requestOptions,
			...(abortSignal && { abortSignal }),
		};
		response = await chatCompletionRequest(plugin, chatParams);
	}

	if (!response?.newText) {
		throw new Error("AI did not return any data for the graph.");
	}

	logDebug(plugin, "Graph Generation: Raw LLM Response Text", response.newText);

	const rawResponseText = response.newText.trim();
	const jsonRegex = /```json\n([\s\S]*?)\n```/;
	const match = rawResponseText.match(jsonRegex);
	const jsonToParse = match ? match[1] : rawResponseText;
	const parsedJson = JSON.parse(jsonToParse);

	return validateLlmResponse(parsedJson);
}

/**
 * Takes validated graph data and creates the canvas file in the vault.
 */
async function createCanvasFileFromGraph(
	plugin: TextTransformer,
	editor: Editor,
	baseName: string,
	graph: LlmKnowledgeGraph,
): Promise<void> {
	const { app, settings, manifest } = plugin;

	const nodesWithDimensions: LayoutNode[] = graph.nodes.map((node) => ({
		...node,
		width: CANVAS_NODE_WIDTH,
		height: calculateNodeHeight(
			app.workspace.containerEl,
			`## ${node.label}\n\n${node.description}`,
			CANVAS_NODE_WIDTH,
		),
	}));

	const nodesWithLayout = calculateLayout(nodesWithDimensions, graph.edges);
	const { hubNodeIds, hubColor } = determineHubNodesAndColor(graph.edges);
	const canvasJsonString = constructCanvasJson(nodesWithLayout, graph.edges, hubNodeIds, hubColor);
	const finalFilename = generateUniqueFilename(baseName);
	const filePath = normalizePath(`${settings.graphAssetPath}/${finalFilename}`);

	if (!app.vault.getAbstractFileByPath(settings.graphAssetPath)) {
		await app.vault.createFolder(settings.graphAssetPath);
	}
	const newFile = await app.vault.create(filePath, canvasJsonString);

	const [providerName] = settings.selectedModelId.split("//");

	// --- REFACTOR START ---
	// Extract complex async calls and potentially null values into variables
	// to simplify the final object creation for the type checker.
	const contextPanel = await plugin.getContextPanel();
	const structuredCustomContext = contextPanel
		? await contextPanel.getStructuredCustomContext()
		: null;
	const resolvedWikilinks =
		structuredCustomContext?.referencedNotes.map((n) => n.sourcePath) ?? [];

	const editorView = getCmEditorView(editor);
	let customContextText: string | null = null;
	if (editorView) {
		// Only gather context if the editor view exists, avoiding the `!` operator.
		const gatheredContext = await gatherContextForAI(plugin, editorView, "generation");
		customContextText = gatheredContext.customContext ?? null;
	}

	// Now, create the metadata object from the simplified, pre-calculated variables.
	const metadata: GraphCanvasMetadata = {
		version: manifest.version,
		createdAt: new Date().toISOString(),
		modelProvider: providerName,
		modelId: settings.selectedModelId,
		contextSnapshot: {
			resolvedWikilinks: resolvedWikilinks,
			customContextText: customContextText,
		},
	};
	// --- REFACTOR END ---

	await app.fileManager.processFrontMatter(newFile, (frontmatter) => {
		Object.assign(frontmatter, metadata);
	});

	editor.replaceSelection(`\n![[${newFile.path}]]\n`);
	new Notice(`✅ Knowledge graph '${finalFilename}' created and embedded.`, 5000);
}

/**
 * Main orchestrator for the knowledge graph generation workflow.
 */
export async function generateGraphAndCreateCanvas(
	plugin: TextTransformer,
	editor: Editor,
): Promise<void> {
	const { app, settings } = plugin;
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("WordSmith requires a modern editor version.");
		return;
	}

	const baseName = await promptForBaseName(app);
	if (!baseName) {
		new Notice("Canvas generation cancelled.");
		return;
	}

	if (!settings.selectedModelId) {
		new Notice("No model selected. Please select one in the context panel.", 6000);
		return;
	}

	const abortController = plugin.startGeneration();
	const notice = new Notice("Gathering context and preparing graph data...", 0);
	plugin.setCurrentGenerationNotice(notice);

	try {
		const gatheredContext = await gatherContextForAI(plugin, cm, "generation");

		// Check if cancelled after context gathering
		if (abortController.signal.aborted) {
			notice.hide();
			plugin.completeGeneration();
			return;
		}

		notice.setMessage("Requesting graph data from AI...");
		const validatedGraph = await fetchAndValidateGraphData(
			plugin,
			gatheredContext,
			abortController.signal,
		);

		// Check if cancelled after API request
		if (abortController.signal.aborted) {
			notice.hide();
			plugin.completeGeneration();
			return;
		}

		notice.setMessage("Calculating graph layout...");
		await createCanvasFileFromGraph(plugin, editor, baseName, validatedGraph);

		notice.hide();
		plugin.completeGeneration();
	} catch (error) {
		notice.hide();
		plugin.completeGeneration();

		// Don't log cancellation errors as they're expected
		if (!abortController.signal.aborted) {
			const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
			new Notice(`Failed to generate graph: ${errorMessage}`, 8000);
			logError(error);
		}
	}
}
