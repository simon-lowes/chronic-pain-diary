import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('=== Generate Tracker Config Start ===');
  
  try {
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    
    const { trackerName, definition, userDescription } = body;
    
    const contextSource = definition || userDescription;
    if (!trackerName || !contextSource) {
      console.log('Missing required fields');
      throw new Error('trackerName and either definition or userDescription required');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    console.log('API key present:', !!GEMINI_API_KEY);
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    
    const prompt = `You are helping configure a health/wellness tracking app. The user wants to create a custom tracker called "${trackerName}".

${definition ? `Dictionary definition: "${definition}"` : `User's description: "${userDescription}"`}

Generate a JSON configuration for this tracker. The configuration should be contextually appropriate for tracking "${trackerName}".

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "intensityLabel": "string - what the 1-10 scale measures (e.g., 'Blood Pressure Level', 'Severity')",
  "intensityMinLabel": "string - label for value 1 (e.g., '1 - Low/Normal')",
  "intensityMaxLabel": "string - label for value 10 (e.g., '10 - Very High')",
  "intensityScale": "string - one of: 'low_bad', 'high_bad', or 'neutral'",
  "locationLabel": "string - what categories/types to track (e.g., 'Reading Type', 'Symptom')",
  "locationPlaceholder": "string - placeholder text",
  "triggersLabel": "string - what factors to note (e.g., 'Contributing Factors')",
  "notesLabel": "string - usually 'Notes'",
  "notesPlaceholder": "string - contextual placeholder",
  "addButtonLabel": "string - e.g., 'Log Reading'",
  "formTitle": "string - e.g., 'Log Blood Pressure'",
  "emptyStateTitle": "string - welcome message",
  "emptyStateDescription": "string - 1-2 sentences explaining the value of tracking this",
  "emptyStateBullets": ["string", "string", "string"],
  "entryTitle": "string - e.g., 'Blood Pressure Entry'",
  "deleteConfirmMessage": "string - deletion confirmation",
  "locations": [{"value": "string", "label": "string"}],
  "triggers": ["string"],
  "suggestedHashtags": ["string"]
}

Guidelines:
- emptyStateBullets: exactly 3 benefits of tracking this
- locations: 6-10 relevant categories/types with value (lowercase-hyphenated) and label
- triggers: 8-12 common factors that might affect this
- suggestedHashtags: 5-8 useful hashtags without the # symbol

For intensityScale:
- "high_bad" if high values are concerning (pain, blood pressure, anxiety)
- "low_bad" if low values are concerning (mood, energy, oxygen levels)
- "neutral" if the scale is just measurement without inherent good/bad (exercise intensity)

Make it medically/scientifically informed but accessible to regular users.`;

    // Call Google Gemini API - using gemini-3-flash-preview (free tier)
    console.log('Calling Gemini API for tracker:', trackerName);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    console.log('Gemini response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error response:', errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    console.log('Gemini response candidates:', data.candidates?.length);
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content in Gemini response');
    }

    // Parse and validate JSON - strip any markdown if present
    let jsonText = content.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replaceAll(/```json?\n?/g, '').replaceAll(/```$/g, '').trim();
    }
    
    const config = JSON.parse(jsonText);
    
    // Validate required fields
    const requiredFields = [
      'intensityLabel', 'intensityScale', 'locationLabel', 
      'addButtonLabel', 'formTitle', 'emptyStateTitle', 'locations', 'triggers'
    ];
    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    return new Response(JSON.stringify({ config }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating tracker config:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
