/**
 * Image Generation Service
 * 
 * Handles AI-powered image generation for tracker icons using Gemini.
 */

import { supabaseClient } from '@/adapters/supabase/supabaseClient';

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  storagePath?: string;
  modelName?: string;
  error?: string;
}

/**
 * Generate an icon image for a tracker
 * 
 * @param trackerName - The name of the tracker (e.g., "Hypertension") 
 * @param trackerId - The tracker ID for unique file naming
 * @returns The generation result with image URL or error
 */
export async function generateTrackerImage(
  trackerName: string,
  trackerId: string
): Promise<ImageGenerationResult> {
  try {
    console.log(`Generating image for tracker: ${trackerName} (ID: ${trackerId})`);
    
    // Call edge function to generate image
    const { data, error } = await supabaseClient.functions.invoke('generate-tracker-image', {
      body: {
        trackerName,
        trackerId,
      },
    });

    if (error) {
      console.error('Edge function error:', error);
      return { 
        success: false, 
        error: `Image generation failed: ${error.message}` 
      };
    }

    if (!data?.imageUrl) {
      console.error('No image URL returned:', data);
      return { 
        success: false, 
        error: 'No image URL returned from generation service' 
      };
    }

    console.log('Image generation successful:', data.imageUrl);

    return {
      success: true,
      imageUrl: data.imageUrl,
      storagePath: data.storagePath,
      modelName: data.modelName || 'gemini-2.5-flash-image',
    };

  } catch (error) {
    console.error('Image generation service error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Update tracker with generated image information
 * 
 * @param trackerId - The tracker ID to update
 * @param imageUrl - The generated image URL
 * @param modelName - The model used for generation
 * @returns Success status
 */
export async function updateTrackerImage(
  trackerId: string,
  imageUrl: string,
  modelName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseClient
      .from('trackers')
      .update({
        image_url: imageUrl,
        image_generated_at: new Date().toISOString(),
        image_model_name: modelName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trackerId);

    if (error) {
      console.error('Failed to update tracker with image:', error);
      return { 
        success: false, 
        error: `Failed to save image info: ${error.message}` 
      };
    }

    console.log(`Successfully updated tracker ${trackerId} with image`);
    return { success: true };

  } catch (error) {
    console.error('Update tracker image error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}