// This plugin will convert multiple selected frames into an SVG sprite
// using symbols and use elements.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, { width: 300, height: 200 });

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type === "create-sprite") {
    const selection = figma.currentPage.selection;

    // Check if there are frames selected
    if (selection.length === 0) {
      figma.notify("Please select at least one frame");
      return;
    }

    // Filter out non-frame nodes
    const frames = selection.filter(
      (node) => node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE"
    );

    if (frames.length === 0) {
      figma.notify("Please select at least one frame, component, or instance");
      return;
    }

    // Start building SVG sprite
    let svgSprite = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display: none;">\n`;

    try {
      // Process each frame to create symbols
      for (const frame of frames) {
        // Export the frame as SVG
        const svgBytes = await frame.exportAsync({
          format: "SVG",
          svgOutlineText: true,
          svgIdAttribute: true,
          svgSimplifyStroke: true,
        });

        // Convert bytes to string
        const svgString = String.fromCodePoint(...new Uint8Array(svgBytes));

        // Extract the content from SVG (removing the outer <svg> tags)
        const contentMatch = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
        const content = contentMatch ? contentMatch[1] : "";

        // Create a symbol with a unique ID based on the frame name
        const safeId = frame.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
        svgSprite += `  <symbol id="${safeId}" viewBox="0 0 ${frame.width} ${frame.height}">\n`;
        svgSprite += `    ${content}\n`;
        svgSprite += `  </symbol>\n`;
      }

      // Close the symbol definitions
      svgSprite += `</svg>\n\n`;

      // Send the SVG sprite back to the UI
      figma.ui.postMessage({
        type: "sprite-created",
        sprite: svgSprite,
      });

      figma.notify(`SVG sprite created with ${frames.length} symbols`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      figma.notify(`Error: ${errorMessage}`);
      console.error(error);
    }
  } else if (msg.type === "cancel") {
    figma.closePlugin();
  }
};
