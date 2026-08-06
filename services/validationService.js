const ALLOWED_STATUS = new Set(['resolved', 'open', 'none']);
const ALLOWED_TEAMS = new Set(['', 'Customer Care', 'Warehouse Team', 'Merchandise Team']);

const validateResponse = (llmPayload = {}, intentContext = '') => {
    const reply = llmPayload?.reply_text ?? llmPayload?.customer_reply ?? llmPayload?.reply;
    if (reply === null) return { isValid: true, safeReply: null, errors: [] };
    if (typeof reply !== 'string' || !reply.trim()) {
        return { isValid: false, safeReply: '', errors: ['missing_reply'] };
    }

    const errors = [];
    if (reply.length > 800) errors.push('reply_too_long');
    if (/<\/?[a-z][^>]*>/i.test(reply)) errors.push('html_in_reply');
    if (intentContext === 'support' && /\b(freshservice|backend|inward status|merchandise team|warehouse team)\b/i.test(reply)) {
        errors.push('internal_wording');
    }

    return { isValid: errors.length === 0, safeReply: reply.trim(), errors };
};

const hasConfirmedCancellation = (activeOrders = [], freshservice = {}) => {
    const orderText = activeOrders.map((order) => `${order?.status || ''} ${order?.console_status || ''}`).join(' ');
    const threadText = (freshservice?.threads || []).map((thread) => thread?.message || '').join(' ');
    return /\b(cancelled|canceled|cancellation approved|refund approved)\b/i.test(`${orderText} ${threadText}`);
};

const normalizeFollowup = (followup) => {
    if (followup?.ask !== true) return { ask: false, question: '', options: [] };
    return {
        ask: true,
        question: typeof followup?.question === 'string' ? followup.question : '',
        options: Array.isArray(followup?.options) ? followup.options.slice(0, 5) : []
    };
};

const validateSupportPayload = (payload = {}, runtime = {}) => {
    const errors = [];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { isValid: false, errors: ['not_object'], payload: null };
    }

    const decision = payload?.decision || {};
    const fs = decision?.fs || {};
    const card = decision?.card || {};
    const order = decision?.order || {};
    const status = ALLOWED_STATUS.has(decision?.status) ? decision.status : '';
    const team = ALLOWED_TEAMS.has(decision?.team) ? decision.team : '';
    const customerReply = payload?.customer_reply;

    if (!status) errors.push('invalid_decision_status');
    if (!ALLOWED_TEAMS.has(decision?.team)) errors.push('invalid_team');
    if (!(customerReply === null || typeof customerReply === 'string')) errors.push('invalid_customer_reply');

    const replyValidation = validateResponse({ customer_reply: customerReply }, 'support');
    if (!replyValidation.isValid && customerReply !== null) errors.push(...replyValidation.errors);

    if (
        runtime?.subBucket === 'cancellation' &&
        typeof customerReply === 'string' &&
        /\b(successfully cancel(?:led|ed)|cancellation (?:is |has been )?approved|refund (?:is |has been )?approved)\b/i.test(customerReply) &&
        !hasConfirmedCancellation(runtime?.activeOrders, runtime?.freshservice)
    ) {
        errors.push('unconfirmed_cancellation_outcome');
    }

    if (fs?.needed === true && !['Customer Care', 'Warehouse Team', 'Merchandise Team'].includes(team)) {
        errors.push('freshservice_team_missing');
    }
    if (fs?.needed === true && (!fs?.reason || !fs?.msg)) {
        errors.push('freshservice_details_missing');
    }

    const normalized = {
        chat_id: runtime?.chatId || '',
        decision: {
            status: fs?.needed === true ? 'resolved' : (status || 'none'),
            team,
            order: {
                order_no: typeof order?.order_no === 'string' ? order.order_no : '',
                sub_id: typeof order?.sub_id === 'string' ? order.sub_id : ''
            },
            card: {
                image_url: typeof card?.image_url === 'string' ? card.image_url : '',
                product_name: typeof card?.product_name === 'string' ? card.product_name : '',
                designer_name: typeof card?.designer_name === 'string' ? card.designer_name : '',
                order_no: typeof card?.order_no === 'string' ? card.order_no : '',
                sub_id: typeof card?.sub_id === 'string' ? card.sub_id : '',
                tracking_link: typeof card?.tracking_link === 'string' ? card.tracking_link : ''
            },
            fs: fs?.needed === true ? {
                needed: true,
                ticket_id: typeof fs?.ticket_id === 'string' ? fs.ticket_id : '',
                reason: typeof fs?.reason === 'string' ? fs.reason : '',
                msg: typeof fs?.msg === 'string' ? fs.msg : ''
            } : { needed: false, ticket_id: '', reason: '', msg: '' }
        },
        customer_reply: customerReply === null ? null : replyValidation.safeReply,
        followup_question: normalizeFollowup(payload?.followup_question)
    };

    if (normalized.decision.card.tracking_link && normalized.customer_reply) {
        normalized.customer_reply = normalized.customer_reply
            .replace(normalized.decision.card.tracking_link, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    return { isValid: errors.length === 0, errors: [...new Set(errors)], payload: normalized };
};

module.exports = { validateResponse, validateSupportPayload };
