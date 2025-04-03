import { PLUGIN, UI, ResizeSize } from "@common/networkSides";

// Define message types to fix the type error
type MessageHandlers =
  | "ping"
  | "hello"
  | "createRect"
  | "exportSelection"
  | "createSvgSprite"
  | "generateSvgSprite"
  | "resize";

export const PLUGIN_CHANNEL = PLUGIN.channelBuilder()
  .emitsTo(UI, (message) => {
    figma.ui.postMessage(message);
  })
  .receivesFrom(UI, (next) => {
    const listener: MessageEventHandler = (event) => next(event);
    figma.ui.on("message", listener);
    return () => figma.ui.off("message", listener);
  })
  .startListening();

// ---------- Message handlers

PLUGIN_CHANNEL.registerMessageHandler("ping", () => {
  return "pong";
});

PLUGIN_CHANNEL.registerMessageHandler("hello", (text) => {
  console.log("UI side said:", text);
});

PLUGIN_CHANNEL.registerMessageHandler("createRect", (width, height) => {
  if (figma.editorType === "figma") {
    const rect = figma.createRectangle();
    rect.x = 0;
    rect.y = 0;
    rect.name = "Plugin Rectangle # " + Math.floor(Math.random() * 9999);
    rect.fills = [
      {
        type: "SOLID",
        color: {
          r: Math.random(),
          g: Math.random(),
          b: Math.random(),
        },
      },
    ];
    rect.resize(width, height);
    figma.currentPage.appendChild(rect);
    figma.viewport.scrollAndZoomIntoView([rect]);
    figma.closePlugin();
  }
});

PLUGIN_CHANNEL.registerMessageHandler("exportSelection", async () => {
  const selectedNodes = figma.currentPage.selection;
  if (selectedNodes.length === 0) {
    throw new Error("No selection is present.");
  }

  const selection = selectedNodes[0];
  const bytes = await selection.exportAsync({
    format: "PNG",
    contentsOnly: false,
  });

  return "data:image/png;base64," + figma.base64Encode(bytes);
});

PLUGIN_CHANNEL.registerMessageHandler("createSvgSprite" as MessageHandlers, async () => {
  const selectedNodes = figma.currentPage.selection;
  if (selectedNodes.length === 0) {
    throw new Error("No selection is present.");
  }

  // Create an array to store SVG data for each selected node
  const svgElements = [];

  // Process each selected node
  for (const node of selectedNodes) {
    if ("exportAsync" in node) {
      try {
        // Export as SVG
        const svgData = await node.exportAsync({
          format: "SVG",
          svgOutlineText: true,
          svgIdAttribute: true,
          svgSimplifyStroke: true,
        });

        // Convert to string - fix the Uint8Array issue
        const svgString = new TextDecoder().decode(svgData);

        // Extract the SVG content (removing the XML declaration if present)
        const svgContent = svgString.replace(/<\?xml[^>]*\?>/, "").trim();

        // Add to our collection with the node name as ID
        svgElements.push({
          id: node.name.replace(/\s+/g, "-").toLowerCase(),
          content: svgContent,
        });
      } catch (error) {
        console.error(`Error exporting node ${node.name}:`, error);
      }
    }
  }

  return svgElements;
});

PLUGIN_CHANNEL.registerMessageHandler("generateSvgSprite" as MessageHandlers, async () => {
  const selectedNodes = figma.currentPage.selection;
  if (selectedNodes.length === 0) {
    PLUGIN_CHANNEL.emit(UI, "svgSpriteError", ["No selection is present."]);
    return;
  }

  // Create an array to store SVG data for each selected node
  const svgElements = [];

  // Process each selected node
  for (const node of selectedNodes) {
    if ("exportAsync" in node) {
      try {
        // Export as SVG
        const svgData = await node.exportAsync({
          format: "SVG",
          svgOutlineText: true,
          svgIdAttribute: true,
          svgSimplifyStroke: true,
        });

        // Convert to string
        const svgString = new TextDecoder().decode(svgData);

        // Extract the SVG content (removing the XML declaration if present)
        const svgContent = svgString.replace(/<\?xml[^>]*\?>/, "").trim();

        // Add to our collection with the node name as ID
        svgElements.push({
          id: node.name.replace(/\s+/g, "-").toLowerCase(),
          content: svgContent,
        });
      } catch (error) {
        console.error(`Error exporting node ${node.name}:`, error);
      }
    }
  }

  // Send the result back to the UI
  PLUGIN_CHANNEL.emit(UI, "svgSpriteResult", [svgElements]);
});

// Register a handler for resize messages with correct typing
PLUGIN_CHANNEL.registerMessageHandler("resize" as MessageHandlers, (...args) => {
  // The size object is passed as the first parameter
  const size = args[0] as ResizeSize;

  if (size && typeof size.w === "number" && typeof size.h === "number") {
    // Make sure width and height are reasonable values
    const width = Math.max(300, Math.min(1000, size.w));
    const height = Math.max(200, Math.min(800, size.h));

    // Resize the plugin window
    figma.ui.resize(width, height);
    console.log(`Resized plugin window to ${width}x${height}`);
  } else {
    console.error("Invalid resize parameters", size);
  }
});
