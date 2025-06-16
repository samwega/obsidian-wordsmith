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
import { SingleInputModal } from "../../ui/modals/single-input-modal";

import { chatCompletionRequest } from "../../llm/chat-completion-handler";
import { geminiRequest } from "../../llm/gemini";
import { buildGraphPrompt } from "../../llm/prompt-builder";
import type { GraphCanvasMetadata, LlmKnowledgeGraph } from "../graph/types";
import { formatDateForFilename, getCmEditorView, logError } from "../utils";
import { gatherContextForAI } from "./textTransformer";

// ... unchanged helper functions (calculateNodeHeight, promptForBaseName, etc.) ...
const CANVAS_NODE_WIDTH = 480;
const CANVAS_NODE_PADDING = 30;
const D3_SIMULATION_TICKS = 400;
const CANVAS_COLLISION_PADDING = 50;
const INITIAL_SPREAD_FACTOR = 1000;

type LayoutNode = LlmKnowledgeGraph["nodes"][number] & {
	width: number;
	height: number;
	x?: number;
	y?: number;
};

function calculateNodeHeight(text: string, width: number): number {
	const tempDiv = document.createElement("div");
	tempDiv.style.visibility = "hidden";
	tempDiv.style.position = "absolute";
	tempDiv.style.left = "-9999px";
	tempDiv.style.width = `${width - CANVAS_NODE_PADDING * 2}px`;
	tempDiv.style.padding = `${CANVAS_NODE_PADDING}px`;
	tempDiv.style.boxSizing = "content-box";
	tempDiv.style.wordWrap = "break-word";
	tempDiv.style.whiteSpace = "pre-wrap";
	tempDiv.style.fontFamily = "var(--font-text)";
	tempDiv.style.fontSize = "var(--font-text-size)";
	tempDiv.style.lineHeight = "var(--line-height-normal)";
	const htmlContent = text
		.replace(
			/^## (.*)$/gm,
			'<div style="font-size: var(--h2-size); font-weight: var(--h2-weight); margin-bottom: 0.5em;">$1</div>',
		)
		.replace(/\n\n/g, "<p></p>");
	tempDiv.innerHTML = htmlContent;
	document.body.appendChild(tempDiv);
	const height = tempDiv.scrollHeight;
	document.body.removeChild(tempDiv);
	return Math.max(height, 60);
}

