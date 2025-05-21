import fs from "node:fs";
import path from "node:path";

const packageJsonPath = path.resolve(__dirname, "package.json");
const manifestJsonPath = path.resolve(__dirname, "manifest.json");

try {
	// Read package.json
	const packageJsonData = fs.readFileSync(packageJsonPath, "utf8");
	const packageJson = JSON.parse(packageJsonData);

	// Read manifest.json
	const manifestJsonData = fs.readFileSync(manifestJsonPath, "utf8");
	const manifestJson = JSON.parse(manifestJsonData);

	// Update manifest.json fields
	manifestJson.name = packageJson.name;
	manifestJson.version = packageJson.version;
	manifestJson.author = packageJson.author;
	manifestJson.description = packageJson.description; // Added this line
	manifestJson.authorUrl = "https://github.com/samwega"; // Added this line
	manifestJson.helpUrl = "https://github.com/samwega/obsidian-text-transformer#readme"; // Added this line
	// Note: Funding URL is removed as it was not in your desired final state
	if (manifestJson.fundingUrl) {
		delete manifestJson.fundingUrl;
	}


	// Write the updated manifest.json back to the file
	fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2), "utf8");
    console.log("manifest.json updated successfully!"); // Added for confirmation
} catch (error) {
	console.error("Error updating manifest.json:", error);
	process.exit(1); // Exit with an error code to indicate failure
}