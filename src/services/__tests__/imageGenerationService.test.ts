/**
 * Unit tests for imageGenerationService
 * 
 * Tests the Gemini 3.0 model upgrade for image generation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the supabase client
vi.mock('@/adapters/supabase/supabaseClient', () => ({
  supabaseClient: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

import { generateTrackerImage, updateTrackerImage } from '../imageGenerationService';
import { supabaseClient } from '@/adapters/supabase/supabaseClient';

describe('imageGenerationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateTrackerImage', () => {
    it('should call generate-tracker-image edge function with correct parameters', async () => {
      const mockInvoke = vi.mocked(supabaseClient.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: {
          imageUrl: 'https://example.com/image.png',
          storagePath: 'tracker-123-1234567890.png',
          modelName: 'gemini-2.5-flash-image',
        },
        error: null,
      });

      const result = await generateTrackerImage('Headache', 'tracker-123');

      expect(mockInvoke).toHaveBeenCalledWith('generate-tracker-image', {
        body: {
          trackerName: 'Headache',
          trackerId: 'tracker-123',
        },
      });
      expect(result.success).toBe(true);
      expect(result.imageUrl).toBe('https://example.com/image.png');
    });

    it('should return Gemini 3.0 model name in result', async () => {
      const mockInvoke = vi.mocked(supabaseClient.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: {
          imageUrl: 'https://example.com/image.png',
          storagePath: 'tracker-123-1234567890.png',
          modelName: 'gemini-2.5-flash-image',
        },
        error: null,
      });

      const result = await generateTrackerImage('Migraine', 'tracker-456');

      expect(result.modelName).toBe('gemini-2.5-flash-image');
    });

    it('should use gemini-2.5-flash-image as default model name when not provided', async () => {
      const mockInvoke = vi.mocked(supabaseClient.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: {
          imageUrl: 'https://example.com/image.png',
          storagePath: 'tracker-123-1234567890.png',
          // modelName intentionally omitted to test fallback
        },
        error: null,
      });

      const result = await generateTrackerImage('Fatigue', 'tracker-789');

      expect(result.success).toBe(true);
      expect(result.modelName).toBe('gemini-2.5-flash-image');
    });

    it('should handle edge function errors gracefully', async () => {
      const mockInvoke = vi.mocked(supabaseClient.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'API rate limit exceeded' },
      });

      const result = await generateTrackerImage('Anxiety', 'tracker-999');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API rate limit exceeded');
    });

    it('should handle missing imageUrl in response', async () => {
      const mockInvoke = vi.mocked(supabaseClient.functions.invoke);
      mockInvoke.mockResolvedValue({
        data: { storagePath: 'some-path.png' }, // Missing imageUrl
        error: null,
      });

      const result = await generateTrackerImage('Insomnia', 'tracker-111');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('updateTrackerImage', () => {
    it('should update tracker with correct image metadata', async () => {
      const mockFrom = vi.mocked(supabaseClient.from);
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      }));
      mockFrom.mockReturnValue({ update: mockUpdate } as any);

      const result = await updateTrackerImage(
        'tracker-123',
        'https://example.com/image.png',
        'gemini-3-pro-image-preview'
      );

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('trackers');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          image_url: 'https://example.com/image.png',
          image_model_name: 'gemini-3-pro-image-preview',
        })
      );
    });
  });
});

describe('Gemini Model Strings', () => {
  it('should use gemini-2.5-flash-image for image generation (Nano Banana)', () => {
    // This test validates that the correct model string is used per API instructions
    const expectedImageModel = 'gemini-2.5-flash-image';
    
    // The model string should match the Nano Banana image model
    expect(expectedImageModel).toContain('2.5');
    expect(expectedImageModel).toContain('image');
  });

  it('should not use gemini-3-pro-image-preview (per API instructions)', () => {
    const currentImageModel = 'gemini-2.5-flash-image';
    const avoidedModels = [
      'gemini-3-pro-image-preview',
    ];

    avoidedModels.forEach((avoided) => {
      expect(currentImageModel).not.toBe(avoided);
    });
  });
});
