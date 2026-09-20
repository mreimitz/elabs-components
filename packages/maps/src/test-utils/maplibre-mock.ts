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
  addLayerCalls: unknown[] = [];
  paint = new Map<string, unknown>();
  layout = new Map<string, unknown>();
  featureStateCalls: unknown[] = [];
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
  unproject(point: [number, number] | { x: number; y: number }) {
    const [x, y] = Array.isArray(point) ? point : [point.x, point.y];
    return { lng: x / 10 - 180, lat: 90 - y / 10 };
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
  /** Every `jumpTo(options)` the wrapper asked for, in order. */
  jumpToCalls: any[] = [];
  jumpTo(options?: any) {
    this.jumpToCalls.push(options);
  }
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
  /** `[id, image, options]` per call — the pattern registration asserts `pixelRatio`. */
  addImage(id: string, image: unknown, options?: unknown) {
    this.addImageCalls.push([id, image, options]);
    this.images.set(id, image);
  }
  hasImage(id: string) {
    return this.images.has(id);
  }
  removeImage(id: string) {
    this.images.delete(id);
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
  addLayer(layer: { id: string } & Record<string, any>, beforeId?: string) {
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
  /** Layout properties the wrapper set, keyed `<layerId>:<property>`. */
  layoutProperties = new Map<string, unknown>();
  setLayoutProperty(layerId: string, property: string, value: unknown) {
    this.layoutProperties.set(`${layerId}:${property}`, value);
    this.layout.set(`${layerId}:${property}`, value);
  }
  getLayoutProperty(layerId: string, property: string) {
    return this.layoutProperties.get(`${layerId}:${property}`);
  }
  /**
   * The style the map is showing. Like MapLibre's own, it lists every layer
   * the map holds — a test describes a basemap's symbol layers by adding them
   * with `addLayer`.
   */
  getStyle() {
    return { layers: [...this.layers.values()] };
  }
  /** Observable feature-state, keyed by feature id — the hover highlight. */
  featureStates = new Map<string | number, Record<string, unknown>>();
  setFeatureState(target: { source: string; id: string | number }, state: Record<string, unknown>) {
    this.featureStateCalls.push([target, state]);
    this.featureStates.set(target.id, { ...this.featureStates.get(target.id), ...state });
  }
  /** What the next `queryRenderedFeatures` should return; set it per test. */
  queryRenderedFeaturesResult: any[] = [];
  queryRenderedFeaturesCalls: unknown[] = [];
  queryRenderedFeatures(geometry?: unknown, options?: unknown) {
    this.queryRenderedFeaturesCalls.push([geometry, options]);
    return this.queryRenderedFeaturesResult;
  }

  // Camera limits — a plan map clamps pan and zoom to its extent.
  setMinZoom(zoom: number) {
    this.minZoom = zoom;
  }
  setMaxZoom(zoom: number) {
    this.maxZoom = zoom;
  }
  setMaxBounds(bounds: unknown) {
    this.maxBounds = bounds;
  }

  /** A canvas-generated tile re-registered in place, `[id, image]` per call. */
  updateImage(id: string, image: unknown) {
    this.updateImageCalls.push([id, image]);
    this.images.set(id, image);
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
