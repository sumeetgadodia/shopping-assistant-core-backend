const { callLLM } = require('./llmService');
const { getProducts, getOrderFacts, enrichCustomerContext } = require('./dummyData');
const { validateResponse } = require('./validationService');
const config = require('../config/settings');

const ROUTER_PROMPT = require('../prompts/routerPrompt');
const SALES_PROMPT = require('../prompts/salesPrompt');
const SUPPORT_PROMPT = require('../prompts/supportPrompt');
const MIXED_PROMPT = require('../prompts/mixedPrompt');

const runPipeline = async (query, userId, channelData) => {
    // STAGE 1: PREPROCESSING
    const context = enrichCustomerContext(userId, channelData);
    
    // STAGE 2: LAYER 0 - INTENT ROUTING
    const routerInput = ROUTER_PROMPT
        .replace('{query}', query)
        .replace('{context}', JSON.stringify(context.live_behavior));
        
    const intentData = await callLLM(routerInput, config.MODELS.ROUTER);
    if (intentData.error) return { reply: intentData.reply_text };

    // STAGE 3: FIXED RESPONSES & ESCALATION
    if (intentData.primary_bucket === "greeting") {
        return { reply: "Hi! Welcome to Aza Fashions. How may I assist you today?" };
    }
    if (intentData.primary_bucket === "human_assistance" || intentData.needs_human_review === true) {
        return { reply: "I completely understand. Let me transfer you to a live agent who can help right away.", handoff: true };
    }

    // STAGE 4 & 5: FACT RETRIEVAL & MAIN LLM GENERATION
    let rawResponse = {};
    let finalSafeReply = "";
    let extractedFilters = null;
    let followUpAsked = false;

    if (intentData.primary_bucket === "sales") {
        const products = getProducts();
        const prompt = SALES_PROMPT
            .replace('{query}', query)
            .replace('{products}', JSON.stringify(products))
            .replace('{profile}', JSON.stringify(context.profile));
        
        rawResponse = await callLLM(prompt, config.MODELS.MAIN);
        
        // Map the new strict JSON format from salesPrompt
        finalSafeReply = rawResponse?.customer_reply || rawResponse?.reply_text;
        extractedFilters = rawResponse?.filter_decision?.filters_to_apply || null;
        followUpAsked = rawResponse?.followup_question?.ask || false;
        
    } else if (intentData.primary_bucket === "support") {
        const facts = getOrderFacts("W3QKOSO2");
        const prompt = SUPPORT_PROMPT
            .replace('{query}', query)
            .replace('{order_facts}', JSON.stringify(facts));
        
        rawResponse = await callLLM(prompt, config.MODELS.MAIN);
        finalSafeReply = rawResponse?.reply_text;
        
    } else if (intentData.sub_bucket && intentData.sub_bucket.includes("mixed")) {
        const facts = getOrderFacts();
        const products = getProducts();
        const prompt = MIXED_PROMPT
            .replace('{query}', query)
            .replace('{order_facts}', JSON.stringify(facts))
            .replace('{products}', JSON.stringify(products));
        
        rawResponse = await callLLM(prompt, config.MODELS.FALLBACK); 
        finalSafeReply = rawResponse?.reply_text;
        
    } else {
        finalSafeReply = "I can assist you with discovering new styles or checking your order status. What would you prefer?";
    }

    // STAGE 6: VALIDATION LAYER
    const { isValid, safeReply } = validateResponse({ reply_text: finalSafeReply }, intentData.primary_bucket);
    
    // RETURN FINAL STRUCTURE
    return {
        reply: safeReply,
        metadata: {
            routing: intentData,
            extracted_filters: extractedFilters,
            follow_up_asked: followUpAsked,
            escalate_needed: rawResponse?.escalate_needed || false,
            validated: isValid
        }
    };
};

module.exports = { runPipeline };