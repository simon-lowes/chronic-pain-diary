# Tracker App Architecture & Model Guidelines

## AI Model Selection (December 2025 Standard)

- **Text Generation (Brain):** Always use `gemini-3-flash-preview`. This is the primary model for logic, tracker definitions, and context.
- **Image Generation (Visuals):** Always use `gemini-2.5-flash-image` (internally nicknamed Nano Banana).
- **Avoid:** Do not use `gemini-3-pro-image-preview` or any older Imagen models unless explicitly requested.

## API & Endpoints

- **Base URL:** All Google AI calls must use `https://generativelanguage.googleapis.com/v1beta/`.
- **Authentication:** Ensure the `GEMINI_API_KEY` is passed via header or query parameter as per current v1beta standards.

## Supabase Integration

- **Edge Function:** Our core logic is in the Supabase Edge Function. When refactoring frontend code, ensure the payload sent to the function includes `trackerId` and `trackerName`.
- **Database:** Tracker images are stored in the `tracker-images` bucket. The `trackers` table uses `image_url` to store the signed public URL.

## Coding Style

- Prefer TypeScript for all frontend and edge function code.
- Maintain the current rate-limiting logic (6s delay) for image generation to stay within budget.
