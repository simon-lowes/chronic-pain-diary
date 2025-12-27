import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const _RATE_LIMIT_PER_MINUTE = 10; // Max images to generate per minute
const RATE_LIMIT_DELAY_MS = 6000; // 6 seconds between image generations

interface BackfillProgress {
  totalTrackers: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  errors: string[];
}

// Simple in-memory rate limiter (resets on function restart)
let lastGenerationTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastGeneration = now - lastGenerationTime;
  
  if (timeSinceLastGeneration < RATE_LIMIT_DELAY_MS) {
    const waitTime = RATE_LIMIT_DELAY_MS - timeSinceLastGeneration;
    console.log(`Rate limiting: waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastGenerationTime = Date.now();
}

async function generateImageForTracker(
  trackerId: string, 
  trackerName: string,
  supabase: SupabaseClient,
  geminiApiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Generating image for tracker: ${trackerName} (ID: ${trackerId})`);
    
    // Apply rate limiting
    await rateLimit();
    
    // Create image prompt
    const imagePrompt = `Create a minimal, clean, flat design icon for a health tracking app. The icon represents "${trackerName}". 
    
Style requirements:
- Square 1:1 aspect ratio
- Minimal flat design
- Clean simple shapes
- No text or labels in the image
- Suitable for mobile app card display
- Modern healthcare/wellness aesthetic
- Single solid background color
- Icon should be centered and fill most of the square
- Use healthcare-appropriate colors (blues, greens, or neutral tones)
    
The icon should visually represent the concept of "${trackerName}" in a simple, recognizable way that users will understand at a glance.`;

    // Call Gemini Image API (Nano Banana)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: imagePrompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini Image API error:', errorText);
      return { success: false, error: `Gemini API error: ${response.status}` };
    }

    const data = await response.json();
    const imageData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    
    if (!imageData || !imageData.data) {
      return { success: false, error: 'No image data returned' };
    }

    // Convert base64 to Uint8Array
    const imageBytes = Uint8Array.from(atob(imageData.data), c => c.charCodeAt(0));
    
    // Generate filename
    const timestamp = new Date().getTime();
    const filename = `tracker-${trackerId}-${timestamp}.${imageData.mimeType.split('/')[1]}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tracker-images')
      .upload(filename, imageBytes, {
        contentType: imageData.mimeType,
        cacheControl: '31536000',
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Generate signed URL
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('tracker-images')
      .createSignedUrl(uploadData.path, 31536000);

    if (urlError) {
      console.error('Signed URL error:', urlError);
      return { success: false, error: `URL generation failed: ${urlError.message}` };
    }

    // Update tracker with image info
    const { error: updateError } = await supabase
      .from('trackers')
      .update({
        image_url: signedUrlData.signedUrl,
        image_generated_at: new Date().toISOString(),
        image_model_name: 'gemini-2.5-flash-image',
        updated_at: new Date().toISOString(),
      })
      .eq('id', trackerId);

    if (updateError) {
      console.error('Tracker update error:', updateError);
      return { success: false, error: `Update failed: ${updateError.message}` };
    }

    console.log(`Successfully generated and stored image for tracker ${trackerId}`);
    return { success: true };

  } catch (error) {
    console.error('Image generation error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('=== Backfill Tracker Images Start ===');
  
  try {
    const body = await req.json();
    const { dryRun = false, batchSize = 5 } = body;
    
    console.log('Backfill configuration:', { dryRun, batchSize });
    
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Find trackers that need images (idempotent - only process trackers without images)
    console.log('Querying trackers without images...');
    const { data: trackers, error: queryError } = await supabase
      .from('trackers')
      .select('id, name, image_url')
      .is('image_url', null)
      .limit(batchSize);
    
    if (queryError) {
      throw new Error(`Failed to query trackers: ${queryError.message}`);
    }
    
    if (!trackers || trackers.length === 0) {
      console.log('No trackers need images - backfill complete');
      return new Response(JSON.stringify({ 
        message: 'No trackers need images',
        progress: {
          totalTrackers: 0,
          processedCount: 0,
          successCount: 0,
          errorCount: 0,
          errors: []
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${trackers.length} trackers that need images`);
    
    const progress: BackfillProgress = {
      totalTrackers: trackers.length,
      processedCount: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    };

    // Process each tracker
    for (const tracker of trackers) {
      console.log(`Processing tracker: ${tracker.name} (${tracker.id})`);
      
      if (dryRun) {
        console.log(`[DRY RUN] Would generate image for: ${tracker.name}`);
        progress.successCount++;
      } else {
        const result = await generateImageForTracker(
          tracker.id,
          tracker.name,
          supabase,
          GEMINI_API_KEY
        );
        
        if (result.success) {
          progress.successCount++;
        } else {
          progress.errorCount++;
          progress.errors.push(`${tracker.name}: ${result.error}`);
        }
      }
      
      progress.processedCount++;
      
      // Log progress
      const percentComplete = Math.round((progress.processedCount / progress.totalTrackers) * 100);
      console.log(`Progress: ${progress.processedCount}/${progress.totalTrackers} (${percentComplete}%)`);
    }
    
    console.log('Backfill completed:', progress);
    
    return new Response(JSON.stringify({ 
      message: dryRun ? 'Dry run completed' : 'Backfill completed',
      progress 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        progress: null
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});