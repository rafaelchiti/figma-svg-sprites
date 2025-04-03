import { PLUGIN, UI, ResizeSize } from "@common/networkSides";
import { UI_CHANNEL } from "@ui/app.network";
import React, { useRef } from "react";

interface ResizeMessage {
  type: "resize";
  size: {
    w: number;
    h: number;
  };
}

const ResizableCorner: React.FC = () => {
  const cornerRef = useRef<SVGSVGElement | null>(null);

  const resizeWindow = (e: globalThis.PointerEvent) => {
    try {
      const size = {
        w: Math.max(50, Math.floor(e.clientX + 5)),
        h: Math.max(50, Math.floor(e.clientY + 5)),
      };

      // Send resize message to plugin using the UI_CHANNEL
      // The emit function doesn't return a promise, so we can't chain .catch
      UI_CHANNEL.emit(PLUGIN, "resize", [size]);
    } catch (err) {
      // Catch any synchronous errors that might occur
      console.error("Error in resize handler:", err);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const corner = cornerRef.current;
    if (!corner) return;

    // Assign the event handler directly to the DOM element
    corner.onpointermove = resizeWindow as unknown as (
      this: GlobalEventHandlers,
      ev: PointerEvent
    ) => any;
    corner.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const corner = cornerRef.current;
    if (!corner) return;

    corner.onpointermove = null;
    corner.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="size-[20px] cursor-nwse-resize  pointer-events-auto">
      <svg
        ref={cornerRef}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-full opacity-70 hover:opacity-100 transition-opacity"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <path d="M16 0V16H0L16 0Z" fill="white" />
        <path d="M6.22577 16H3L16 3V6.22576L6.22577 16Z" fill="#8C8C8C" />
        <path d="M11.8602 16H8.63441L16 8.63441V11.8602L11.8602 16Z" fill="#8C8C8C" />
      </svg>
    </div>
  );
};

export default ResizableCorner;
