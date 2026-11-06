import { describe, expect, test, vi } from 'vitest';

import {
  DISTRIBUTION_TARGETS,
  distributionProfile,
  resolveDistributionTarget,
} from '../../../config/distributions.mjs';
import {
  applicationUpdatesSupported,
  applicationUpdatesUnsupportedReason,
  runtimeSetupSupported,
} from './distribution';

describe('distribution contract', () => {
  test('accepts only the two maintained Windows distribution identities', () => {
    expect(DISTRIBUTION_TARGETS).toEqual(['direct', 'microsoft-store']);
    expect(resolveDistributionTarget('')).toBe('direct');
    expect(resolveDistributionTarget(' microsoft-store ')).toBe('microsoft-store');
    expect(() => resolveDistributionTarget('snap-store')).toThrow(
      'Unsupported VoiceStudio distribution',
    );
  });

  test('uses the build environment only when no target is passed', () => {
    vi.stubEnv('VOICESTUDIO_DISTRIBUTION', 'microsoft-store');
    try {
      expect(resolveDistributionTarget()).toBe('microsoft-store');
      expect(resolveDistributionTarget('direct')).toBe('direct');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test('records update ownership without treating Microsoft EXE listings as managed packages', () => {
    expect(distributionProfile('direct').applicationUpdates).toBe('application');
    expect(distributionProfile('microsoft-store').applicationUpdates).toBe('application');
  });

  test('store ownership cannot be bypassed by a runtime environment variable', () => {
    expect(applicationUpdatesSupported(true, 'direct', false)).toBe(true);
    expect(applicationUpdatesSupported(true, 'direct', true)).toBe(false);
    expect(applicationUpdatesSupported(true, 'microsoft-store', false)).toBe(true);
    expect(applicationUpdatesSupported(false, 'direct', false)).toBe(false);
  });

  test('names why updates are unsupported, development first', () => {
    expect(applicationUpdatesUnsupportedReason(true, 'direct', false)).toBeNull();
    expect(applicationUpdatesUnsupportedReason(false, 'direct', true)).toBe('development');
    expect(applicationUpdatesUnsupportedReason(false, 'microsoft-store', false)).toBe(
      'development',
    );
    expect(applicationUpdatesUnsupportedReason(true, 'direct', true)).toBe('package-manager');
    expect(applicationUpdatesUnsupportedReason(true, 'microsoft-store', true)).toBe(
      'package-manager',
    );
  });

  test('bundled-only distributions cannot invoke runtime setup downloads', () => {
    expect(runtimeSetupSupported('direct')).toBe(true);
    expect(runtimeSetupSupported('microsoft-store')).toBe(true);
    expect(runtimeSetupSupported('direct')).toBe(true);
  });
});
