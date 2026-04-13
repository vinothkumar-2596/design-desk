import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "pixel-canvas": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        class?: string;
        "data-colors"?: string;
        "data-gap"?: number | string;
        "data-speed"?: number | string;
        "data-no-focus"?: boolean | "";
      };
    }
  }
}

export {};
