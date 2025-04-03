import { PLUGIN, UI, SvgElement } from "@common/networkSides";

export const UI_CHANNEL = UI.channelBuilder()
  .emitsTo(PLUGIN, (message) => {
    parent.postMessage({ pluginMessage: message }, "*");
  })
  .receivesFrom(PLUGIN, (next) => {
    const listener = (event: MessageEvent) => {
      if (event.data?.pluginId == null) return;
      next(event.data.pluginMessage);
    };

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  })
  .startListening();

// ---------- Message handlers

UI_CHANNEL.registerMessageHandler("ping", () => {
  return "pong";
});

UI_CHANNEL.registerMessageHandler("hello", (text) => {
  console.log("Plugin side said", text);
});

UI_CHANNEL.registerMessageHandler("svgSpriteResult", (elements) => {
  // This will be overridden in the App component
});

UI_CHANNEL.registerMessageHandler("svgSpriteError", (message) => {
  // This will be overridden in the App component
});
