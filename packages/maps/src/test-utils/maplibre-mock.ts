/* eslint-disable @typescript-eslint/no-explicit-any -- lightweight engine stub; the real surface is exercised by Storybook browser tests */
/**
 * MapLibre can't render in jsdom (no WebGL) — unit tests mock the engine and
 * assert the brand wrappers' own output, mirroring how @elabs-ai/components-flow mocks
 * @xyflow/react. Real rendering + a11y come from the Storybook story tests.
 *
 * Usage in a test file:
 *   vi.mock("maplibre-gl", async () => {
 *     const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
 *     return createMaplibreMock();
 *   });
 */

type Handler = (...args: any[]) => void;

export class MockHandler {
  enabled = true;
  enable() {
    this.enabled = true;
  }
  disable() {
    this.enabled = false;
  }
  isEnabled() {
    return this.enabled;
  }
}

export class MockMap {
  static instances: MockMap[] = [];

  handlers = new Map<string, Set<Handler>>();
  container: HTMLElement;
  removed = false;
  sources = new Map<string, any>();
  layers = new Map<string, any>();
  canvas = document.createElement("canvas");
  /** Starts with MapLibre's interactive class, as a real interactive map's does. */
  canvasContainer = Object.assign(document.createElement("div"), {
    className: "maplibregl-canvas-container maplibregl-interactive",
  });
  zoomToCalls: unknown[] = [];
  images = new Map<string, unknown>();
  center = { lng: 0, lat: 0 };
  zoom = 1;
  bearing = 0;

  /** Gesture handlers, each with an `enabled` flag static mode flips. */
  scrollZoom = new MockHandler();
  boxZoom = new MockHandler();
  dragRotate = new MockHandler();
  dragPan = new MockHandler();
  keyboard = new MockHandler();
  doubleClickZoom = new MockHandler();
  touchZoomRotate = new MockHandler();
  touchPitch = new MockHandler();

  /** The full options object the component constructed the map with. */
  options: Record<string, any>;

  constructor(options: { container: HTMLElement } & Record<string, any>) {
    this.container = options.container;
    this.options = options;
    // What MapLibre would measure: the box's height rule at construction time,
    // and whether that rule could still be mid-transition when it measured.
    this.aspectAtConstruction = options.container.style.aspectRatio;
    this.transitionAtConstruction = options.container.style.transitionProperty;
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

  /** Manually re-fire an event's handlers — e.g. a second `styledata` after a style reload. */
  emit(event: string, layerId?: string, ...args: unknown[]) {
    this.handlers.get(this.key(event, layerId))?.forEach((handler) => {
      handler(...args);
    });
  }

  remove() {
    this.removed = true;
  }

  getCenter() {
    return this.center;
  }
  getZoom() {
    return this.zoom;
  }
  getBearing() {
    return this.bearing;
  }
  /**
   * A flat equirectangular stand-in: 1° = 10 px from the container's top-left.
   * Accepts both shapes MapLibre's own `project` does — a `[lng, lat]` pair
   * and a `LngLat`.
   */
  project(lngLat: [number, number] | { lng: number; lat: number }) {
    const [lng, lat] = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
    return { x: (lng + 180) * 10, y: (90 - lat) * 10 };
  }
  /** Inverse of {@link project} — the same flat equirectangular stand-in. */
  unproject(point: [number, number]) {
    return { lng: point[0] / 10 - 180, lat: 90 - point[1] / 10 };
  }
  getBounds() {
    return {
      getWest: () => -10,
      getSouth: () => -10,
      getEast: () => 10,
      getNorth: () => 10,
    };
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
  /** Every `fitBounds(bounds, options)` the wrapper asked for, in order. */
  fitBoundsCalls: { bounds: unknown; options: unknown }[] = [];
  fitBounds(bounds: unknown, options?: unknown) {
    this.fitBoundsCalls.push({ bounds, options });
    return this;
  }
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
  aspectAtConstruction = "";
  transitionAtConstruction = "";
  resizeCount = 0;
  resize() {
    this.resizeCount += 1;
    return this;
  }
  getCanvasContainer() {
    return this.canvasContainer;
  }
  addImage(id: string, image: unknown) {
    this.images.set(id, image);
  }
  hasImage(id: string) {
    return this.images.has(id);
  }
  removeImage(id: string) {
    this.images.delete(id);
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
  /** The full options object the component constructed the marker with. */
  options: Record<string, any>;

  constructor(options: { element?: HTMLElement } & Record<string, any> = {}) {
    this.element = options.element ?? document.createElement("div");
    this.options = options;
    MockMarker.instances.push(this);
  }

  /** Accepts both shapes MapLibre does: a `[lng, lat]` pair and a `LngLat`. */
  setLngLat(lngLat: [number, number] | { lng: number; lat: number }) {
    this.lngLat = Array.isArray(lngLat)
      ? { lng: lngLat[0], lat: lngLat[1] }
      : { lng: lngLat.lng, lat: lngLat.lat };
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
  /** Whether the popup is currently on a map — what `addTo`/`remove` toggle. */
  open = false;

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
    this.open = true;
    return this;
  }
  remove() {
    this.open = false;
    return this;
  }
  isOpen() {
    return this.open;
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
