import { PLUGIN, UI } from "@common/networkSides";
import { PLUGIN_CHANNEL } from "@plugin/plugin.network";
import { Networker } from "monorepo-networker";

async function bootstrap() {
  Networker.initialize(PLUGIN, PLUGIN_CHANNEL);

  figma.showUI(__html__, {
    width: 540,
    height: 500,
    title: "SVG Sprite Generator",
  });

  //Restore previous size when reopen the plugin
  figma.clientStorage
    .getAsync("size")
    .then((size) => {
      if (size) figma.ui.resize(size.w, size.h);
    })
    .catch((err) => {});

  console.log("Bootstrapped @", Networker.getCurrentSide().name);

  PLUGIN_CHANNEL.emit(UI, "hello", ["Hey there, UI!"]);

  // Add a message listener for direct communication
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "generateSvgSprite") {
      const selectedNodes = figma.currentPage.selection;
      if (selectedNodes.length === 0) {
        figma.ui.postMessage({
          type: "svgSpriteError",
          message: "No selection is present.",
        });
        return;
      }

      // Create an array to store SVG data for each selected node
      const svgElements = [];

      // Process each selected node
      for (const node of selectedNodes) {
        // Cast node to SceneNode to get access to name property
        const sceneNode = node as SceneNode;

        // Check if the node can be exported
        if ("exportAsync" in node) {
          try {
            console.log(`Exporting node: ${sceneNode.name}`);

            // Clone node to apply exportable settings if needed
            let exportSettings = null;

            // Create a clean ID/class name from the node name
            const cleanName = sceneNode.name.replace(/\s+/g, "-").toLowerCase();

            // Try to export as SVG
            console.log("Attempting to export as SVG...");

            // Ensure node has export settings for SVG
            // Some nodes might need explicit export settings
            const svgData = await node.exportAsync({
              format: "SVG",
              svgOutlineText: true,
              svgIdAttribute: true,
              svgSimplifyStroke: true,
              contentsOnly: true,
            });

            // Convert to string using Figma's utility functions
            let svgString = "";
            try {
              // Use a simple and compatible approach - convert bytes to string
              const bytes = new Uint8Array(svgData);
              svgString = Array.from(bytes)
                .map((b) => String.fromCharCode(b))
                .join("");
            } catch (err) {
              console.error("Error converting SVG data", err);
              continue;
            }

            console.log(`SVG string length: ${svgString.length}`);

            // Validate the SVG content
            if (svgString.length < 50) {
              console.warn(`Warning: Very short SVG content for ${sceneNode.name}: ${svgString}`);
            }

            if (!svgString.includes("<svg")) {
              console.error(`Error: No <svg> tag found in exported content for ${sceneNode.name}`);
              continue;
            }

            // Add to our collection
            svgElements.push({
              id: cleanName,
              content: svgString,
            });
          } catch (error) {
            console.error(`Error exporting node ${sceneNode.name}:`, error);
          }
        } else {
          console.warn(
            `Node ${sceneNode.name} does not support export. Try converting to vector first.`
          );
        }
      }

      // Provide guidance if no valid SVGs were extracted
      if (svgElements.length === 0) {
        figma.ui.postMessage({
          type: "svgSpriteError",
          message:
            "No valid SVG elements could be exported. Try selecting vector shapes or converting shapes to vector first (Object > Flatten Selection).",
        });
        return;
      }

      // Send the result back to the UI
      figma.ui.postMessage({
        type: "svgSpriteResult",
        elements: svgElements,
      });
    }
  };

  setInterval(() => PLUGIN_CHANNEL.emit(UI, "ping", []), 5000);
}

bootstrap();
