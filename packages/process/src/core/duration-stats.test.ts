import { describe, expect, it } from "vitest";

import {
  DURATION_SAMPLE_CAP,
  DurationSampler,
  durationStats,
  emptyDurationStats,
} from "./duration-stats";

describe("durationStats", () => {
  it("computes every member from a hand-checkable sample set", () => {
    // 10 samples, 1000 apart: sum 55 000, mean 5500, median (5000 + 6000) / 2 = 5500,
    // p90 at pos 0.9 * 9 = 8.1 → 9000 + 0.1 * 1000 = 9100, trim floor(10 * 0.1) = 1 each
    // tail → mean of 2000…9000 = 5500.
    const samples = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10_000];
    expect(durationStats(samples)).toEqual({
      min: 1000,
      max: 10_000,
      mean: 5500,
      median: 5500,
      p90: 9100,
      sum: 55_000,
      trimmedMean: 5500,
    });
  });

  it("lets the trimmed mean diverge from the mean when the tails are extreme", () => {
    const samples = [0, 10, 10, 10, 10, 10, 10, 10, 10, 1000];
    const stats = durationStats(samples);
    expect(stats.mean).toBe(108);
    // One sample trimmed from each tail removes the 0 and the 1000.
    expect(stats.trimmedMean).toBe(10);
  });

  it("degrades the trimmed mean to the plain mean when trimming would leave nothing", () => {
    // n = 4 → floor(0.4) = 0 trimmed, so the two agree.
    const stats = durationStats([1, 2, 3, 10]);
    expect(stats.trimmedMean).toBe(stats.mean);
    expect(stats.trimmedMean).toBe(4);
  });

  it("drops non-finite samples instead of poisoning every statistic", () => {
    expect(durationStats([Number.NaN, 10, Number.POSITIVE_INFINITY, 30])).toMatchObject({
      min: 10,
      max: 30,
      mean: 20,
      sum: 40,
    });
  });

  it("answers all zeros for an empty sample set", () => {
    expect(durationStats([])).toEqual(emptyDurationStats());
    expect(durationStats([Number.NaN])).toEqual(emptyDurationStats());
  });

  it("does not mutate the caller's array", () => {
    const samples = [30, 10, 20];
    durationStats(samples);
    expect(samples).toEqual([30, 10, 20]);
  });
});

describe("DurationSampler", () => {
  it("keeps every sample below the cap", () => {
    const sampler = new DurationSampler(1, 8);
    for (const value of [4, 8, 15, 16, 23, 42]) sampler.add(value);
    expect(sampler.size).toBe(6);
    expect(sampler.stats()).toEqual(durationStats([4, 8, 15, 16, 23, 42]));
  });

  it("keeps sum, mean, min and max EXACT past the cap", () => {
    const sampler = new DurationSampler(7, 16);
    let expectedSum = 0;
    for (let i = 1; i <= 5000; i += 1) {
      sampler.add(i);
      expectedSum += i;
    }
    const stats = sampler.stats();
    expect(sampler.size).toBe(5000);
    expect(stats.sum).toBe(expectedSum);
    expect(stats.mean).toBe(expectedSum / 5000);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(5000);
  });

  it("is deterministic — the same seed and inputs give the same order statistics", () => {
    const build = (): ReturnType<DurationSampler["stats"]> => {
      const sampler = new DurationSampler(0x1234, 32);
      for (let i = 0; i < 2000; i += 1) sampler.add((i * 37) % 991);
      return sampler.stats();
    };
    expect(build()).toEqual(build());
  });

  it("estimates the median from the reservoir within a few percent of the truth", () => {
    const sampler = new DurationSampler(99, 512);
    const all: number[] = [];
    for (let i = 0; i < 20_000; i += 1) {
      sampler.add(i);
      all.push(i);
    }
    const truth = durationStats(all).median;
    expect(Math.abs(sampler.stats().median - truth) / truth).toBeLessThan(0.05);
  });

  it("ignores non-finite samples and reports zeros when nothing was collected", () => {
    const sampler = new DurationSampler();
    sampler.add(Number.NaN);
    expect(sampler.size).toBe(0);
    expect(sampler.stats()).toEqual(emptyDurationStats());
  });

  it("defaults to the documented cap", () => {
    expect(DURATION_SAMPLE_CAP).toBe(4096);
  });
});
