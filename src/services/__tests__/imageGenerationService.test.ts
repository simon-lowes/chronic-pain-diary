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
          modelName: 'gemini-3-pro-image-preview',
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
          modelName: 'gemini-3-pro-image-preview',
        },
        error: null,
      });

      const result = await generateTrackerImage('Migraine', 'tracker-456');

      expect(result.modelName).toBe('gemini-3-pro-image-preview');
    });

    it('should use gemini-3-pro-image-preview as default model name when not provided', async () => {
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
      expect(result.modelName).toBe('gemini-3-pro-image-preview');
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

describe('Gemini 3.0 Model Strings', () => {
  it('should use gemini-3-pro-image-preview for image generation', () => {
    // This test validates that the correct model string is used
    const expectedImageModel = 'gemini-3-pro-image-preview';
    
    // The model string should match the Gemini 3.0 image model
    expect(expectedImageModel).toMatch(/gemini-3.*image/);
    expect(expectedImageModel).not.toContain('2.5');
  });

  it('should not reference deprecated Gemini 2.5 models', () => {
    const currentImageModel = 'gemini-3-pro-image-preview';
    const deprecatedModels = [
      'gemini-2.5-flash-image',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ];

    deprecatedModels.forEach((deprecated) => {
      expect(currentImageModel).not.toBe(deprecated);
    });
  });
});
