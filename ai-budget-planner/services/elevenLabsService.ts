// This service is correctly implemented for ElevenLabs.
// Fix: Use process.env for consistency with other services and to resolve TypeScript error.
const ELEVENLABS_API_KEY = (import.meta as any).env?.VITE_ELEVENLABS_API_KEY || "YOUR_ELEVENLABS_API_KEY_HERE";
/**
 * Generates speech from text using the ElevenLabs streaming API.
 * @param text The text to convert to speech.
 * @param voiceId The ID of the voice to use for the speech generation.
 * @returns A promise that resolves to the streaming audio response.
 * @throws An error if the API key is missing or if the request fails.
 */
export const generateSpeechStream = async (text: string, voiceId: string): Promise<Response> => {
    if (!ELEVENLABS_API_KEY) {
        throw new Error("ElevenLabs API key is not configured. Please set VITE_ELEVENLABS_API_KEY in your environment.");
    }

    const API_URL = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
                'accept': 'audio/mpeg'
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5
                }
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("ElevenLabs API Error:", errorBody);
            throw new Error(`ElevenLabs API request failed with status ${response.status}: ${errorBody}`);
        }

        return response;

    } catch (error) {
        console.error("Error generating speech with ElevenLabs:", error);
        throw new Error(error instanceof Error ? error.message : "An unknown error occurred while generating speech.");
    }
};