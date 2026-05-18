const { callLLM } = require('./llmService');
const { enrichCustomerContext } = require('./dummyData');
const { validateResponse } = require('./validationService');
const config = require('../config/settings');

const ROUTER_PROMPT = require('../prompts/routerPrompt');
const SALES_PROMPT = require('../prompts/salesPrompt');
const SUPPORT_PROMPT = require('../prompts/supportPrompt');
const MIXED_PROMPT = require('../prompts/mixedPrompt');
const GREETING_PROMPT = require('../prompts/greetingPrompt');

const LOG_CHATS = process.env.LOG_CHATS === "true";
const RETURN_RAW_RESPONSE = process.env.RETURN_RAW_RESPONSE === "true";

const SUPPORT_CONTACT = {
    whatsapp: "+91 8291990059",
    india_call: "02242792123, Mon-Fri, 10 AM-10 PM IST",
    international_call: "+12132135273, Mon-Fri, 10 AM-10 PM IST",
    email: "contactus@azafashions.com"
};

const SUPPORT_CONTACT_REPLY =
    "I understand. You can reach our team here:\n" +
    "WhatsApp chat: +91 8291990059\n" +
    "India call: 02242792123, Mon-Fri, 10 AM-10 PM IST\n" +
    "International call: +12132135273, Mon-Fri, 10 AM-10 PM IST\n" +
    "Email: contactus@azafashions.com";

const DEFAULT_FOLLOWUP = {
    ask: false,
    question: "",
    options: []
};

const DEFAULT_ORDER_CARD = {
    image_url: "",
    product_name: "",
    designer_name: "",
    order_no: "",
    sub_id: "",
    tracking_link: ""
};

const DEFAULT_FRESHSERVICE = {
    ticket_id: "",
    status: "",
    threads: []
};

const getCurrentDateTimeISO = () => {
    return new Date().toLocaleString("sv-SE", {
        timeZone: "Asia/Kolkata",
        hour12: false
    }).replace(" ", "T") + "+05:30";
};

const getTimeMs = (value) => {
    const time = new Date(value || "").getTime();
    return Number.isFinite(time) ? time : null;
};

