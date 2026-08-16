/* eslint-disable @typescript-eslint/no-explicit-any -- lightweight engine stub; the real surface is exercised by Storybook browser tests */
/**
 * MapLibre can't render in jsdom (no WebGL) — unit tests mock the engine and
 * assert the brand wrappers' own output, mirroring how @qlik-coe-emea/qlabs-components-flow mocks
 * @xyflow/react. Real rendering + a11y come from the Storybook story tests.
 *
 * Usage in a test file:
 *   vi.mock("maplibre-gl", async () => {
 *     const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
 *     return createMaplibreMock();
 *   });
 */

type Handler = (...args: any[]) => void;

export class MockMap {
  static instances: MockMap[] = [];

  handlers = new Map<string, Set<Handler>>();
  container: HTMLElement;
  removed = false;
  sources = new Map<string, any>();
  layers = new Map<string, any>();
  canvas = document.createElement("canvas");
  zoomToCalls: unknown[] = [];

  /** The full options object the component constructed the map with. */
  options: Record<string, any>;

  constructor(options: { container: HTMLElement } & Record<string, any>) {
    this.container = options.container;
    this.options = options;
    MockMap.instances.push(this);
  }

  private key(event: string, layerId?: string) {
    return layerId ? `${event}:${layerId}` : event;
  }

  on(event: string, a: any, b?: any) {
    const layerId = typeof a === "string" ? a : undefined;
    const handler: Handler = typeof a === "function" ? a : b;
    const key = this.key(event, layerId);
    if (!this.handlers.has(key)) this.handlers.set(key, new Set());
    this.handlers.get(key)!.add(handler);
    // Fire lifecycle events immediately so `isLoaded` flips without a real engine.
    if (event === "load" || event === "styledata") handler();
    return this;
  }

  off(event: string, a: any, b?: any) {
    const layerId = typeof a === "string" ? a : undefined;
    const handler: Handler = typeof a === "function" ? a : b;
    this.handlers.get(this.key(event, layerId))?.delete(handler);
    return this;
  }

  remove() {
    this.removed = true;
  }

  getCenter() {
    return { lng: 0, lat: 0 };
  }
  getZoom() {
    return 1;
  }
  getBearing() {
    return 0;
  }
  getPitch() {
    return 0;
  }
  isMoving() {
    return false;
  }
  jumpTo() {}
  easeTo() {}
  flyTo() {}
  zoomTo(zoom: number, options?: unknown) {
    this.zoomToCalls.push([zoom, options]);
  }
  resetNorthPitch() {}
  setStyle() {}
  setProjection() {}
  getContainer() {
    return this.container;
  }
  getCanvas() {
    return this.canvas;
  }
  addSource(id: string, source: any) {
    this.sources.set(id, source);
  }
  getSource(id: string) {
    const source = this.sources.get(id);
    if (!source) return undefined;
    return { ...source, setData: () => {}, getClusterExpansionZoom: async () => 2 };
  }
  removeSource(id: string) {
    this.sources.delete(id);
  }
  addLayer(layer: { id: string }) {
    this.layers.set(layer.id, layer);
  }
  getLayer(id: string) {
    return this.layers.get(id);
  }
  removeLayer(id: string) {
    this.layers.delete(id);
  }
  setPaintProperty() {}
  setLayoutProperty() {}
  setFeatureState() {}
  queryRenderedFeatures() {
    return [];
  }
}

export class MockMarker {
  static instances: MockMarker[] = [];

  element: HTMLElement;
  addedTo: MockMap | null = null;
  popup: unknown = null;
  lngLat = { lng: 0, lat: 0 };

  constructor(options: { element?: HTMLElement } = {}) {
    this.element = options.element ?? document.createElement("div");
    MockMarker.instances.push(this);
  }

  setLngLat(lngLat: [number, number]) {
    this.lngLat = { lng: lngLat[0], lat: lngLat[1] };
    return this;
  }
  getLngLat() {
    return this.lngLat;
  }
  getElement() {
    return this.element;
  }
  addTo(map: MockMap) {
    this.addedTo = map;
    return this;
  }
  remove() {
    this.addedTo = null;
  }
  on() {
    return this;
  }
  off() {
    return this;
  }
  setPopup(popup: unknown) {
    this.popup = popup;
    return this;
  }
  isDraggable() {
    return false;
  }
  setDraggable() {
    return this;
  }
  getOffset() {
    return { x: 0, y: 0 };
  }
  setOffset() {
    return this;
  }
  getRotation() {
    return 0;
  }
  setRotation() {
    return this;
  }
  getRotationAlignment() {
    return "auto";
  }
  setRotationAlignment() {
    return this;
  }
  getPitchAlignment() {
    return "auto";
  }
  setPitchAlignment() {
    return this;
  }
}

export class MockPopup {
  static instances: MockPopup[] = [];

  content: HTMLElement | null = null;

  constructor() {
    MockPopup.instances.push(this);
  }

  setMaxWidth() {
    return this;
  }
  setDOMContent(content: HTMLElement) {
    this.content = content;
    return this;
  }
  setLngLat() {
    return this;
  }
  getLngLat() {
    return null;
  }
  setOffset() {
    return this;
  }
  addTo() {
    return this;
  }
  remove() {
    return this;
  }
  isOpen() {
    return false;
  }
  on() {
    return this;
  }
  off() {
    return this;
  }
}

/** Reset the per-class instance registries between tests. */
export function resetMaplibreMock() {
  MockMap.instances = [];
  MockMarker.instances = [];
  MockPopup.instances = [];
}

/** The module shape to return from `vi.mock("maplibre-gl", ...)`. */
export function createMaplibreMock() {
  return {
    default: { Map: MockMap, Marker: MockMarker, Popup: MockPopup },
    Map: MockMap,
    Marker: MockMarker,
    Popup: MockPopup,
  };
}
