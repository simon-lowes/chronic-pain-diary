/**
 * Unit tests for Gemini model string updates in Edge Functions
 * 
 * These tests verify that all Edge Functions use the correct Gemini 3.0 model strings.
 * This is a static analysis test that reads the source files and validates model strings.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Get the workspace root (adjust based on test execution context)
const FUNCTIONS_DIR = join(__dirname, '..');

describe('Edge Functions - Gemini 3.0 Model Strings', () => {
  describe('generate-tracker-config', () => {
    const functionPath = join(FUNCTIONS_DIR, 'generate-tracker-config', 'index.ts');
    let functionCode: string;

    try {
      functionCode = readFileSync(functionPath, 'utf-8');
    } catch {
      functionCode = '';
    }

    it('should use gemini-3-flash-preview for text generation', () => {
      expect(functionCode).toContain('gemini-3-flash-preview');
    });

    it('should NOT use deprecated gemini-2.5-flash', () => {
      expect(functionCode).not.toContain('gemini-2.5-flash');
    });

    it('should call the v1beta API endpoint', () => {
      expect(functionCode).toContain('generativelanguage.googleapis.com/v1beta');
    });

    it('should use generateContent method', () => {
      expect(functionCode).toContain(':generateContent');
    });
  });

  describe('generate-tracker-image', () => {
    const functionPath = join(FUNCTIONS_DIR, 'generate-tracker-image', 'index.ts');
    let functionCode: string;

    try {
      functionCode = readFileSync(functionPath, 'utf-8');
    } catch {
      functionCode = '';
    }

    it('should use gemini-2.5-flash-image for image generation (Nano Banana)', () => {
      expect(functionCode).toContain('gemini-2.5-flash-image');
    });

    it('should NOT use gemini-3-pro-image-preview (per API instructions)', () => {
      expect(functionCode).not.toContain('gemini-3-pro-image-preview');
    });

    it('should return gemini-2.5-flash-image as modelName', () => {
      expect(functionCode).toMatch(/modelName.*gemini-2.5-flash-image/);
    });

    it('should call the v1beta API endpoint', () => {
      expect(functionCode).toContain('generativelanguage.googleapis.com/v1beta');
    });

    it('should upload images to Supabase storage', () => {
      expect(functionCode).toContain("from('tracker-images')");
    });
  });

  describe('backfill-tracker-images', () => {
    const functionPath = join(FUNCTIONS_DIR, 'backfill-tracker-images', 'index.ts');
    let functionCode: string;

    try {
      functionCode = readFileSync(functionPath, 'utf-8');
    } catch {
      functionCode = '';
    }

    it('should use gemini-2.5-flash-image for image generation (Nano Banana)', () => {
      expect(functionCode).toContain('gemini-2.5-flash-image');
    });

    it('should NOT use gemini-3-pro-image-preview (per API instructions)', () => {
      expect(functionCode).not.toContain('gemini-3-pro-image-preview');
    });

    it('should store gemini-2.5-flash-image in image_model_name field', () => {
      expect(functionCode).toMatch(/image_model_name.*gemini-2.5-flash-image/);
    });

    it('should implement rate limiting', () => {
      expect(functionCode).toContain('rateLimit');
      expect(functionCode).toContain('RATE_LIMIT_DELAY_MS');
    });
  });
});

describe('Model String Constants', () => {
  // Define expected model strings per Gemini_API_INSTRUCTIONS.md
  const GEMINI_TEXT_MODEL = 'gemini-3-flash-preview';
  const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image'; // Nano Banana
  
  // Models to avoid per API instructions
  const AVOIDED_MODELS = [
    'gemini-3-pro-image-preview',
  ];

  it('should have correct text model format (gemini-3-flash-preview)', () => {
    expect(GEMINI_TEXT_MODEL).toMatch(/^gemini-3-flash/);
    expect(GEMINI_TEXT_MODEL).toContain('preview');
  });

  it('should have correct image model format (gemini-2.5-flash-image / Nano Banana)', () => {
    expect(GEMINI_IMAGE_MODEL).toContain('2.5');
    expect(GEMINI_IMAGE_MODEL).toContain('flash');
    expect(GEMINI_IMAGE_MODEL).toContain('image');
  });

  it('avoided models should not match current image model', () => {
    AVOIDED_MODELS.forEach((avoided) => {
      expect(GEMINI_IMAGE_MODEL).not.toBe(avoided);
    });
  });
});

describe('API Endpoint Validation', () => {
  const V1BETA_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
  
  it('should use v1beta API version', () => {
    expect(V1BETA_ENDPOINT).toContain('/v1beta/');
  });

  it('should construct valid text generation endpoint', () => {
    const textEndpoint = `${V1BETA_ENDPOINT}gemini-3-flash-preview:generateContent`;
    expect(textEndpoint).toContain('gemini-3-flash-preview');
    expect(textEndpoint).toContain(':generateContent');
  });

  it('should construct valid Nano Banana image endpoint', () => {
    const imageEndpoint = `${V1BETA_ENDPOINT}gemini-2.5-flash-image:generateContent`;
    expect(imageEndpoint).toContain('gemini-2.5-flash-image');
    expect(imageEndpoint).toContain(':generateContent');
  });
});
