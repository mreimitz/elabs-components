"use client";

import type { FeatureCollection, Geometry } from "geojson";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { feature } from "topojson-client";

// TODO(consumer): replace with a self-hosted topojson source
const WORLD_DATA_URL =
  "https://raw.githubusercontent.com/subyfly/topojson/refs/heads/master/world-countries.json";

interface CountryProperties {
  name: string;
  [key: string]: unknown;
}

/** Minimal inline topology types — avoids a dependency on topojson-specification. */
interface LocalGeometryCollection {
  type: string;
  geometries: unknown[];
  [key: string]: unknown;
}

interface LocalTopology {
  type: "Topology";
  objects: {
    [key: string]: LocalGeometryCollection;
  };
  arcs: unknown[];
  [key: string]: unknown;
}

// Global cache to avoid refetching across component mounts
let globalWorldDataCache: FeatureCollection<Geometry, CountryProperties> | null = null;
let globalFetchPromise: Promise<FeatureCollection<Geometry, CountryProperties> | null> | null =
  null;

function fetchWorldData(): Promise<FeatureCollection<Geometry, CountryProperties> | null> {
  // Return cached data if available
  if (globalWorldDataCache) {
    return Promise.resolve(globalWorldDataCache);
  }

  // Return existing promise if fetch is in progress
  if (globalFetchPromise) {
    return globalFetchPromise;
  }

  // Start new fetch
  globalFetchPromise = (async () => {
    try {
      const response = await fetch(WORLD_DATA_URL);
      const topology = (await response.json()) as LocalTopology;
      const objectKey = Object.keys(topology.objects)[0];
      if (!objectKey) {
        throw new Error("No objects found in topology");
      }
      const geoObject = topology.objects[objectKey];
      if (!geoObject) {
        throw new Error("Object not found in topology");
      }
      const geojson = feature(
        topology as unknown as Parameters<typeof feature>[0],
        geoObject as unknown as Parameters<typeof feature>[1],
      ) as unknown as FeatureCollection<Geometry, CountryProperties>;
      globalWorldDataCache = geojson;
      return geojson;
    } catch (error) {
      console.error("Failed to fetch world data:", error);
      return null;
    }
  })();

  return globalFetchPromise;
}

interface WorldDataContextValue {
  worldData: FeatureCollection<Geometry, CountryProperties> | null;
  isLoading: boolean;
}

const WorldDataContext = createContext<WorldDataContextValue>({
  worldData: null,
  isLoading: true,
});

export function WorldDataProvider({ children }: { children: ReactNode }) {
  const [worldData, setWorldData] = useState<FeatureCollection<Geometry, CountryProperties> | null>(
    globalWorldDataCache,
  );
  const [isLoading, setIsLoading] = useState(!globalWorldDataCache);

  useEffect(() => {
    if (globalWorldDataCache) {
      setWorldData(globalWorldDataCache);
      setIsLoading(false);
      return;
    }

    fetchWorldData().then((data) => {
      setWorldData(data);
      setIsLoading(false);
    });
  }, []);

  return (
    <WorldDataContext.Provider value={{ worldData, isLoading }}>
      {children}
    </WorldDataContext.Provider>
  );
}

export function useWorldData() {
  return useContext(WorldDataContext);
}

// Standalone hook for components that don't have the provider
export function useWorldDataStandalone() {
  const [worldData, setWorldData] = useState<FeatureCollection<Geometry, CountryProperties> | null>(
    globalWorldDataCache,
  );
  const [isLoading, setIsLoading] = useState(!globalWorldDataCache);

  useEffect(() => {
    if (globalWorldDataCache) {
      setWorldData(globalWorldDataCache);
      setIsLoading(false);
      return;
    }

    fetchWorldData().then((data) => {
      setWorldData(data);
      setIsLoading(false);
    });
  }, []);

  return { worldData, isLoading };
}
