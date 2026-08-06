const { callLLM } = require('./llmService');
const { enrichCustomerContext } = require('./dummyData');
const { validateResponse, validateSupportPayload } = require('./validationService');
const { analyzeRouteByRules, normalizeRouterResult } = require('./routingService');
const config = require('../config/settings');

const ROUTER_PROMPT = require('../prompts/routerPrompt');
const SALES_PROMPT = require('../prompts/salesPrompt');
const { getSupportPrompt } = require('../prompts/supportPrompt');

const LOG_CHATS = process.env.LOG_CHATS === 'true';
const RETURN_RAW_RESPONSE = process.env.RETURN_RAW_RESPONSE === 'true';

const SUPPORT_CONTACT = {
    whatsapp: '+91 8291990059',
    india_call: '02242792123, Mon-Fri, 10 AM-10 PM IST',
    international_call: '+12132135273, Mon-Fri, 10 AM-10 PM IST',
    email: 'contactus@azafashions.com'
};

const SUPPORT_CONTACT_REPLY =
    'You can reach our team on WhatsApp at +91 8291990059, call 02242792123 in India or +12132135273 internationally (Mon-Fri, 10 AM-10 PM IST), or email contactus@azafashions.com.';

const DEFAULT_FOLLOWUP = { ask: false, question: '', options: [] };
const DEFAULT_ORDER_CARD = {
    image_url: '', product_name: '', designer_name: '',
    order_no: '', sub_id: '', tracking_link: ''
};
const DEFAULT_FRESHSERVICE = { ticket_id: '', status: '', threads: [] };

const getCurrentDateTimeISO = () => new Date().toLocaleString('sv-SE', {
    timeZone: 'Asia/Kolkata', hour12: false
}).replace(' ', 'T') + '+05:30';

const getTimeMs = (value) => {
    const time = new Date(value || '').getTime();
    return Number.isFinite(time) ? time : null;
};