function promptForBaseName(app: App): Promise<string | null> {
	return new Promise((resolve) => {
		const defaultDateName = `${formatDateForFilename(new Date())} `;
		new SingleInputModal(
			app,
			"Enter a name for the knowledge graph canvas",
			"My Knowledge Graph",
			defaultDateName,
			(result) => resolve(result),
			() => resolve(null),
		).open();
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

export async function generateGraphAndCreateCanvas(
	plugin: TextTransformer,
	editor: Editor,
): Promise<void> {
	const { app, settings, manifest } = plugin;
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

	const notice = new Notice("Gathering context and preparing graph data...", 0);

	// --- FIX: Request Routing Logic ---
	const { customProviders, selectedModelId } = settings;
	if (!selectedModelId) {
		new Notice("No model selected. Please select one in the context panel.", 6000);
		notice.hide();
		return;
	}
	const [providerName, modelApiId] = selectedModelId.split("//");
	const provider = customProviders.find((p) => p.name === providerName);
	if (!provider || !provider.isEnabled) {
		new Notice(`Provider "${providerName}" is not configured or disabled.`, 6000);
		notice.hide();
		return;
	}
	// --- END FIX ---

	const gatheredContext = await gatherContextForAI(plugin, cm, "generation");
	const promptComponents = buildGraphPrompt(gatheredContext);
	const adHocPrompt: (typeof plugin.settings.prompts)[number] = {
		id: "graph-generation",
		name: "Graph Generation",
		text: promptComponents.userContent,
		isDefault: false,
		enabled: true,
	};

	let response: { newText: string } | undefined;
	try {
		// --- FIX: Request Routing Logic ---
		const isGeminiProvider = provider.endpoint.includes("generativelanguage.googleapis.com");
		if (isGeminiProvider) {
			response = await geminiRequest(
				plugin,
				settings,
				"",
				adHocPrompt,
				gatheredContext,
				true,
				provider,
				modelApiId,
			);
		} else {
			const requestOptions = getGraphChatCompletionsRequestOptions(plugin);
			if (!requestOptions) {
				notice.hide();
				return;
			}
			// --- REFACTORED CALL ---
			response = await chatCompletionRequest(plugin, {
				settings,
				prompt: adHocPrompt,
				isGenerationTask: true,
				assembledContext: gatheredContext,
				...requestOptions,
			});
		}
		// --- END FIX ---
	} catch (error) {
		notice.hide();
		logError(error);
		return;
	}

	if (!response?.newText) {
		notice.hide();
		new Notice("AI did not return any data for the graph.", 6000);
		return;
	}

	if (plugin.runtimeDebugMode) {
		console.debug("[WordSmith plugin] Graph Generation: Raw LLM Response Text", response.newText);
	}

	let validatedGraph: LlmKnowledgeGraph;
	let nodesWithLayout: LayoutNode[];
	try {
		notice.setMessage("Parsing and validating graph data...");
		const rawResponseText = response.newText.trim();
		const jsonRegex = /```json\n([\s\S]*?)\n```/;
		const match = rawResponseText.match(jsonRegex);
		const jsonToParse = match ? match[1] : rawResponseText;
		const parsedJson = JSON.parse(jsonToParse);
		validatedGraph = validateLlmResponse(parsedJson);

		notice.setMessage("Measuring text and preparing nodes...");
		const nodesWithDimensions: LayoutNode[] = validatedGraph.nodes.map((node) => ({
			...node,
			width: CANVAS_NODE_WIDTH,
			height: calculateNodeHeight(`## ${node.label}\n\n${node.description}`, CANVAS_NODE_WIDTH),
		}));

		notice.setMessage("Calculating graph layout...");
		nodesWithLayout = calculateLayout(nodesWithDimensions, validatedGraph.edges);
	} catch (error) {
		notice.hide();
		new Notice(
			`Failed to process graph data: ${error instanceof Error ? error.message : "Unknown error"}`,
			8000,
		);
		console.error("WordSmith Graph Generation Error:", error);
		console.error("Invalid LLM Response:", response.newText);
		return;
	}

	notice.setMessage("Saving canvas and embedding link...");
	const { hubNodeIds, hubColor } = determineHubNodesAndColor(validatedGraph.edges);
	const canvasJsonString = constructCanvasJson(
		nodesWithLayout,
		validatedGraph.edges,
		hubNodeIds,
		hubColor,
	);
	const finalFilename = generateUniqueFilename(baseName);
	const filePath = normalizePath(`${settings.graphAssetPath}/${finalFilename}`);

	try {
		if (!(await app.vault.adapter.exists(settings.graphAssetPath))) {
			await app.vault.createFolder(settings.graphAssetPath);
		}
		const newFile = await app.vault.create(filePath, canvasJsonString);

		const metadata: GraphCanvasMetadata = {
			version: manifest.version,
			createdAt: new Date().toISOString(),
			modelProvider: providerName,
			modelId: settings.selectedModelId,
			contextSnapshot: {
				resolvedWikilinks:
					(await plugin.getContextPanel()?.getStructuredCustomContext())?.referencedNotes.map(
						(n) => n.sourcePath,
					) ?? [],
				customContextText: gatheredContext.customContext ?? null,
			},
		};
		await app.fileManager.processFrontMatter(newFile, (frontmatter) => {
			Object.assign(frontmatter, metadata);
		});

		editor.replaceSelection(`\n![[${newFile.path}]]\n`);
		notice.hide();
		new Notice(`✅ Knowledge graph '${finalFilename}' created and embedded.`, 5000);
	} catch (error) {
		notice.hide();
		logError(error);
		new Notice("Failed to save the canvas file.", 6000);
	}
}
