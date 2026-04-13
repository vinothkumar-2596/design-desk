type PixelPulse = {
  color: string;
  duration: number;
  intensity: number;
  size: number;
  startTime: number;
  x: number;
  y: number;
};

const DEFAULT_COLORS = [
  "rgba(255, 255, 255, 0.18)",
  "rgba(125, 211, 252, 0.22)",
  "rgba(251, 191, 204, 0.16)",
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

class PixelCanvasElement extends HTMLElement {
  static get observedAttributes() {
    return ["data-colors", "data-gap", "data-speed", "data-no-focus"];
  }

  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly mediaQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );
  private readonly pulses: PixelPulse[] = [];

  private frameId = 0;
  private height = 0;
  private isActive = false;
  private lastBurstAt = 0;
  private lastFrameAt = 0;
  private parentTarget: HTMLElement | null = null;
  private resizeObserver?: ResizeObserver;
  private width = 0;

  private readonly handleFocusIn = () => {
    if (this.hasAttribute("data-no-focus")) {
      return;
    }

    this.isActive = true;
    this.startLoop();
  };

  private readonly handleFocusOut = (event: FocusEvent) => {
    if (this.hasAttribute("data-no-focus")) {
      return;
    }

    const nextTarget = event.relatedTarget as Node | null;

    if (nextTarget && this.parentTarget?.contains(nextTarget)) {
      return;
    }

    this.isActive = false;
    this.startLoop();
  };

  private readonly handlePointerEnter = () => {
    this.isActive = true;
    this.seedBurst(performance.now());
    this.startLoop();
  };

  private readonly handlePointerLeave = () => {
    this.isActive = false;
    this.startLoop();
  };

  private readonly handleMouseEnter = () => {
    this.isActive = true;
    this.seedBurst(performance.now());
    this.startLoop();
  };

  private readonly handleMouseLeave = () => {
    this.isActive = false;
    this.startLoop();
  };

  private readonly handleReducedMotionChange = () => {
    if (this.getSpeed() > 0) {
      this.startLoop();
      return;
    }

    this.isActive = false;
    this.pulses.length = 0;
    this.stopLoop();
    this.paint(performance.now());
  };

  private readonly animate = (timestamp: number) => {
    this.lastFrameAt = timestamp;
    this.updatePulses(timestamp);
    this.paint(timestamp);

    if (
      (this.isActive && this.getSpeed() > 0) ||
      this.pulses.length > 0
    ) {
      this.frameId = window.requestAnimationFrame(this.animate);
      return;
    }

    this.frameId = 0;
  };

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        pointer-events: none;
        contain: strict;
      }

      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    `;

    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");

    shadow.append(style, this.canvas);
  }

  connectedCallback() {
    this.parentTarget = this.parentElement;
    this.bindParentEvents();
    this.bindReducedMotionEvents();

    this.resizeObserver = new ResizeObserver(() => {
      this.syncCanvasSize();
    });
    this.resizeObserver.observe(this);

    this.syncCanvasSize();
    window.requestAnimationFrame(() => this.syncCanvasSize());
  }

  disconnectedCallback() {
    this.unbindParentEvents();
    this.unbindReducedMotionEvents();
    this.resizeObserver?.disconnect();
    this.stopLoop();
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) {
      return;
    }

    if (name === "data-no-focus") {
      this.unbindFocusEvents();
      this.bindFocusEvents();
    }

    this.syncCanvasSize();

    if (this.getSpeed() <= 0) {
      this.isActive = false;
      this.pulses.length = 0;
      this.stopLoop();
      return;
    }

    this.startLoop();
  }

  private bindParentEvents() {
    if (!this.parentTarget) {
      return;
    }

    this.parentTarget.addEventListener("pointerenter", this.handlePointerEnter);
    this.parentTarget.addEventListener("pointerleave", this.handlePointerLeave);
    this.parentTarget.addEventListener("mouseenter", this.handleMouseEnter);
    this.parentTarget.addEventListener("mouseleave", this.handleMouseLeave);
    this.bindFocusEvents();
  }

  private unbindParentEvents() {
    if (!this.parentTarget) {
      return;
    }

    this.parentTarget.removeEventListener(
      "pointerenter",
      this.handlePointerEnter
    );
    this.parentTarget.removeEventListener(
      "pointerleave",
      this.handlePointerLeave
    );
    this.parentTarget.removeEventListener("mouseenter", this.handleMouseEnter);
    this.parentTarget.removeEventListener("mouseleave", this.handleMouseLeave);
    this.unbindFocusEvents();
  }

  private bindFocusEvents() {
    if (!this.parentTarget || this.hasAttribute("data-no-focus")) {
      return;
    }

    this.parentTarget.addEventListener("focusin", this.handleFocusIn);
    this.parentTarget.addEventListener("focusout", this.handleFocusOut);
  }

  private unbindFocusEvents() {
    if (!this.parentTarget) {
      return;
    }

    this.parentTarget.removeEventListener("focusin", this.handleFocusIn);
    this.parentTarget.removeEventListener("focusout", this.handleFocusOut);
  }

  private bindReducedMotionEvents() {
    this.mediaQuery.addEventListener("change", this.handleReducedMotionChange);
  }

  private unbindReducedMotionEvents() {
    this.mediaQuery.removeEventListener(
      "change",
      this.handleReducedMotionChange
    );
  }

  private syncCanvasSize() {
    const rect = this.getBoundingClientRect();
    this.width = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));

    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    this.canvas.width = Math.max(1, Math.floor(this.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(this.height * dpr));
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.paint(this.lastFrameAt || performance.now());
  }

  private getColors() {
    const rawColors = (this.dataset.colors || "")
      .split(",")
      .map((color) => color.trim())
      .filter(Boolean);

    return rawColors.length > 0 ? rawColors : DEFAULT_COLORS;
  }

  private getGap() {
    return clamp(Number(this.dataset.gap) || 5, 4, 50);
  }

  private getSpeed() {
    if (this.mediaQuery.matches) {
      return 0;
    }

    return clamp(Number(this.dataset.speed) || 35, 0, 100);
  }

  private getBurstSize() {
    const footprint = this.width * this.height;
    const baseCount =
      footprint > 18000 ? 4 : footprint > 10000 ? 3 : 2;

    return this.getSpeed() >= 34 ? baseCount + 1 : baseCount;
  }

  private getSpawnInterval() {
    return clamp(320 - this.getSpeed() * 2.8, 110, 320);
  }

  private startLoop() {
    if (
      this.frameId !== 0 ||
      !((this.isActive && this.getSpeed() > 0) || this.pulses.length > 0)
    ) {
      return;
    }

    this.frameId = window.requestAnimationFrame(this.animate);
  }

  private seedBurst(timestamp: number) {
    if (this.getSpeed() <= 0) {
      return;
    }

    const burstSize = this.getBurstSize() + 4;

    for (let index = 0; index < burstSize; index += 1) {
      this.spawnPulse(timestamp);
    }

    this.lastBurstAt = timestamp;
  }

  private stopLoop() {
    if (this.frameId === 0) {
      return;
    }

    window.cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  private spawnPulse(timestamp: number) {
    const gap = this.getGap();
    const colors = this.getColors();
    const cellSize = clamp(gap * 0.34, 1.5, 3);
    const columns = Math.max(1, Math.floor(this.width / gap));
    const rows = Math.max(1, Math.floor(this.height / gap));
    const column = Math.floor(Math.random() * columns);
    const row = Math.floor(Math.random() * rows);
    const x = clamp(
      column * gap + (gap - cellSize) / 2,
      1,
      Math.max(1, this.width - cellSize - 1)
    );
    const y = clamp(
      row * gap + (gap - cellSize) / 2,
      1,
      Math.max(1, this.height - cellSize - 1)
    );

    this.pulses.push({
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 360 + Math.random() * 320,
      intensity: 0.2 + Math.random() * 0.24,
      size: cellSize,
      startTime: timestamp,
      x,
      y,
    });
  }

  private updatePulses(timestamp: number) {
    if (
      this.isActive &&
      this.getSpeed() > 0 &&
      timestamp - this.lastBurstAt >= this.getSpawnInterval()
    ) {
      const burstSize = this.getBurstSize();

      for (let index = 0; index < burstSize; index += 1) {
        this.spawnPulse(timestamp);
      }

      this.lastBurstAt = timestamp;
    }

    for (let index = this.pulses.length - 1; index >= 0; index -= 1) {
      const pulse = this.pulses[index];
      if (timestamp - pulse.startTime > pulse.duration) {
        this.pulses.splice(index, 1);
      }
    }
  }

  private paint(timestamp: number) {
    if (!this.context) {
      return;
    }

    this.context.clearRect(0, 0, this.width, this.height);

    if (this.width === 0 || this.height === 0) {
      return;
    }

    this.context.save();
    this.context.globalCompositeOperation = "screen";

    for (const pulse of this.pulses) {
      const progress = clamp(
        (timestamp - pulse.startTime) / pulse.duration,
        0,
        1
      );
      const wave = Math.sin(progress * Math.PI);

      if (wave <= 0) {
        continue;
      }

      const alpha = pulse.intensity * wave;
      const size = pulse.size * (0.82 + 0.14 * wave);
      const offset = (pulse.size - size) / 2;

      this.context.globalAlpha = alpha;
      this.context.shadowColor = pulse.color;
      this.context.shadowBlur = 5 * wave;
      this.context.fillStyle = pulse.color;
      this.context.fillRect(
        pulse.x + offset,
        pulse.y + offset,
        size,
        size
      );
    }

    this.context.restore();
  }
}

if (!window.customElements.get("pixel-canvas")) {
  window.customElements.define("pixel-canvas", PixelCanvasElement);
}
