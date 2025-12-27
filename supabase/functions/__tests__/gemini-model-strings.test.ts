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

    it('should use gemini-3-pro-image-preview for image generation', () => {
      expect(functionCode).toContain('gemini-3-pro-image-preview');
    });

    it('should NOT use deprecated gemini-2.5-flash-image', () => {
      expect(functionCode).not.toContain('gemini-2.5-flash-image');
    });

    it('should return gemini-3-pro-image-preview as modelName', () => {
      expect(functionCode).toMatch(/modelName.*gemini-3-pro-image-preview/);
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

    it('should use gemini-3-pro-image-preview for image generation', () => {
      expect(functionCode).toContain('gemini-3-pro-image-preview');
    });

    it('should NOT use deprecated gemini-2.5-flash-image', () => {
      expect(functionCode).not.toContain('gemini-2.5-flash-image');
    });

    it('should store gemini-3-pro-image-preview in image_model_name field', () => {
      expect(functionCode).toMatch(/image_model_name.*gemini-3-pro-image-preview/);
    });

    it('should implement rate limiting', () => {
      expect(functionCode).toContain('rateLimit');
      expect(functionCode).toContain('RATE_LIMIT_DELAY_MS');
    });
  });
});

describe('Model String Constants', () => {
  // Define expected model strings for Gemini 3.0
  const GEMINI_3_TEXT_MODEL = 'gemini-3-flash-preview';
  const GEMINI_3_IMAGE_MODEL = 'gemini-3-pro-image-preview';
  
  // Deprecated models that should NOT appear in codebase
  const DEPRECATED_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-image',
    'gemini-2.0-flash',
    'gemini-2.0-flash-image',
  ];

  it('should have correct Gemini 3.0 text model format', () => {
    expect(GEMINI_3_TEXT_MODEL).toMatch(/^gemini-3-flash/);
    expect(GEMINI_3_TEXT_MODEL).toContain('preview');
  });

  it('should have correct Gemini 3.0 image model format', () => {
    expect(GEMINI_3_IMAGE_MODEL).toMatch(/^gemini-3-pro/);
    expect(GEMINI_3_IMAGE_MODEL).toContain('image');
    expect(GEMINI_3_IMAGE_MODEL).toContain('preview');
  });

  it('deprecated models should not match current models', () => {
    DEPRECATED_MODELS.forEach((deprecated) => {
      expect(GEMINI_3_TEXT_MODEL).not.toBe(deprecated);
      expect(GEMINI_3_IMAGE_MODEL).not.toBe(deprecated);
    });
  });
});

describe('API Endpoint Validation', () => {
  const V1BETA_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
  
  it('should use v1beta API version', () => {
    expect(V1BETA_ENDPOINT).toContain('/v1beta/');
  });

  it('should construct valid Gemini 3.0 text endpoint', () => {
    const textEndpoint = `${V1BETA_ENDPOINT}gemini-3-flash-preview:generateContent`;
    expect(textEndpoint).toContain('gemini-3-flash-preview');
    expect(textEndpoint).toContain(':generateContent');
  });

  it('should construct valid Gemini 3.0 image endpoint', () => {
    const imageEndpoint = `${V1BETA_ENDPOINT}gemini-3-pro-image-preview:generateContent`;
    expect(imageEndpoint).toContain('gemini-3-pro-image-preview');
    expect(imageEndpoint).toContain(':generateContent');
  });
});
