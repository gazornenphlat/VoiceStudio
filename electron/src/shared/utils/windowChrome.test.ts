import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAC_TRAFFIC_LIGHTS,
  MAC_TRAFFIC_LIGHTS_BAND,
  MAC_TRAFFIC_LIGHTS_GAP,
  MAC_TRAFFIC_LIGHTS_HEIGHT,
} from './windowChrome';

describe('macOS window chrome', () => {
  it('reserves the whole cluster plus a gap above sidebar content', () => {
    expect(MAC_TRAFFIC_LIGHTS_BAND).toBe(
      MAC_TRAFFIC_LIGHTS.y + MAC_TRAFFIC_LIGHTS_HEIGHT + MAC_TRAFFIC_LIGHTS_GAP,
    );
    expect(MAC_TRAFFIC_LIGHTS_BAND).toBeGreaterThanOrEqual(MAC_TRAFFIC_LIGHTS.y + 22);
  });

});
