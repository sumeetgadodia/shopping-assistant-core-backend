require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 5001,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
    MODELS: {
        ROUTER: process.env.ROUTER_MODEL || "google/gemini-flash-1.5",
        MAIN: process.env.MAIN_CHAT_MODEL || "openai/gpt-4o-mini",
        FALLBACK: process.env.FALLBACK_MODEL || "openai/gpt-4o"
    }
};
