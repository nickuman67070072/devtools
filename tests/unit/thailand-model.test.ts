import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { provinceHeight, modelProjection } from '@/features/map/thailand-scene';
import { groupHouses, type MapHouse } from '@/features/map/map-types';

describe('user supplied Thailand model', () => {
  it('contains 77 unique provinces with self-contained geometry and projection', () => {
    const bytes = readFileSync('public/models/thailand-77-provinces.glb');
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '6ebcbf08f1eccd47ee6e4ba87f4ee167bd7155d501412aac07f53efd504b3ccb',
    );
    const model = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12))) as {
      nodes: { extras: { provinceCode: string; labelPosition: number[]; labelLonLat: number[] } }[];
      buffers: { uri?: string }[];
      scenes: { extras: { unitsPerMeter: number; projectedCenterMeters: [number, number] } }[];
    };
    expect(new Set(model.nodes.map((node) => node.extras.provinceCode)).size).toBe(77);
    expect(model.buffers.every((buffer) => !buffer.uri)).toBe(true);
    const projection = modelProjection(model.scenes[0]!.extras);
    for (const node of model.nodes) {
      const [longitude, latitude] = node.extras.labelLonLat as [number, number];
      const { x, z } = projection(longitude, latitude);
      expect(x).toBeCloseTo(node.extras.labelPosition[0]!, 6);
      expect(z).toBeCloseTo(node.extras.labelPosition[2]!, 6);
    }
  });
  it('raises the province on every additional place and retains a visible base', () => {
    expect(provinceHeight(0)).toBe(0.12);
    for (let count = 1; count <= 1000; count++)
      expect(provinceHeight(count)).toBeGreaterThan(provinceHeight(count - 1));
  });
  it('groups overlapping houses without merging separate provinces or locations', () => {
    const house: MapHouse = {
      id: 'first',
      provinceCode: '10',
      longitude: 100.5,
      latitude: 13.75,
      color: '#fff',
    };
    const groups = groupHouses([
      house,
      { ...house, id: 'second', longitude: 100.500001 },
      { ...house, id: 'other-province', provinceCode: '11' },
      { ...house, id: 'other-location', longitude: 100.6 },
    ]);
    expect(groups.map((group) => group.map((item) => item.id))).toEqual([
      ['first', 'second'],
      ['other-province'],
      ['other-location'],
    ]);
  });
});
