// Read ElevenLabs API key from environment for local development (set in .env.local)
const ELEVENLABS_API_KEY = (import.meta as any).env?.VITE_ELEVENLABS_API_KEY || "YOUR_ELEVENLABS_API_KEY_HERE";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
// A popular default voice ID for ElevenLabs
const VOICE_ID = "GNZJNyUmjtha6JKquA3M"; 

export const elevenLabsTextToSpeech = async (text: string): Promise<Blob> => {
    if (ELEVENLABS_API_KEY === "YOUR_ELEVENLABS_API_KEY_HERE") {
        throw new Error("Please replace the placeholder ElevenLabs API key in services/elevenLabsService.ts");
    }

    try {
        const response = await fetch(`${ELEVENLABS_API_URL}/${VOICE_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5,
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || "Failed to fetch audio from ElevenLabs.");
        }

        return response.blob();
    } catch (error) {
        console.error("Error with ElevenLabs Text-to-Speech:", error);
        throw new Error("Failed to generate audio from text using ElevenLabs.");
    }
};