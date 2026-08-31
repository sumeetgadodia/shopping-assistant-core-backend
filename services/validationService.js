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

const hasSupportEvidence = (kind, runtime = {}, decision = {}) => {
    const orders = Array.isArray(runtime?.activeOrders) ? runtime.activeOrders : [];
    const referenced = findRuntimeOrder(orders, decision?.order?.order_no || decision?.card?.order_no, decision?.order?.sub_id || decision?.card?.sub_id);
    const relevantOrders = referenced ? [referenced] : (orders.length === 1 ? orders : []);
    const text = JSON.stringify({ relevant_orders: relevantOrders, freshservice: runtime?.freshservice || {}, action_result: runtime?.actionResult || {} }).toLowerCase();
    if (kind === 'refund') return /refund.{0,50}(?:processed|approved|completed|credited|initiated|7.?10 working days)/i.test(text);
    if (kind === 'return') return /(?:return|exchange|pickup).{0,50}(?:approved|scheduled|initiated|submitted|processed|under review)/i.test(text);
    if (kind === 'delivery') return relevantOrders.some((order) => !!(
        order?.expected_delivery_date || order?.tracking_link || order?.shipment_history?.length
    ));
    if (kind === 'modification') return /(?:address|phone|mobile|size|colou?r|measurement|customi[sz]ation).{0,50}(?:updated|changed|confirmed|accepted)/i.test(text);
    if (kind === 'payment') return orders.length > 0 || /payment.{0,40}(?:confirmed|successful|received)/i.test(text);
    return false;
};

const normalizeId = (value) => value === null || value === undefined ? '' : String(value).trim();

const findRuntimeOrder = (activeOrders = [], orderNo = '', subId = '') => {
    const wantedOrder = normalizeId(orderNo);
    const wantedSub = normalizeId(subId);
    return (Array.isArray(activeOrders) ? activeOrders : []).find((item) => {
        const orderIds = [item?.customer_order_no, item?.order_id].map(normalizeId).filter(Boolean);
        const runtimeSub = normalizeId(item?.sub_order_id);
        return (!wantedOrder || orderIds.includes(wantedOrder)) && (!wantedSub || runtimeSub === wantedSub);
    });
};

const validateOrderReferences = (decision = {}, runtime = {}, errors = []) => {
    const order = decision?.order || {};
    const card = decision?.card || {};
    const orderNo = normalizeId(order?.order_no || card?.order_no);
    const subId = normalizeId(order?.sub_id || card?.sub_id);
    const hasReference = !!(orderNo || subId || card?.tracking_link || card?.product_name || card?.image_url);
    if (!hasReference) return;

    if (runtime?.isGuest === true && runtime?.accountVerified !== true) {
        errors.push('unverified_guest_order_disclosure');
        return;
    }

    const matched = findRuntimeOrder(runtime?.activeOrders, orderNo, subId);
    if (!matched) {
        errors.push('untrusted_order_reference');
        return;
    }

    if (card?.tracking_link && normalizeId(card.tracking_link) !== normalizeId(matched?.tracking_link)) {
        errors.push('untrusted_tracking_link');
    }
    const products = Array.isArray(matched?.products) ? matched.products : [];
    const allowedNames = [matched?.product_title, ...products.flatMap((item) => [item?.name, item?.product_title])]
        .map(normalizeId).filter(Boolean);
    if (card?.product_name && !allowedNames.includes(normalizeId(card.product_name))) errors.push('untrusted_product_card');
    if (card?.image_url) {
        const allowedImages = products.map((item) => normalizeId(item?.image_url)).filter(Boolean);
        if (!allowedImages.includes(normalizeId(card.image_url))) errors.push('untrusted_product_card');
    }
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
        /\b(successfully cancel(?:led|ed)|cancellation (?:is |has been )?(?:approved|accepted|confirmed)|(?:accepted|confirmed) your cancellation|refund (?:is |has been )?approved)\b/i.test(customerReply) &&
        !hasConfirmedCancellation(runtime?.activeOrders, runtime?.freshservice)
    ) {
        errors.push('unconfirmed_cancellation_outcome');
    }

    if (typeof customerReply === 'string') {
        if (/\b(?:your.{0,24}|the )refund\b.{0,80}\b(?:processed|approved|completed|credited|initiated|will (?:reach|arrive)|within \d+[^.]{0,20}(?:day|hour))\b/i.test(customerReply) && !hasSupportEvidence('refund', runtime, decision)) {
            errors.push('unsupported_refund_claim');
        }
        if (/\b(?:your|the) (?:return|exchange|pickup)\b.{0,80}\b(?:approved|scheduled|initiated|processed|confirmed)\b/i.test(customerReply) && !hasSupportEvidence('return', runtime, decision)) {
            errors.push('unsupported_return_claim');
        }
        if (/\byour order\b.{0,80}\b(?:will|should|is expected to) (?:arrive|be delivered|reach)|\byour order\b.{0,80}\b(?:tomorrow|today)\b/i.test(customerReply) && !hasSupportEvidence('delivery', runtime, decision)) {
            errors.push('unsupported_delivery_claim');
        }
        if (/\byour (?:delivery )?(?:address|phone|mobile|size|colou?r|measurements?|customi[sz]ation)\b.{0,60}\b(?:updated|changed|confirmed|accepted)\b/i.test(customerReply) && !hasSupportEvidence('modification', runtime, decision)) {
            errors.push('unsupported_modification_claim');
        }
        if (/\byour payment\b.{0,60}\b(?:confirmed|successful|received)\b|\border (?:is |was |has been )?placed\b/i.test(customerReply) && !hasSupportEvidence('payment', runtime, decision)) {
            errors.push('unsupported_payment_claim');
        }
        if (/\b(?:freshservice|backend|inward status|merchandise team|warehouse team)\b/i.test(customerReply)) {
            errors.push('internal_wording');
        }
        if (/\bticket(?:\s+(?:id|number))?\s*#?[a-z0-9-]+\b/i.test(customerReply) && !/\bticket\b/i.test(runtime?.query || '')) {
            errors.push('internal_ticket_wording');
        }
    }

    if (payload?.followup_question?.ask === true && !String(payload?.followup_question?.question || '').trim()) {
        errors.push('missing_followup_question');
    }

    validateOrderReferences(decision, runtime, errors);

    if (fs?.needed === true && !['Customer Care', 'Warehouse Team', 'Merchandise Team'].includes(team)) {
        errors.push('freshservice_team_missing');
    }
    if (fs?.needed === true && (!fs?.reason || !fs?.msg)) {
        errors.push('freshservice_details_missing');
    }
    if (fs?.needed === true && fs?.ticket_id && fs.ticket_id !== runtime?.freshservice?.ticket_id) {
        errors.push('untrusted_ticket_id');
    }

    const normalized = {
        chat_id: runtime?.chatId || '',
        decision: {
            status: fs?.needed === true ? 'resolved' : (status || 'none'),
            team,
            order: {
                order_no: normalizeId(order?.order_no),
                sub_id: normalizeId(order?.sub_id)
            },
            card: {
                image_url: typeof card?.image_url === 'string' ? card.image_url : '',
                product_name: typeof card?.product_name === 'string' ? card.product_name : '',
                designer_name: typeof card?.designer_name === 'string' ? card.designer_name : '',
                order_no: normalizeId(card?.order_no),
                sub_id: normalizeId(card?.sub_id),
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
