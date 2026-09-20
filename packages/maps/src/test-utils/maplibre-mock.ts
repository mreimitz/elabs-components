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

/**
 * One persistent instance per source id, so a component that subscribes to its
 * own source (`source.on("error", …)`) or updates it in place
 * (`setCoordinates`/`updateImage`) can be asserted against. The spec fields are
 * spread onto the instance, so reads like `source.type` still work.
 */
export class MockSource {
  static instances: MockSource[] = [];

  id: string;
  spec: Record<string, any>;
  handlers = new Map<string, Set<Handler>>();
  setDataCalls: unknown[] = [];
  coordinatesCalls: unknown[] = [];
  updateImageCalls: unknown[] = [];

  constructor(id: string, spec: Record<string, any>) {
    this.id = id;
    this.spec = spec;
    Object.assign(this, spec);
    MockSource.instances.push(this);
  }

  setData(data: unknown) {
    this.setDataCalls.push(data);
    return this;
  }
  setCoordinates(coordinates: unknown) {
    this.coordinatesCalls.push(coordinates);
    return this;
  }
  updateImage(options: unknown) {
    this.updateImageCalls.push(options);
    return this;
  }
  async getClusterExpansionZoom() {
    return 2;
  }
  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return this;
  }
  off(event: string, handler: Handler) {
    this.handlers.get(event)?.delete(handler);
    return this;
  }
  /** Fire an event on this source — e.g. a failed image fetch. */
  emit(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.forEach((handler) => {
      handler(...args);
    });
  }
}

export class MockMap {
  static instances: MockMap[] = [];

  handlers = new Map<string, Set<Handler>>();
  container: HTMLElement;
  removed = false;
  sources = new Map<string, MockSource>();
  layers = new Map<string, any>();
  canvas = document.createElement("canvas");
  zoomToCalls: unknown[] = [];
  addLayerCalls: unknown[] = [];
  paint = new Map<string, unknown>();
  layout = new Map<string, unknown>();
  featureStateCalls: unknown[] = [];
  fitBoundsCalls: [unknown, unknown][] = [];
  images = new Map<string, unknown>();
  /** `[id, image, options]` per `addImage` — the pattern registration asserts `pixelRatio`. */
  addImageCalls: [string, unknown, unknown][] = [];
  updateImageCalls: [string, unknown][] = [];
  minZoom: number | undefined;
  maxZoom: number | undefined;
  maxBounds: unknown;

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
    this.sources.set(id, new MockSource(id, source));
  }
  getSource(id: string) {
    return this.sources.get(id);
  }
  removeSource(id: string) {
    this.sources.delete(id);
  }
  addLayer(layer: { id: string }, beforeId?: string) {
    this.layers.set(layer.id, layer);
    this.addLayerCalls.push([layer, beforeId]);
  }
  getLayer(id: string) {
    return this.layers.get(id);
  }
  removeLayer(id: string) {
    this.layers.delete(id);
  }
  setPaintProperty(layerId: string, name: string, value: unknown) {
    this.paint.set(`${layerId}:${name}`, value);
  }
  setLayoutProperty(layerId: string, name: string, value: unknown) {
    this.layout.set(`${layerId}:${name}`, value);
  }
  setFeatureState(target: { source: string; id: string | number }, state: Record<string, unknown>) {
    this.featureStateCalls.push([target, state]);
  }
  /** What the next `queryRenderedFeatures` should return; set it per test. */
  queryRenderedFeaturesResult: any[] = [];
  queryRenderedFeaturesCalls: unknown[] = [];
  queryRenderedFeatures(geometry?: unknown, options?: unknown) {
    this.queryRenderedFeaturesCalls.push([geometry, options]);
    return this.queryRenderedFeaturesResult;
  }

  // Camera limits and framing — a plan map clamps pan and zoom to its extent.
  setMinZoom(zoom: number) {
    this.minZoom = zoom;
  }
  setMaxZoom(zoom: number) {
    this.maxZoom = zoom;
  }
  setMaxBounds(bounds: unknown) {
    this.maxBounds = bounds;
  }
  fitBounds(bounds: unknown, options?: unknown) {
    this.fitBoundsCalls.push([bounds, options]);
  }
  getBounds() {
    return {
      getWest: () => -1,
      getSouth: () => -1,
      getEast: () => 1,
      getNorth: () => 1,
    };
  }

  // Screen projection — the plan overlay tracks shapes through these.
  project(lngLat: [number, number] | { lng: number; lat: number }) {
    const [lng, lat] = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
    return { x: (lng + 180) * 2, y: (90 - lat) * 2 };
  }
  unproject(point: { x: number; y: number }) {
    return { lng: point.x / 2 - 180, lat: 90 - point.y / 2 };
  }

  // Style images — canvas-generated hatch patterns register through these.
  addImage(id: string, image: unknown, options?: unknown) {
    this.addImageCalls.push([id, image, options]);
    this.images.set(id, image);
  }
  hasImage(id: string) {
    return this.images.has(id);
  }
  updateImage(id: string, image: unknown) {
    this.updateImageCalls.push([id, image]);
    this.images.set(id, image);
  }
  removeImage(id: string) {
    this.images.delete(id);
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

/**
 * The real Web Mercator transform, so a plan coordinate system behaves under
 * test exactly as it does in a browser.
 */
export class MockMercatorCoordinate {
  constructor(
    public x: number,
    public y: number,
    public z = 0,
  ) {}

  static fromLngLat(lngLat: { lng: number; lat: number } | [number, number], altitude = 0) {
    const [lng, lat] = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
    const x = (180 + lng) / 360;
    const y =
      (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360;
    return new MockMercatorCoordinate(x, y, altitude);
  }

  toLngLat() {
    const lng = this.x * 360 - 180;
    const y2 = 180 - this.y * 360;
    const lat = (360 / Math.PI) * (Math.atan(Math.exp((y2 * Math.PI) / 180)) - Math.PI / 4);
    return { lng, lat };
  }
}

/** Reset the per-class instance registries between tests. */
export function resetMaplibreMock() {
  MockMap.instances = [];
  MockMarker.instances = [];
  MockPopup.instances = [];
  MockSource.instances = [];
}

/** The module shape to return from `vi.mock("maplibre-gl", ...)`. */
export function createMaplibreMock() {
  return {
    default: {
      Map: MockMap,
      Marker: MockMarker,
      Popup: MockPopup,
      MercatorCoordinate: MockMercatorCoordinate,
    },
    Map: MockMap,
    Marker: MockMarker,
    Popup: MockPopup,
    MercatorCoordinate: MockMercatorCoordinate,
  };
}
