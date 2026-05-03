const { callLLM } = require('./llmService');
const { enrichCustomerContext } = require('./dummyData');
const { validateResponse } = require('./validationService');
const config = require('../config/settings');

const ROUTER_PROMPT = require('../prompts/routerPrompt');
const SALES_PROMPT = require('../prompts/salesPrompt');
const SUPPORT_PROMPT = require('../prompts/supportPrompt');
const MIXED_PROMPT = require('../prompts/mixedPrompt');

const LOG_CHATS = process.env.LOG_CHATS === "true";

const runPipeline = async (query, userId, channelData = {}) => {
    // STAGE 1: PREPROCESSING
    const context = enrichCustomerContext(userId, channelData);

    const chatId = channelData?.chat_id || "";

    // STAGE 2: LAYER 0 - INTENT ROUTING
    const routerInput = ROUTER_PROMPT
        .replace('{query}', query || '')
        .replace('{context}', JSON.stringify(context?.live_behavior || {}));

    const intentData = await callLLM(routerInput, config.MODELS.ROUTER);

    if (intentData?.error) {
        return {
            chat_id: chatId,
            reply: intentData.reply_text || "Sorry, I couldn’t understand that. Could you please try again?"
        };
    }

    // STAGE 3: FIXED RESPONSES & ESCALATION
    if (intentData?.primary_bucket === "greeting") {
        return {
            chat_id: chatId,
            reply: "Hi! Welcome to Aza Fashions. How may I assist you today?"
        };
    }

    if (intentData?.primary_bucket === "human_assistance" || intentData?.needs_human_review === true) {
        return {
            chat_id: chatId,
            reply: "I understand. You can reach our team here:\nWhatsApp chat: +91 8291990059\nIndia call: 02242792123, Mon-Fri, 10 AM-10 PM IST\nInternational call: +12132135273, Mon-Fri, 10 AM-10 PM IST\nEmail: contactus@azafashions.com",
            handoff: false
        };
    }

    // STAGE 4 & 5: FACT RETRIEVAL & MAIN LLM GENERATION
    let rawResponse = {};
    let finalSafeReply = "";
    let extractedFilters = [];
    let followUpAsked = false;

    if (intentData?.primary_bucket === "sales") {
        const salesInput = {
            chat_id: chatId,
            customer_profile_data: context?.profile || {},
            customer_query: query || "",
            chat_thread: channelData?.chat_thread || [],
            channel_data: channelData || {},
            country: channelData?.country || context?.profile?.country || "India"
        };

        const prompt = `${SALES_PROMPT}

# Runtime input
${JSON.stringify(salesInput, null, 2)}
`;

        rawResponse = await callLLM(prompt, config.MODELS.MAIN);

        if (LOG_CHATS) console.log("SALES_INPUT:", salesInput);
        if (LOG_CHATS) console.log("SALES_PROMPT_INCLUDED_RUNTIME_INPUT:", prompt.includes("# Runtime input"));
        if (LOG_CHATS) console.log("SALES_PROMPT_QUERY_INCLUDED:", prompt.includes(query || ""));
        if (LOG_CHATS) console.log("SALES_RAW_RESPONSE:", JSON.stringify(rawResponse, null, 2));

        finalSafeReply = rawResponse?.customer_reply || rawResponse?.reply_text || rawResponse?.reply || "";
        extractedFilters = rawResponse?.filter_decision?.filters_to_apply || [];
        followUpAsked = rawResponse?.followup_question?.ask || false;

        // Return sales strict JSON as-is
        if (rawResponse?.filter_decision) {
            return {
                chat_id: chatId,
                ...rawResponse
            };
        }

        if (LOG_CHATS) console.warn("SALES_SCHEMA_MISSING_FILTER_DECISION:", JSON.stringify(rawResponse, null, 2));
    }

    else if (intentData?.primary_bucket === "support") {
        const supportInput = {
            chat_id: chatId,
            customer_profile_data: context?.profile || {},
            customer_query: query || "",
            chat_thread: channelData?.chat_thread || [],
            channel_data: channelData || {},
            active_orders: channelData?.active_orders || []
        };

        const prompt = `${SUPPORT_PROMPT}

# Runtime input
${JSON.stringify(supportInput, null, 2)}
`;

        rawResponse = await callLLM(prompt, config.MODELS.MAIN);

        if (LOG_CHATS) console.log("SUPPORT_INPUT:", supportInput);
        if (LOG_CHATS) console.log("SUPPORT_PROMPT_INCLUDED_RUNTIME_INPUT:", prompt.includes("# Runtime input"));
        if (LOG_CHATS)  console.log("SUPPORT_PROMPT_QUERY_INCLUDED:", prompt.includes(query || ""));
        if (LOG_CHATS)  console.log("SUPPORT_RAW_RESPONSE:", JSON.stringify(rawResponse, null, 2));

        finalSafeReply = rawResponse?.customer_reply || rawResponse?.reply_text || rawResponse?.reply || "";
    }

    else if (intentData?.primary_bucket === "mixed" ) {
        const mixedInput = {
            chat_id: chatId,
            customer_profile_data: context?.profile || {},
            customer_query: query || "",
            chat_thread: channelData?.chat_thread || [],
            channel_data: channelData || {},
            active_orders: channelData?.active_orders || [],
            country: channelData?.country || context?.profile?.country || "India"
        };

        const prompt = `${MIXED_PROMPT}

# Runtime input
${JSON.stringify(mixedInput, null, 2)}
`;

        rawResponse = await callLLM(prompt, config.MODELS.FALLBACK);

        if (LOG_CHATS)  console.log("MIXED_INPUT:", mixedInput);
        if (LOG_CHATS) console.log("MIXED_PROMPT_INCLUDED_RUNTIME_INPUT:", prompt.includes("# Runtime input"));
        if (LOG_CHATS) console.log("MIXED_PROMPT_QUERY_INCLUDED:", prompt.includes(query || ""));
        if (LOG_CHATS) console.log("MIXED_RAW_RESPONSE:", JSON.stringify(rawResponse, null, 2));

        finalSafeReply = rawResponse?.customer_reply || rawResponse?.reply_text || rawResponse?.reply || "";
        extractedFilters =
            rawResponse?.filter_decision?.filters_to_apply ||
            rawResponse?.extracted_filters ||
            [];
        followUpAsked =
            rawResponse?.followup_question?.ask ||
            rawResponse?.follow_up_asked ||
            false;
    }

    else {
        finalSafeReply = "I can assist you with discovering new styles or checking your order status. What would you prefer?";
    }

    // Fallback for support/mixed if model reply is empty
    if (
        (
            intentData?.primary_bucket === "support" ||
            intentData?.primary_bucket === "mixed" ||
            intentData?.sub_bucket?.includes("mixed")
        ) &&
        !finalSafeReply
    ) {
        finalSafeReply = "I’m sorry, I couldn’t fetch enough details for this request. Please share your Order ID or registered email/phone number so we can help further.";
    }

    // STAGE 6: VALIDATION LAYER
    const { isValid, safeReply } = validateResponse(
        { reply_text: finalSafeReply },
        intentData?.primary_bucket
    );

    return {
        chat_id: chatId,
        reply: safeReply,
        metadata: {
            routing: intentData,
            extracted_filters: extractedFilters,
            follow_up_asked: followUpAsked,
            order_card: {
                image_url: rawResponse?.decision?.card?.image_url || "",
                product_name: rawResponse?.decision?.card?.product_name || "",
                designer_name: rawResponse?.decision?.card?.designer_name || "",
                order_no:
                    rawResponse?.decision?.card?.order_no ||
                    rawResponse?.decision?.order?.order_no ||
                    "",
                sub_id:
                    rawResponse?.decision?.card?.sub_id ||
                    rawResponse?.decision?.order?.sub_id ||
                    ""
            },
            support_action: rawResponse?.support_action || rawResponse?.internal_action || null,
            freshservice_ticket_required:
                rawResponse?.decision?.fs?.needed === true ||
                rawResponse?.freshservice_ticket_required === true ||
                rawResponse?.internal_action?.freshservice_ticket_required === true,
            freshservice_ticket_id: rawResponse?.decision?.fs?.ticket_id || "",
            freshservice_reason: rawResponse?.decision?.fs?.reason || "",
            freshservice_msg: rawResponse?.decision?.fs?.msg || "",
            escalate_needed: rawResponse?.escalate_needed === true,
            validated: isValid
        }
    };
};

module.exports = { runPipeline };