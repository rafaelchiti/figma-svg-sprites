/**
 *
 */
import { useState, useEffect } from "react";
import { PLUGIN, SvgElement } from "@common/networkSides";
import ResizableCorner from "./draft/ResizableCorner";

export default function App() {
  const [svgElements, setSvgElements] = useState<SvgElement[]>([]);
  const [spriteContent, setSpriteContent] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [cssClasses, setCssClasses] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Listen for messages from the plugin
    const handleMessage = (event: MessageEvent) => {
      if (!event.data?.pluginMessage) return;

      const message = event.data.pluginMessage;

      // Check if it's a svgSpriteResult message
      if (message.type === "svgSpriteResult" && Array.isArray(message.elements)) {
        const elements = message.elements as SvgElement[];
        console.log(`Received ${elements.length} SVG elements from plugin`);

        // Check if we actually have elements
        if (elements.length === 0) {
          setError(
            "No valid SVG elements were exported. Make sure you've selected SVG-compatible layers."
          );
          setIsLoading(false);
          return;
        }

        setSvgElements(elements);

        // Generate SVG sprite content
        let svgSprite = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display: none;">\n`;

        // Keep track of IDs to ensure uniqueness
        const newUsedIds = new Set<string>();
        const newCssClasses = new Set<string>();

        for (const element of elements) {
          // Debug info
          console.log(`Processing element with ID: ${element.id}`);
          console.log(`SVG content length: ${element.content.length}`);

          // Make sure the SVG content is not empty and is valid
          if (!element.content || element.content.length < 10) {
            console.warn(`Skipping element with ID ${element.id} due to empty/invalid content`);
            continue;
          }

          // Check if the content is base64 encoded
          let svgContent = element.content;
          if (!svgContent.includes("<svg") && !svgContent.includes("<?xml")) {
            // It might be base64 encoded, try to decode it
            try {
              console.log("Attempting to treat content as base64");
              // Create a data URL and extract content
              setError(
                "Some shapes couldn't be processed. Try converting complex shapes to vectors first using Object > Flatten Selection."
              );
              continue;
            } catch (err) {
              console.error("Error decoding potential base64 content", err);
              continue;
            }
          }

          // Create a valid and unique ID
          let symbolId = element.id.replace(/\s+/g, "-").toLowerCase();

          // Create a CSS class name based on the ID
          let className = `${symbolId}`;

          // Ensure ID starts with a letter (required for valid SVG/HTML IDs)
          if (!/^[a-z]/i.test(symbolId)) {
            symbolId = `${symbolId}`;
          }

          // Ensure uniqueness
          if (newUsedIds.has(symbolId)) {
            let counter = 1;
            let newId = `${symbolId}-${counter}`;
            while (newUsedIds.has(newId)) {
              counter++;
              newId = `${symbolId}-${counter}`;
            }
            symbolId = newId;
            className = `${newId}`;
          }

          newUsedIds.add(symbolId);
          newCssClasses.add(className);

          // Extract viewBox from original SVG if available
          const viewBoxMatch = svgContent.match(/viewBox=["']([^"']*)["']/);
          const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24"; // Default if not found

          // Create a symbol element with the extracted content - use both ID and class
          svgSprite += `  <symbol id="${symbolId}" class="${className}" viewBox="${viewBox}">\n`;

          // Extract the content between <svg> and </svg> tags - Fixed regex
          const svgTagMatch = /<svg[^>]*>([\s\S]*?)<\/svg>/i.exec(svgContent);
          let contentBetweenTags = svgTagMatch && svgTagMatch[1] ? svgTagMatch[1].trim() : "";

          // If no content was extracted but we have SVG, try a different approach
          if (!contentBetweenTags && svgContent.includes("<svg")) {
            // Get everything after the opening svg tag and before the closing svg tag
            const openingSvgEnd = svgContent.indexOf(">", svgContent.indexOf("<svg")) + 1;
            const closingSvgStart = svgContent.lastIndexOf("</svg>");

            if (openingSvgEnd > 0 && closingSvgStart > openingSvgEnd) {
              contentBetweenTags = svgContent.substring(openingSvgEnd, closingSvgStart).trim();
            } else {
              console.warn(`Couldn't extract SVG content for ${symbolId}`);
            }
          }

          // Replace IDs with classes on non-symbol elements
          // This regex finds all id="..." attributes except on <symbol> tags
          if (contentBetweenTags) {
            // First, save all the existing IDs so we can re-use them as class names
            const idMatches = Array.from(contentBetweenTags.matchAll(/id=["']([^"']*)["']/g));
            const idToClass = new Map();

            idMatches.forEach((match) => {
              // Create a safe class name from the ID
              const idValue = match[1];
              const className = `${idValue.replace(/[^\w-]/g, "-")}`;
              idToClass.set(idValue, className);
            });

            // Replace id attributes with class attributes, keeping track of what we change
            contentBetweenTags = contentBetweenTags.replace(
              /(<(?!symbol)[^>]+)id=["']([^"']*)["']/g,
              (match, prefix, idValue) => {
                const className = idToClass.get(idValue);
                // If there's already a class attribute, append to it
                if (prefix.includes('class="')) {
                  return prefix.replace(/class=["']([^"']*)["']/, `class="$1 ${className}"`);
                } else if (prefix.includes("class='")) {
                  return prefix.replace(/class=['"]([^"']*)['"]/, `class='$1 ${className}'`);
                } else {
                  // Add a new class attribute
                  return `${prefix} class="${className}"`;
                }
              }
            );

            // Fix any xlink:href="#id" references to match the IDs we kept on symbols
            // This is important for marker-start, marker-end, fill, etc. that reference other elements
            contentBetweenTags = contentBetweenTags.replace(
              /xlink:href=["']#([^"']*)["']/g,
              (match, idValue) => {
                // If this ID refers to an element we converted to a class, point it to the symbol ID instead
                if (idToClass.has(idValue)) {
                  console.warn(
                    `Fixed broken reference to #${idValue} - referencing symbol's ID instead`
                  );
                  return `xlink:href="#${symbolId}"`;
                }
                return match;
              }
            );
          }

          // Use a placeholder if we still couldn't extract content
          if (!contentBetweenTags) {
            contentBetweenTags = `<rect width="24" height="24" fill="currentColor" opacity="0.2" class="placeholder-rect" />
            <text x="50%" y="50%" font-family="sans-serif" font-size="5" text-anchor="middle" dominant-baseline="middle" class="placeholder-text">No Content</text>`;
            console.warn(`Using placeholder for ${symbolId} due to extraction issues`);
          }

          svgSprite += `    ${contentBetweenTags}\n`;
          svgSprite += `  </symbol>\n`;
        }

        // If no symbols were added, show an error
        if (newUsedIds.size === 0) {
          setError(
            "Failed to extract content from any of the selected shapes. Please try selecting a different shape or converting to vector first (Object > Flatten Selection)."
          );
          setIsLoading(false);
          return;
        }

        svgSprite += `</svg>`;

        // Update state with new values
        setUsedIds(newUsedIds);
        setCssClasses(newCssClasses);
        setSpriteContent(svgSprite);
        setIsLoading(false);
        setError(null); // Clear any previous errors
      }

      // Check if it's an error message
      if (message.type === "svgSpriteError") {
        setError(message.message);
        setIsLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const generateSprite = () => {
    setIsLoading(true);
    setError(null);
    setSvgElements([]);
    setSpriteContent("");
    setUsedIds(new Set());
    setCssClasses(new Set());

    try {
      // Use the low-level API to avoid typing issues
      parent.postMessage(
        {
          pluginMessage: {
            type: "generateSvgSprite",
          },
        },
        "*"
      );
    } catch (err) {
      console.error("Error sending message to plugin:", err);
      setError("Failed to communicate with the plugin. Please try again.");
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!spriteContent) return;

    // Create a fallback method that works in more environments
    const copyFallback = () => {
      // Create a temporary textarea element
      const textArea = document.createElement("textarea");
      textArea.value = spriteContent;

      // Make it invisible but part of the document
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);

      // Select the text
      textArea.focus();
      textArea.select();

      // Execute the copy command
      let success = false;
      try {
        success = document.execCommand("copy");
        if (success) {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        } else {
          console.error("Failed to copy with execCommand");
        }
      } catch (err) {
        console.error("Error during copy operation", err);
      }

      // Clean up
      document.body.removeChild(textArea);
      return success;
    };

    // Try using the modern Clipboard API first
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(spriteContent)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch((err) => {
          console.error("Clipboard API failed, falling back to execCommand", err);
          copyFallback();
        });
    } else {
      // Use the fallback for older browsers or environments without Clipboard API
      copyFallback();
    }
  };

  //
  // --------------------
  //
  return (
    <div className="🏷️-App size-full overflow-auto p-4 relative bg-violet-200">
      <h1 className="text-xl font-bold mb-4">SVG Sprite Generator</h1>

      <div className="">
        <p className="">
          Select SVG layers in Figma and click the button below to generate an SVG sprite.
        </p>
        <button
          onClick={generateSprite}
          disabled={isLoading}
          className={`px-4 py-2 rounded text-white ${
            isLoading ? "bg-blue-300" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {isLoading ? "Generating..." : "Generate SVG Sprite"}
        </button>
      </div>

      {error && <div className="p-2 bg-red-100 text-red-700 rounded">{error}</div>}

      {/**
       *  Selected Elements
       * */}
      {svgElements.length > 0 && (
        <div className="">
          <h2 className="text-lg font-semibold mb-2">Selected Elements ({svgElements.length})</h2>
          <ul className="p-2 max-h-32 overflow-y-auto flex gap-2">
            {svgElements.map((element) => (
              <li key={element.id} className="text-sm py-1 ring-1 p-1">
                {element.id}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/**
       *  Sprite Code
       * */}
      {spriteContent && (
        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center ">
            <h2 className="text-lg font-semibold">SVG Sprite Code</h2>
            <button
              onClick={copyToClipboard}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              {isCopied ? "Copied!" : "Copy to Clipboard"}
            </button>
          </div>

          <div className="flex-1 border rounded p-2 bg-gray-50 overflow-auto max-h-[200px]">
            <pre className="text-xs whitespace-pre-wrap">{spriteContent}</pre>
          </div>

          {/**
           *  Preview
           * */}
          <div className="mt-4">
            <h2 className="text-lg font-semibold mb-2">Preview</h2>
            <div dangerouslySetInnerHTML={{ __html: spriteContent }} />
            <div className="p-3 border rounded bg-white flex   gap-4">
              {usedIds &&
                Array.from(usedIds).map((id, index) => {
                  const className = Array.from(cssClasses)[index] || "";
                  return (
                    <div key={id} className="flex flex-col items-center">
                      <div className="flex justify-center items-center p-2 border rounded w-12 h-12 bg-gray-50">
                        <svg className="text-blue-500 size-full">
                          <use xlinkHref={`#${id}`} className={className}></use>
                        </svg>
                      </div>
                      <div
                        className="text-xs mt-1 text-center text-gray-500 truncate w-full"
                        title={id}
                      >
                        {id}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-1 right-1">
        <ResizableCorner />
      </div>
    </div>
  );
}