const isGenericUpdateAsk = (query = "") => {
    return /\b(any update|update|status|where is|where's|eta|still waiting)\b/i.test(query || "");
};

const hasNewUrgencyOrDetail = (query = "") => {
    return /\b(urgent|escalate|manager|wedding|event|function|today|tomorrow|need it|complaint|not acceptable)\b/i.test(query || "");
};

const getLatestThreadTime = (threads = []) => {
    return threads
        .map((thread) => getTimeMs(thread?.datetime))
        .filter(Boolean)
        .sort((a, b) => b - a)[0] || null;
};

const buildFreshserviceState = (query = "", freshservice = {}, chatThread = []) => {
    const currentTimeMs = Date.now();
    const latestThreadTime = Math.max(
        getLatestThreadTime(freshservice?.threads || []) || 0,
        getLatestThreadTime((chatThread || []).filter((t) => t?.from === "agent")) || 0
    ) || null;

    const latestThreadAgeHours = latestThreadTime
        ? Number(((currentTimeMs - latestThreadTime) / (1000 * 60 * 60)).toFixed(2))
        : null;

    const latestThreadWithin24h =
        latestThreadAgeHours !== null &&
        latestThreadAgeHours >= 0 &&
        latestThreadAgeHours <= 24;

    const genericUpdateAsk = isGenericUpdateAsk(query);
    const newUrgencyOrDetail = hasNewUrgencyOrDetail(query);

    return {
        current_datetime: getCurrentDateTimeISO(),
        has_ticket: !!freshservice?.ticket_id,
        ticket_id: freshservice?.ticket_id || "",
        latest_thread_age_hours: latestThreadAgeHours,
        latest_thread_within_24h: latestThreadWithin24h,
        generic_update_ask: genericUpdateAsk,
        new_urgency_or_detail: newUrgencyOrDetail,
        should_update_freshservice:
            !!freshservice?.ticket_id &&
            genericUpdateAsk &&
            !newUrgencyOrDetail &&
            latestThreadAgeHours !== null &&
            latestThreadAgeHours > 24
    };
};


const normalizeBasicText = (text = "") => {
    return String(text || "")
        .toLowerCase()
        .trim()
        .replace(/[’]/g, "'")
        .replace(/[.,!?]/g, "")
        .replace(/\s+/g, " ");
};

const BASIC_GREETING_TRIGGERS = new Set([
    "hi",
    "hello",
    "hey",
    "hii",
    "hlo",
    "good morning",
    "good afternoon",
    "good evening",
    "namaste"
]);

const BASIC_THANKS_TRIGGERS = new Set([
    "thanks",
    "thank you",
    "thanks a lot",
    "thank u",
    "ok thanks",
    "okay thanks",
    "got it",
    "noted",
    "alright thanks",
    "thanks i will wait",
    "thanks will wait",
    "thank you i will wait",
    "thank you will wait",
    "thanks for the update",
    "thank you for the update",
    "thanks for update",
    "thank you for update",
    "thanks for sharing",
    "thank you for sharing",
    "ok will wait",
    "okay will wait",
    "i will wait",
    "will wait"
]);

const BASIC_CLOSING_TRIGGERS = new Set([
    "bye",
    "goodbye",
    "see you",
    "talk later",
    "that is all",
    "that's all",
    "no thanks bye"
]);

const BUSINESS_ASK_PATTERN =
    /\b(order|refund|return|exchange|cancel|cancellation|tracking|track|status|delivery|deliver|dispatch|payment|product|price|size|available|availability|policy|store|appointment|help me|need|want|looking for|where is|where's|can you|share|link|eta|awb|courier|damaged|defective|wrong|missing)\b/i;

const hasSupportContext = (channelData = {}) => {
    return (
        (channelData?.active_orders || []).length > 0 ||
        !!channelData?.freshservice?.ticket_id ||
        (channelData?.chat_thread || []).some((thread) =>
            /\b(order|delivery|tracking|refund|return|exchange|cancel|cancellation|eta|dispatch|shipment|priority check|freshservice)\b/i.test(
                thread?.message || ""
            )
        )
    );
};

const getStandardResponse = (message = "", channelData = {}) => {
    const normalized = normalizeBasicText(message);

    if (!normalized) {
        return { use_standard_response: false };
    }

    // Hard guard: if there is any business ask, do not use fixed response.
    if (BUSINESS_ASK_PATTERN.test(normalized)) {
        return { use_standard_response: false };
    }

    const supportContext = hasSupportContext(channelData);

    if (BASIC_GREETING_TRIGGERS.has(normalized)) {
        return {
            use_standard_response: true,
            response_type: "greeting_only",
            response_text: "Hi! Welcome to Aza Fashions. How may I assist you today?"
        };
    }

    if (BASIC_THANKS_TRIGGERS.has(normalized)) {
        // In an active support/order/Freshservice context, acknowledgement should not create a new bot reply.
        if (supportContext) {
            return {
                use_standard_response: true,
                response_type: "support_acknowledgement_only",
                response_text: "Noted, we’ll update you once confirmed."
            };
        }

        return {
            use_standard_response: true,
            response_type: "thanks_only",
            response_text: "You’re welcome. Please let me know if there’s anything else I can help you with."
        };
    }

    if (BASIC_CLOSING_TRIGGERS.has(normalized)) {
        return {
            use_standard_response: true,
            response_type: "closing_only",
            response_text: "Thank you for reaching out to Aza Fashions. Have a great day."
        };
    }

    return { use_standard_response: false };
};

const isThanksOrAckText = (message = "") => {
    const normalized = normalizeBasicText(message);

    return (
        BASIC_THANKS_TRIGGERS.has(normalized) ||
        /\b(thanks|thank you|thank u|got it|noted|ok|okay|alright|will wait|i will wait|update received)\b/i.test(normalized)
    );
};

const normalizeFollowup = (followup) => {
    if (!followup || followup.ask !== true) {
        return DEFAULT_FOLLOWUP;
    }

    return {
        ask: true,
        question: followup.question || "",
        options: Array.isArray(followup.options) ? followup.options : []
    };
};


const isHumanRequested = (query = "") => {
    return /\b(human|agent|manager|customer care|support person|talk to someone|speak to someone|speak with someone|talk to a human|speak with a human|chat with agent|call me|callback|call back)\b/i.test(query || "");
};

const isOrderServiceAsk = (query = "") => {
    return /\b(order|track|tracking|status|delivery|deliver|dispatch|shipment|refund|return|exchange|cancel|cancellation|update|where is|where's|wismo|payment|address)\b/i.test(query || "");
};

const runPipeline = async (query, userId, channelData = {}) => {
    // STAGE 1: NORMALIZE EXTERNAL INPUT FOR INTERNAL PROMPTS
    const normalizedChannelData = {
        ...(channelData || {}),
        chat_id: channelData?.chat_id || "",
        channel: channelData?.channel || "web",
        country: channelData?.country || "India",
        chat_thread: Array.isArray(channelData?.chat_thread) ? channelData.chat_thread : [],
        active_orders: Array.isArray(channelData?.active_orders) ? channelData.active_orders : [],
        freshservice: channelData?.freshservice || { ...DEFAULT_FRESHSERVICE }
    };

    if (!Array.isArray(normalizedChannelData.freshservice?.threads)) {
        normalizedChannelData.freshservice.threads = [];
    }

    const context = enrichCustomerContext(userId, normalizedChannelData);
    const chatId = normalizedChannelData?.chat_id || "";

    const standardResponse = getStandardResponse(query, normalizedChannelData);

    if (standardResponse.use_standard_response) {
        const isSupportAck =
            standardResponse.response_type === "support_acknowledgement_only";

        return {
            chat_id: chatId,
            reply: standardResponse.response_text,
            bot_type: isSupportAck ? "support" : "standard_response",
            decision_status: "resolved",
            agent_review_required: false,
            followup_question: DEFAULT_FOLLOWUP,
            metadata: {
                intent: isSupportAck ? "support" : "standard_response",
                sub_bucket: standardResponse.response_type,
                confidence: 1,
                validated: true,
                team: "",
                order_card: { ...DEFAULT_ORDER_CARD },
                freshservice: {
                    ticket_required: false,
                    ticket_id: "",
                    reason: "",
                    msg: ""
                },
                agent_review_contact: null
            }
        };
    }

    // STAGE 2: ROUTER
    const routerInput = ROUTER_PROMPT
        .replace('{query}', query || '')
        .replace('{context}', JSON.stringify(context?.live_behavior || {}));

    const intentData = await callLLM(routerInput, config.MODELS.ROUTER);

    if (intentData?.error) {
        return {
            chat_id: chatId,
            reply: intentData.reply_text || "Sorry, I couldn’t understand that. Could you please try again?",
            bot_type: "unknown",
            followup_question: DEFAULT_FOLLOWUP,
            metadata: {
                error: true
            }
        };
    }



    const hasOrderContext =
        Array.isArray(normalizedChannelData?.active_orders) &&
        normalizedChannelData.active_orders.length > 0;

    const humanRequested = isHumanRequested(query);
    const likelySupportStatusAsk = isOrderServiceAsk(query);

    let effectiveBucket = intentData?.primary_bucket || "";

    // STAGE 3: GREETING / CONVERSATIONAL FALLBACK
    if (intentData?.primary_bucket === "greeting") {
        // In active support/order context, conversational thanks/ack should not create a fresh greeting.
        if (hasSupportContext(normalizedChannelData) && isThanksOrAckText(query)) {
            return {
                chat_id: chatId,
                reply: "Noted, we’ll update you once confirmed.",
                bot_type: "support",
                decision_status: "resolved",
                agent_review_required: false,
                followup_question: DEFAULT_FOLLOWUP,
                metadata: {
                    intent: "support",
                    sub_bucket: "support_acknowledgement_only",
                    confidence: intentData?.confidence || 1,
                    validated: true,
                    team: "",
                    order_card: { ...DEFAULT_ORDER_CARD },
                    freshservice: {
                        ticket_required: false,
                        ticket_id: "",
                        reason: "",
                        msg: ""
                    },
                    agent_review_contact: null
                },
                ...(RETURN_RAW_RESPONSE ? { raw_response: { routing: intentData } } : {})
            };
        }

        const greetingInput = GREETING_PROMPT.replace("{query}", query || "");

        const greetingReply = await callLLM(greetingInput, config.MODELS.ROUTER);

        let replyText =
            typeof greetingReply === "string"
                ? greetingReply
                : greetingReply?.reply_text || greetingReply?.reply || "";

        // Greeting fallback should never expose LLM/tool errors or agent-transfer text.
        const greetingFailed =
            greetingReply?.error === true ||
            !replyText ||
            /temporary issue|connect you to an agent|couldn.t understand|try again/i.test(replyText);

        if (greetingFailed) {
            replyText = "Hi! Welcome to Aza Fashions. How may I assist you today?";
        }

        if (replyText.trim().toUpperCase() === "HANDOFF") {
            effectiveBucket = "mixed";
        } else {
            return {
                chat_id: chatId,
                reply: replyText,
                bot_type: "greeting",
                decision_status: "resolved",
                agent_review_required: false,
                followup_question: DEFAULT_FOLLOWUP,
                metadata: {
                    intent: "greeting",
                    sub_bucket: intentData?.sub_bucket || "conversation_only",
                    confidence: intentData?.confidence || null,
                    validated: true
                },
                ...(RETURN_RAW_RESPONSE
                    ? { raw_response: { routing: intentData, greeting: greetingReply } }
                    : {})
            };
        }
    }

    // Human + order/support ask should go to support first, so order/FS context is checked.
    if (humanRequested && hasOrderContext && likelySupportStatusAsk) {
        effectiveBucket = "support";
    }

    // Pure human/contact ask.
    if (humanRequested && effectiveBucket !== "support") {
        return {
            chat_id: chatId,
            reply: SUPPORT_CONTACT_REPLY,
            bot_type: "support",
            decision_status: "open",
            agent_review_required: true,
            followup_question: DEFAULT_FOLLOWUP,
            metadata: {
                intent: "support",
                sub_bucket: intentData?.sub_bucket || "human_assistance",
                confidence: intentData?.confidence || null,
                validated: true,
                team: "Customer Care",
                order_card: DEFAULT_ORDER_CARD,
                freshservice: {
                    ticket_required: false,
                    ticket_id: "",
                    reason: "",
                    msg: ""
                },
                agent_review_contact: SUPPORT_CONTACT
            },
            ...(RETURN_RAW_RESPONSE ? { raw_response: { routing: intentData } } : {})
        };
    }

    // STAGE 4: MAIN LLM GENERATION
    let rawResponse = {};
    let finalSafeReply = "";
    

    if (effectiveBucket === "sales") {
        const salesInput = {
            chat_id: chatId,
            customer_profile_data: context?.profile || {},
            customer_query: query || "",
            chat_thread: normalizedChannelData?.chat_thread || [],
            channel_data: normalizedChannelData || {},
            country: normalizedChannelData?.country || context?.profile?.country || "India"
        };

        const prompt = `${SALES_PROMPT}

# Runtime input
${JSON.stringify(salesInput, null, 2)}
`;

        rawResponse = await callLLM(prompt, config.MODELS.MAIN);

        if (LOG_CHATS) console.log("SALES_INPUT:", salesInput);
        if (LOG_CHATS) console.log("SALES_RAW_RESPONSE:", JSON.stringify(rawResponse, null, 2));

        finalSafeReply = rawResponse?.customer_reply || rawResponse?.reply_text || rawResponse?.reply || "";
       

        // Sales common response shape.
        if (rawResponse?.filter_decision) {
            return {
                chat_id: chatId,
                reply: finalSafeReply,
                bot_type: "sales",
                followup_question: normalizeFollowup(rawResponse?.followup_question),
                metadata: {
                    intent: "sales",
                    sub_bucket: intentData?.sub_bucket || "",
                    confidence: intentData?.confidence || null,
                    filter_decision: rawResponse.filter_decision,
                    filters_to_apply: rawResponse?.filter_decision?.filters_to_apply || [],
                    search_term: rawResponse?.filter_decision?.search_term || ""
                },
                ...(RETURN_RAW_RESPONSE ? { raw_response: rawResponse } : {})
            };
        }

        if (LOG_CHATS) {
            console.warn("SALES_SCHEMA_MISSING_FILTER_DECISION:", JSON.stringify(rawResponse, null, 2));
        }
    }

    else if (effectiveBucket === "support") {

        const freshserviceState = buildFreshserviceState(
            query || "",
            normalizedChannelData?.freshservice || {},
            normalizedChannelData?.chat_thread || []
        );

        const supportInput = {
            chat_id: chatId,
            customer_profile_data: context?.profile || {},
            customer_query: query || "",
            current_datetime: freshserviceState.current_datetime,
            freshservice_state: freshserviceState,
            chat_thread: normalizedChannelData?.chat_thread || [],
            freshservice: normalizedChannelData?.freshservice || { ...DEFAULT_FRESHSERVICE },
            channel_data: normalizedChannelData || {},
            active_orders: normalizedChannelData?.active_orders || []
        };

        if (LOG_CHATS) console.log("FRESHSERVICE_STATE:", freshserviceState);

        const prompt = `${SUPPORT_PROMPT}
        
        # Runtime input
        ${JSON.stringify(supportInput, null, 2)}
        `;


        rawResponse = await callLLM(prompt, config.MODELS.MAIN);

        if (LOG_CHATS) console.log("SUPPORT_INPUT:", supportInput);
        if (LOG_CHATS) console.log("SUPPORT_RAW_RESPONSE:", JSON.stringify(rawResponse, null, 2));

        finalSafeReply = rawResponse?.customer_reply || rawResponse?.reply_text || rawResponse?.reply || "";
    }

    else if (effectiveBucket === "mixed") {
        const mixedInput = {
            chat_id: chatId,
            customer_profile_data: context?.profile || {},
            customer_query: query || "",
            chat_thread: normalizedChannelData?.chat_thread || [],
            freshservice: normalizedChannelData?.freshservice || { ...DEFAULT_FRESHSERVICE },
            channel_data: normalizedChannelData || {},
            active_orders: normalizedChannelData?.active_orders || [],
            country: normalizedChannelData?.country || context?.profile?.country || "India"
        };

        const prompt = `${MIXED_PROMPT}

# Runtime input
${JSON.stringify(mixedInput, null, 2)}
`;

        rawResponse = await callLLM(prompt, config.MODELS.FALLBACK);

        if (LOG_CHATS) console.log("MIXED_INPUT:", mixedInput);
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

    // STAGE 5: SUPPORT/MIXED NULL-REPLY + FALLBACK HANDLING
    const isSupportLike =
        effectiveBucket === "support" ||
        effectiveBucket === "mixed" ||
        intentData?.sub_bucket?.includes("mixed");

    const modelIntentionallySilent =
        rawResponse &&
        Object.prototype.hasOwnProperty.call(rawResponse, "customer_reply") &&
        rawResponse.customer_reply === null;

    const supportDecisionStatus = rawResponse?.decision?.status || "";

    if (
        isSupportLike &&
        !finalSafeReply &&
        !modelIntentionallySilent &&
        supportDecisionStatus !== "none"
    ) {
        finalSafeReply = "I’m sorry, I couldn’t fetch enough details for this request. Please share your Order ID or registered email/phone number so we can help further.";
    }

    // STAGE 6: VALIDATION
    let isValid = true;
    let safeReply = finalSafeReply;

    if (!modelIntentionallySilent) {
        const validation = validateResponse(
            { reply_text: finalSafeReply },
            effectiveBucket
        );

        isValid = validation.isValid;
        safeReply = validation.safeReply;
    }

    // STAGE 7: UNIFIED SUPPORT/MIXED RESPONSE
    const decision = rawResponse?.decision || {};
    const fsDecision = decision?.fs || {};
    const cardDecision = decision?.card || {};

    const freshserviceTicketRequired =
        fsDecision?.needed === true ||
        rawResponse?.freshservice_ticket_required === true ||
        rawResponse?.internal_action?.freshservice_ticket_required === true;

    const normalizedDecisionStatus =
        freshserviceTicketRequired ? "resolved" : (decision?.status || "");

    const agentReviewRequired =
        humanRequested ||
        normalizedDecisionStatus === "open";

    const shouldShowReply =
        rawResponse?.customer_reply !== null &&
        !!safeReply;

    const orderCard = {
        image_url: cardDecision?.image_url || "",
        product_name: cardDecision?.product_name || "",
        designer_name: cardDecision?.designer_name || "",
        order_no:
            cardDecision?.order_no ||
            decision?.order?.order_no ||
            "",
        sub_id:
            cardDecision?.sub_id ||
            decision?.order?.sub_id ||
            "",
        tracking_link: cardDecision?.tracking_link || ""
    };

    const baseMetadata = {
        intent: effectiveBucket,
        sub_bucket: intentData?.sub_bucket || "",
        confidence: intentData?.confidence || null,
        validated: isValid
    };

    const supportMetadata = {
        ...baseMetadata,
        team: decision?.team || "",
        order_card: orderCard,
        freshservice: {
            ticket_required: freshserviceTicketRequired,
            ticket_id: freshserviceTicketRequired ? (fsDecision?.ticket_id || "") : "",
            reason: freshserviceTicketRequired ? (fsDecision?.reason || "") : "",
            msg: freshserviceTicketRequired ? (fsDecision?.msg || "") : ""
        },
        agent_review_contact: agentReviewRequired ? SUPPORT_CONTACT : null
    };

    const mixedMetadata = {
        ...supportMetadata,
        filter_decision: rawResponse?.filter_decision || null
    };

    return {
        chat_id: chatId,
        reply: shouldShowReply ? safeReply : null,
        bot_type: effectiveBucket,
        decision_status: normalizedDecisionStatus,
        agent_review_required: agentReviewRequired,
        followup_question: normalizeFollowup(rawResponse?.followup_question),
        metadata: effectiveBucket === "mixed" ? mixedMetadata : supportMetadata,
        ...(RETURN_RAW_RESPONSE ? { raw_response: rawResponse } : {})
    };
};

module.exports = { runPipeline };