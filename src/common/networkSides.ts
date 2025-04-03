import { Networker } from "monorepo-networker";

// Define a type for the SVG element
export type SvgElement = {
  id: string;
  content: string;
};

// Define resize size type
export interface ResizeSize {
  w: number;
  h: number;
}

export const UI = Networker.createSide("UI-side").listens<{
  ping(): "pong";
  hello(text: string): void;
  svgSpriteResult(elements: SvgElement[]): void;
  svgSpriteError(message: string): void;
}>();

export const PLUGIN = Networker.createSide("Plugin-side").listens<{
  ping(): "pong";
  hello(text: string): void;
  createRect(width: number, height: number): void;
  exportSelection(): Promise<string>;
  createSvgSprite(): Promise<Array<SvgElement>>;
  generateSvgSprite(): void;
  resize(size: ResizeSize): void;
}>();
