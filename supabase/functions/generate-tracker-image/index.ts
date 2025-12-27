import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('=== Generate Tracker Image Start ===');
  
  try {
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    
    const { trackerName, trackerId } = body;
    
    if (!trackerName || !trackerId) {
      console.log('Missing required fields');
      throw new Error('trackerName and trackerId are required');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    console.log('API key present:', !!GEMINI_API_KEY);
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Create Supabase client for storage operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Create image prompt - simple title-based approach (Option A)
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

    // Call Google Gemini API for image generation using gemini-2.5-flash-image (Nano Banana)
    console.log('Calling Gemini Image API for tracker:', trackerName);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
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
            temperature: 0.3, // Lower temperature for more consistent style
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    console.log('Gemini Image API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini Image API error response:', errorText);
      throw new Error(`Gemini Image API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    console.log('Gemini image response candidates:', data.candidates?.length);
    
    const imageData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    
    if (!imageData || !imageData.data) {
      throw new Error('No image data in Gemini response');
    }

    console.log('Image data received, mime type:', imageData.mimeType);

    // Convert base64 to Uint8Array
    const imageBytes = Uint8Array.from(atob(imageData.data), c => c.charCodeAt(0));
    
    // Generate filename with timestamp to ensure uniqueness
    const timestamp = new Date().getTime();
    const filename = `tracker-${trackerId}-${timestamp}.${imageData.mimeType.split('/')[1]}`;
    
    // Upload to Supabase Storage
    console.log('Uploading to Supabase Storage:', filename);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tracker-images')
      .upload(filename, imageBytes, {
        contentType: imageData.mimeType,
        cacheControl: '31536000', // Cache for 1 year
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    console.log('Image uploaded successfully:', uploadData.path);

    // Generate signed URL (valid for 1 year)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('tracker-images')
      .createSignedUrl(uploadData.path, 31536000);

    if (urlError) {
      console.error('Signed URL error:', urlError);
      throw new Error(`Failed to create signed URL: ${urlError.message}`);
    }

    console.log('Signed URL generated successfully');

    return new Response(JSON.stringify({ 
      imageUrl: signedUrlData.signedUrl,
      storagePath: uploadData.path,
      mimeType: imageData.mimeType,
      modelName: 'gemini-2.5-flash-image'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating tracker image:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});