const isGenericUpdateAsk = (query = '') => /\b(any update|update|status|where is|where's|eta|still waiting)\b/i.test(query);
const hasNewUrgencyOrDetail = (query = '') => /\b(urgent|escalate|manager|wedding|event|function|today|tomorrow|need it|complaint|not acceptable)\b/i.test(query);

const getLatestThreadTime = (threads = []) => threads
    .map((thread) => getTimeMs(thread?.datetime))
    .filter(Boolean)
    .sort((a, b) => b - a)[0] || null;

const buildFreshserviceState = (query = '', freshservice = {}, chatThread = []) => {
    const latestThreadTime = Math.max(
        getLatestThreadTime(freshservice?.threads || []) || 0,
        getLatestThreadTime((chatThread || []).filter((turn) => turn?.from === 'agent')) || 0
    ) || null;
    const latestThreadAgeHours = latestThreadTime
        ? Number(((Date.now() - latestThreadTime) / 3600000).toFixed(2))
        : null;
    const latestThreadWithin24h = latestThreadAgeHours !== null && latestThreadAgeHours >= 0 && latestThreadAgeHours <= 24;
    const genericUpdateAsk = isGenericUpdateAsk(query);
    const newUrgencyOrDetail = hasNewUrgencyOrDetail(query);

    return {
        current_datetime: getCurrentDateTimeISO(),
        has_ticket: !!freshservice?.ticket_id,
        ticket_id: freshservice?.ticket_id || '',
        latest_thread_age_hours: latestThreadAgeHours,
        latest_thread_within_24h: latestThreadWithin24h,
        generic_update_ask: genericUpdateAsk,
        new_urgency_or_detail: newUrgencyOrDetail,
        should_update_freshservice: !!freshservice?.ticket_id && genericUpdateAsk &&
            !newUrgencyOrDetail && latestThreadAgeHours !== null && latestThreadAgeHours > 24
    };
};

const normalizeBasicText = (text = '') => String(text || '')
    .toLowerCase().trim().replace(/[’]/g, "'").replace(/[.,!?]/g, '').replace(/\s+/g, ' ');

const GREETINGS = new Set(['hi', 'hello', 'hey', 'hii', 'hlo', 'good morning', 'good afternoon', 'good evening', 'namaste']);
const THANKS = new Set([
    'thanks', 'thank you', 'thanks a lot', 'thank u', 'ok thanks', 'okay thanks',
    'got it', 'noted', 'alright thanks', 'thanks i will wait', 'thanks will wait',
    'thank you i will wait', 'thank you will wait', 'thanks for the update',
    'thank you for the update', 'thanks for update', 'thank you for update',
    'thanks for sharing', 'thank you for sharing', 'ok will wait', 'okay will wait',
    'i will wait', 'will wait'
]);
const CLOSINGS = new Set(['bye', 'goodbye', 'see you', 'talk later', 'that is all', "that's all", 'no thanks bye']);
const BUSINESS_ASK_PATTERN = /\b(order|refund|return|exchange|cancel|cancellation|tracking|track|status|delivery|deliver|dispatch|payment|product|price|size|available|availability|policy|store|appointment|help me|need|want|looking for|where is|where's|can you|share|link|eta|awb|courier|damaged|defective|wrong|missing)\b/i;

const hasSupportContext = (channelData = {}) => (
    (channelData?.active_orders || []).length > 0 ||
    !!channelData?.freshservice?.ticket_id ||
    (channelData?.chat_thread || []).some((turn) => /\b(order|delivery|tracking|refund|return|exchange|cancel|eta|dispatch|shipment|priority check)\b/i.test(turn?.message || ''))
);

const getStandardResponse = (message = '', channelData = {}) => {
    const normalized = normalizeBasicText(message);
    if (!normalized || BUSINESS_ASK_PATTERN.test(normalized)) return null;
    if (GREETINGS.has(normalized)) return { type: 'greeting_only', reply: 'Hi! Welcome to Aza Fashions. How may I assist you today?' };
    if (THANKS.has(normalized)) {
        return hasSupportContext(channelData)
            ? { type: 'support_acknowledgement_only', reply: null }
            : { type: 'thanks_only', reply: 'You’re welcome. Please let me know if there’s anything else I can help you with.' };
    }
    if (CLOSINGS.has(normalized)) return { type: 'closing_only', reply: 'Thank you for reaching out to Aza Fashions. Have a great day.' };
    return null;
};

const compactTurns = (turns = []) => turns.slice(-4).map((turn) => ({
    from: turn?.from || '',
    message: String(turn?.message || '').slice(0, 500),
    datetime: turn?.datetime || ''
}));

const buildRouterContext = (channelData = {}) => ({
    has_active_orders: (channelData?.active_orders || []).length > 0,
    active_order_count: (channelData?.active_orders || []).length,
    has_ticket: !!channelData?.freshservice?.ticket_id,
    ticket_status: channelData?.freshservice?.status || '',
    recent_turns: compactTurns(channelData?.chat_thread || [])
});

const hasCrossedDate = (order = {}) => {
    const now = Date.now();
    const dates = [order?.expected_shipping_date, order?.expected_delivery_date]
        .map(getTimeMs).filter(Boolean);
    return dates.some((date) => date < now) &&
        !/\b(shipped|delivered)\b/i.test(order?.status || '') &&
        !order?.tracking_link;
};

const shouldLoadFreshservice = (subBucket, supportInput) => {
    if (supportInput?.freshservice?.ticket_id) return true;
    if (['delivery_delay', 'shipping_courier_issue', 'cancellation', 'return_exchange', 'refund', 'product_issue', 'wrong_missing_item', 'order_modification'].includes(subBucket)) return true;
    if (subBucket === 'order_status_tracking') {
        return hasNewUrgencyOrDetail(supportInput?.customer_query || '') ||
            (supportInput?.active_orders || []).some((order) => order?.support_flags?.delay_needs_internal_check === true || hasCrossedDate(order));
    }
    return false;
};

const summarizeAttachments = (attachments = []) => (Array.isArray(attachments) ? attachments : [])
    .slice(0, 10)
    .map((item) => ({
        name: item?.name || item?.filename || '',
        type: item?.type || item?.mime_type || '',
        image_present: /image/i.test(item?.type || item?.mime_type || '') || !!item?.image_url || !!item?.url,
        content_present: !!item?.base64 || !!item?.content
    }));

const buildSupportInput = (query, intentData, channelData) => {
    const freshserviceState = buildFreshserviceState(query, channelData.freshservice, channelData.chat_thread);
    return {
        chat_id: channelData.chat_id || '',
        customer_name: channelData.customer_name || '',
        customer_query: query || '',
        current_datetime: freshserviceState.current_datetime,
        router: {
            primary: { bucket: intentData.primary_bucket, sub_bucket: intentData.sub_bucket },
            secondary_intents: intentData.secondary_intents || [],
            human_requested: intentData.human_requested === true
        },
        chat_thread: channelData.chat_thread || [],
        freshservice_state: freshserviceState,
        freshservice: channelData.freshservice || { ...DEFAULT_FRESHSERVICE },
        active_orders: channelData.active_orders || [],
        runtime_context: {
            channel: channelData.channel || 'web',
            country: channelData.country || 'India',
            attachments: summarizeAttachments(channelData.attachments),
            account_context: channelData.account_context || {},
            policy_context: channelData.policy_context || {},
            knowledge_context: channelData.knowledge_context || {}
        }
    };
};

const normalizeFollowup = (followup) => followup?.ask === true ? {
    ask: true,
    question: followup?.question || '',
    options: Array.isArray(followup?.options) ? followup.options.slice(0, 5) : []
} : { ...DEFAULT_FOLLOWUP };

const standardResult = (chatId, standard) => ({
    chat_id: chatId,
    reply: standard.reply,
    bot_type: standard.type === 'support_acknowledgement_only' ? 'support' : 'standard_response',
    decision_status: 'resolved',
    agent_review_required: false,
    followup_question: { ...DEFAULT_FOLLOWUP },
    metadata: {
        intent: standard.type === 'support_acknowledgement_only' ? 'support' : 'standard_response',
        sub_bucket: standard.type,
        secondary_intents: [],
        confidence: 1,
        validated: true,
        team: '',
        order_card: { ...DEFAULT_ORDER_CARD },
        freshservice: { ticket_required: false, ticket_id: '', reason: '', msg: '' },
        assisted_support_requested: false,
        agent_review_contact: null
    }
});

const silentResult = (chatId, intentData) => ({
    chat_id: chatId,
    reply: null,
    bot_type: intentData.primary_bucket,
    decision_status: 'none',
    agent_review_required: false,
    followup_question: { ...DEFAULT_FOLLOWUP },
    metadata: {
        intent: intentData.primary_bucket,
        sub_bucket: intentData.sub_bucket,
        secondary_intents: intentData.secondary_intents || [],
        confidence: intentData.confidence,
        validated: true
    }
});

const safeSupportFallback = (chatId, bucket, hasOrders) => ({
    chat_id: chatId,
    decision: {
        status: 'open', team: 'Customer Care',
        order: { order_no: '', sub_id: '' },
        card: { ...DEFAULT_ORDER_CARD },
        fs: { needed: false, ticket_id: '', reason: '', msg: '' }
    },
    customer_reply: bucket === 'general_info'
        ? 'I couldn’t verify that information safely. Please contact Customer Care for confirmation.'
        : bucket === 'account_access'
            ? 'I couldn’t verify the account action safely. Customer Care can help you complete it.'
            : hasOrders
                ? 'I couldn’t verify a safe update from the available details. I’ve kept this open for Customer Care review.'
                : 'Please share your Order ID or Customer Order ID so I can check this safely.',
    followup_question: { ...DEFAULT_FOLLOWUP }
});

const runPipeline = async (query, userId, channelData = {}) => {
    const normalizedChannelData = {
        ...(channelData || {}),
        chat_id: channelData?.chat_id || '',
        channel: channelData?.channel || 'web',
        country: channelData?.country || 'India',
        chat_thread: Array.isArray(channelData?.chat_thread) ? channelData.chat_thread : [],
        active_orders: Array.isArray(channelData?.active_orders) ? channelData.active_orders : [],
        freshservice: channelData?.freshservice || { ...DEFAULT_FRESHSERVICE }
    };
    if (!Array.isArray(normalizedChannelData.freshservice?.threads)) normalizedChannelData.freshservice.threads = [];

    const chatId = normalizedChannelData.chat_id;
    const standard = getStandardResponse(query, normalizedChannelData);
    if (standard) return standardResult(chatId, standard);

    const routerContext = buildRouterContext(normalizedChannelData);
    const ruleResult = analyzeRouteByRules(query, routerContext);
    let intentData = normalizeRouterResult(ruleResult, ruleResult);
    let routingSource = 'rules';
    let rawRouterResponse = null;

    if (ruleResult.needs_llm_check) {
        const routerInput = ROUTER_PROMPT
            .replace('{query}', query || '')
            .replace('{context}', JSON.stringify(routerContext))
            .replace('{candidates}', JSON.stringify(ruleResult.candidates || []));
        rawRouterResponse = await callLLM(routerInput, config.MODELS.ROUTER);
        intentData = normalizeRouterResult(rawRouterResponse, ruleResult);
        routingSource = 'llm_fallback';
    }

    if (LOG_CHATS) console.log('ROUTING:', JSON.stringify({ ruleResult, rawRouterResponse, intentData }, null, 2));

    if (intentData.primary_bucket === 'greeting') {
        return standardResult(chatId, { type: 'greeting_only', reply: 'Hi! Welcome to Aza Fashions. How may I assist you today?' });
    }
    if (intentData.primary_bucket === 'spam_irrelevant') return silentResult(chatId, intentData);
    if (intentData.primary_bucket === 'unclear' || intentData.confidence < 0.5) {
        return {
            chat_id: chatId,
            reply: 'I can help with shopping or order support.',
            bot_type: 'clarification',
            decision_status: 'resolved',
            agent_review_required: false,
            followup_question: {
                ask: true,
                question: 'What would you like help with?',
                options: ['Shop products', 'Check an order', 'Contact Customer Care']
            },
            metadata: {
                intent: 'unclear', sub_bucket: 'unclear', secondary_intents: [],
                confidence: intentData.confidence, validated: true, routing_source: routingSource
            }
        };
    }
    if (intentData.primary_bucket === 'human_assistance') {
        return {
            chat_id: chatId,
            reply: SUPPORT_CONTACT_REPLY,
            bot_type: 'support',
            decision_status: 'resolved',
            agent_review_required: false,
            followup_question: { ...DEFAULT_FOLLOWUP },
            metadata: {
                intent: 'human_assistance', sub_bucket: 'human_assistance',
                secondary_intents: intentData.secondary_intents || [],
                confidence: intentData.confidence, validated: true,
                routing_source: routingSource, team: '',
                order_card: { ...DEFAULT_ORDER_CARD },
                freshservice: { ticket_required: false, ticket_id: '', reason: '', msg: '' },
                assisted_support_requested: true,
                agent_review_contact: SUPPORT_CONTACT
            }
        };
    }

    const context = enrichCustomerContext(userId, normalizedChannelData);
    if (intentData.primary_bucket === 'sales') {
        const salesInput = {
            chat_id: chatId,
            customer_profile_data: context?.profile || {},
            customer_query: query || '',
            chat_thread: normalizedChannelData.chat_thread,
            channel_data: normalizedChannelData,
            country: normalizedChannelData.country || context?.profile?.country || 'India',
            router: {
                primary: { bucket: 'sales', sub_bucket: intentData.sub_bucket },
                secondary_intents: intentData.secondary_intents || []
            }
        };
        const rawResponse = await callLLM(`${SALES_PROMPT}\n\n# Runtime input\n${JSON.stringify(salesInput)}`, config.MODELS.MAIN);
        const reply = rawResponse?.customer_reply || rawResponse?.reply_text || rawResponse?.reply || '';
        const validation = validateResponse({ reply_text: reply }, 'sales');
        return {
            chat_id: chatId,
            reply: validation.isValid ? validation.safeReply : 'I couldn’t safely prepare those recommendations. Could you share the category you want?',
            bot_type: 'sales',
            decision_status: 'resolved',
            agent_review_required: false,
            followup_question: normalizeFollowup(rawResponse?.followup_question),
            metadata: {
                intent: 'sales', sub_bucket: intentData.sub_bucket,
                secondary_intents: intentData.secondary_intents || [],
                confidence: intentData.confidence, validated: validation.isValid,
                routing_source: routingSource,
                filter_decision: rawResponse?.filter_decision || null,
                filters_to_apply: rawResponse?.filter_decision?.filters_to_apply || [],
                search_term: rawResponse?.filter_decision?.search_term || ''
            },
            ...(RETURN_RAW_RESPONSE ? { raw_response: { routing: intentData, reply: rawResponse } } : {})
        };
    }

    const serviceBuckets = new Set(['support', 'general_info', 'account_access']);
    if (!serviceBuckets.has(intentData.primary_bucket)) {
        intentData = { ...intentData, primary_bucket: 'unclear', sub_bucket: 'unclear' };
    }

    const supportInput = buildSupportInput(query, intentData, normalizedChannelData);
    const includeFreshservice = shouldLoadFreshservice(intentData.sub_bucket, supportInput);
    const prompt = `${getSupportPrompt({ subBucket: intentData.sub_bucket, includeFreshservice })}\n\n# RUNTIME INPUT\n${JSON.stringify(supportInput)}`;
    let rawResponse = await callLLM(prompt, intentData.primary_bucket === 'support' ? config.MODELS.MAIN : (config.MODELS.LIGHT || config.MODELS.MAIN));
    let checked = validateSupportPayload(rawResponse, {
        chatId, subBucket: intentData.sub_bucket,
        activeOrders: normalizedChannelData.active_orders,
        freshservice: normalizedChannelData.freshservice
    });

    if (!checked.isValid) {
        if (LOG_CHATS) console.warn('SUPPORT_VALIDATION_RETRY:', checked.errors);
        rawResponse = await callLLM(prompt, config.MODELS.FALLBACK);
        checked = validateSupportPayload(rawResponse, {
            chatId, subBucket: intentData.sub_bucket,
            activeOrders: normalizedChannelData.active_orders,
            freshservice: normalizedChannelData.freshservice
        });
    }

    const finalPayload = checked.isValid
        ? checked.payload
        : safeSupportFallback(chatId, intentData.primary_bucket, normalizedChannelData.active_orders.length > 0);
    const decision = finalPayload.decision;
    const fs = decision.fs;
    const agentReviewRequired = decision.status === 'open';

    return {
        chat_id: chatId,
        reply: finalPayload.customer_reply,
        bot_type: intentData.primary_bucket,
        decision_status: decision.status,
        agent_review_required: agentReviewRequired,
        followup_question: normalizeFollowup(finalPayload.followup_question),
        metadata: {
            intent: intentData.primary_bucket,
            sub_bucket: intentData.sub_bucket,
            secondary_intents: intentData.secondary_intents || [],
            confidence: intentData.confidence,
            validated: checked.isValid,
            validation_errors: checked.isValid ? [] : checked.errors,
            routing_source: routingSource,
            loaded_prompt_modules: [
                'support/core', `support/${intentData.sub_bucket}`,
                ...(includeFreshservice ? ['support/freshservice'] : []),
                'support/output_contract'
            ],
            team: decision.team || '',
            order_card: decision.card || { ...DEFAULT_ORDER_CARD },
            freshservice: {
                ticket_required: fs?.needed === true,
                ticket_id: fs?.needed === true ? (fs.ticket_id || '') : '',
                reason: fs?.needed === true ? (fs.reason || '') : '',
                msg: fs?.needed === true ? (fs.msg || '') : ''
            },
            assisted_support_requested: intentData.human_requested === true,
            agent_review_contact: agentReviewRequired ? SUPPORT_CONTACT : null
        },
        ...(RETURN_RAW_RESPONSE ? { raw_response: { routing: intentData, reply: rawResponse } } : {})
    };
};

module.exports = { runPipeline };
