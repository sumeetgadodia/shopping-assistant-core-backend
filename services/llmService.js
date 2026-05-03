const config = require('../config/settings');

const callLLM = async (prompt, model, expectJson = true) => {
    try {
        const isLocal = model.startsWith("localhost:");
        let apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        let actualModel = model;
        
        let headers = { "Content-Type": "application/json" };
        let payload = {};

        if (isLocal) {
            // Localhost routing (Ollama)
            actualModel = model.replace("localhost:", "");
            apiUrl = "http://localhost:11434/api/chat";
            payload = {
                model: actualModel,
                messages: [{ role: "user", content: prompt }],
                stream: false
            };
            if (expectJson) {
                payload.format = "json"; // Tells Ollama to enforce JSON output
            }
        } else {
            // OpenRouter routing
            headers["Authorization"] = `Bearer ${config.OPENROUTER_API_KEY}`;
            headers["HTTP-Referer"] = "http://localhost:5001";
            headers["X-Title"] = "Aza-Bot";
            
            payload = {
                model: actualModel,
                messages: [{ role: "user", content: prompt }]
            };
            if (expectJson && actualModel.includes("openai")) {
                payload.response_format = { type: "json_object" };
            }
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || data.error);
        }
        
        // Handle the difference between Ollama payload and OpenRouter payload
        let content = isLocal ? data.message.content.trim() : data.choices[0].message.content.trim();
        
        if (expectJson) {
            // Safely extract JSON even if the model wrapped it in markdown
            const start = content.indexOf('{');
            const end = content.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                const cleanContent = content.substring(start, end + 1);
                return JSON.parse(cleanContent);
            } else {
                throw new Error("Model did not return a valid JSON block.");
            }
        }
        return content;
        
    } catch (e) {
        console.error(`[LLM Error - ${model}]:`, e.message);
        
        // Return safe fallback objects so the pipeline doesn't crash
        if (prompt.includes("intent classification layer")) {
            return {
                primary_bucket: "sales",
                sub_bucket: "recommendation_styling",
                journey_stage: "pre_purchase",
                confidence: 0.6,
                needs_human_review: false,
                reason: "Fallback router classification"
            };
        }
        return { 
            reply_text: "I'm experiencing a temporary issue. Let me connect you to an agent.",
            escalate_needed: true
        };
    }
};

module.exports = { callLLM };