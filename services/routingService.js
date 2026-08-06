const ALLOWED = {
    support: new Set([
        'order_status_tracking', 'delivery_delay', 'cancellation',
        'return_exchange', 'refund', 'payment_issue', 'cod_confirmation', 'order_modification',
        'product_issue', 'complaint_escalation', 'shipping_courier_issue',
        'wrong_missing_item'
    ]),
    sales: new Set([
        'product_search', 'recommendation_styling', 'size_fit_help',
        'availability', 'pricing_offer', 'pre_purchase_delivery',
        'purchase_assistance'
    ]),
    general_info: new Set([
        'policy_query', 'store_contact_info', 'store_visit_appointment',
        'brand_designer_info', 'shipping_payment_info'
    ]),
    account_access: new Set(['login_otp', 'profile_account', 'wishlist_order_history']),
    human_assistance: new Set(['human_assistance']),
    greeting: new Set(['conversation_only']),
    spam_irrelevant: new Set(['spam_irrelevant']),
    unclear: new Set(['unclear'])
};

const PATTERNS = [
    { bucket: 'support', sub_bucket: 'wrong_missing_item', re: /\b(wrong item|wrong product|missing item|missing piece|missing part|missing accessory|incomplete (order|shipment)|only one item|item not received)\b/i },
    { bucket: 'support', sub_bucket: 'product_issue', re: /\b(damaged|defective|quality issue|fabric issue|broken|torn|stain(?:ed)?|not as shown|wrong size received)\b/i },
    { bucket: 'support', sub_bucket: 'payment_issue', re: /\b(payment failed|amount (?:was )?(?:deducted|debited)|charged twice|double charged|payment not received|payment issue|payment confirmation|payment successful|\butr\b|transaction id)\b/i },
    { bucket: 'support', sub_bucket: 'cod_confirmation', re: /\b(confirm(?:ation)? (?:my )?(?:cod|cash on delivery)|(?:cod|cash on delivery) order confirm(?:ation)?|confirm (?:my )?order.*(?:cod|cash on delivery))\b/i },
    { bucket: 'support', sub_bucket: 'cancellation', re: /\b(cancel(?:lation|led|ed)?|cancel my order|do not ship|stop (?:my )?order|placed by mistake)\b/i },
    { bucket: 'support', sub_bucket: 'refund', re: /\b(refund|money back|amount not received|wallet refund|store credit|refund to (?:source|original))\b/i },
    { bucket: 'support', sub_bucket: 'return_exchange', re: /\b(return|exchange|replace(?:ment)?|reverse pickup|return pickup|return request|exchange request)\b/i },
    { bucket: 'support', sub_bucket: 'order_modification', re: /\b(change|update|modify|edit|reschedule)\b.{0,30}\b(address|phone|mobile|size|color|colour|order|delivery|measurement|customi[sz]ation)\b/i },
    { bucket: 'support', sub_bucket: 'delivery_delay', re: /\b(delay(?:ed)?|late delivery|not delivered|still not delivered|delivery pending|shipment delayed|stuck in transit|no update|taking too long|urgent delivery|past (?:the )?(?:date|eta))\b/i },
    { bucket: 'support', sub_bucket: 'shipping_courier_issue', re: /\b(courier|awb|delivery attempt|customs|kyc|delivery partner|address serviceability|stuck at customs)\b/i },
    { bucket: 'support', sub_bucket: 'order_status_tracking', re: /\b(where is my order|order status|track(?:ing)?(?: my)? (?:order|shipment)|shipment status|delivery status|when will it (?:ship|arrive|deliver)|dispatch(?:ed)?|in transit|out for delivery|\bwismo\b)\b/i },
    { bucket: 'support', sub_bucket: 'complaint_escalation', re: /\b(complaint|wrong commitment|poor service|bad service|not acceptable|no response|repeated follow.?up|bot not helping)\b/i },

    { bucket: 'sales', sub_bucket: 'recommendation_styling', re: /\b(suggest|recommend|help me choose|what should i wear|styling help|style me|outfit for|options for)\b/i },
    { bucket: 'sales', sub_bucket: 'product_search', re: /\b(show|looking for|search(?:ing)? for|want to buy|shop|browse)\b.{0,60}\b(sarees?|lehengas?|kurtas?|gowns?|dresses|dress|blouses?|sherwanis?|jewell?ery|bags?|heels?|footwear|outfits?|collections?)\b/i },
    { bucket: 'sales', sub_bucket: 'size_fit_help', re: /\b(size chart|which size|will this fit|fit help|help with size|body measurement|size\s+(?:xxs|xs|s|m|l|xl|xxl|[3-6]xl|free size))\b/i },
    { bucket: 'sales', sub_bucket: 'availability', re: /\b(in stock|availability|restock|back in stock|available in (?:size|colou?r))\b/i },
    { bucket: 'sales', sub_bucket: 'pricing_offer', re: /\b(price|cost|discount|offer|sale|best price|coupon|promo code|affordable|(?:under|below|up to)\s+(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?\s*(?:k|l|lakh|lac)?)\b/i },
    { bucket: 'sales', sub_bucket: 'pre_purchase_delivery', re: /\b(can i get it by|arrive by|deliver by|delivery timeline|need (?:it )?by|ship by|before .{0,20}(?:date|wedding|event)|ready to ship|rts|urgent delivery)\b/i },
    { bucket: 'sales', sub_bucket: 'product_search', re: /\b(sarees?|lehengas?|kurtas?|kurta sets?|gowns?|dresses|blouses?|sherwanis?|bandhgalas?|jewell?ery|earrings?|necklaces?|bags?|heels?|footwear|co[- ]?ords?|anarkalis?|shararas?|kaftans?)\b/i },

    { bucket: 'account_access', sub_bucket: 'login_otp', re: /\b(login|log in|sign in|signin|otp|password|cannot log)\b/i },
    { bucket: 'account_access', sub_bucket: 'wishlist_order_history', re: /\b(wishlist|order history)\b/i },
    { bucket: 'account_access', sub_bucket: 'profile_account', re: /\b(profile|saved address|account (?:issue|update))\b/i },

    { bucket: 'general_info', sub_bucket: 'store_visit_appointment', re: /\b(visit (?:the )?store|store appointment|appointment.*store)\b/i },
    { bucket: 'general_info', sub_bucket: 'store_contact_info', re: /\b(store location|store address|store timing|store hours|contact number|phone number|email (?:id|address)|customer care number)\b/i },
    { bucket: 'general_info', sub_bucket: 'policy_query', re: /\b(policy|terms and conditions)\b/i },
    { bucket: 'general_info', sub_bucket: 'shipping_payment_info', re: /\b(shipping method|payment method|cash on delivery|\bcod\b|international shipping)\b/i },
    { bucket: 'general_info', sub_bucket: 'brand_designer_info', re: /\b(brand info|designer info|authentic|about aza|how aza works)\b/i },

    { bucket: 'human_assistance', sub_bucket: 'human_assistance', re: /\b(human|agent|manager|customer care|support (?:person|executive)|talk to someone|speak (?:to|with) someone|call me|call ?back|escalate)\b/i },
    { bucket: 'greeting', sub_bucket: 'conversation_only', re: /^\s*(hi|hello|hey|hii|hlo|namaste|good (?:morning|afternoon|evening)|thanks|thank you|bye)[\s!.?]*$/i },
    { bucket: 'spam_irrelevant', sub_bucket: 'spam_irrelevant', re: /\b(unsubscribe|seo backlink|guest post|marketing partnership|newsletter subscription|po acknowledgement)\b/i }
];

const SUPPORT_PRIORITY = [
    'product_issue', 'wrong_missing_item', 'payment_issue', 'cod_confirmation', 'cancellation',
    'refund', 'return_exchange', 'order_modification', 'delivery_delay',
    'shipping_courier_issue', 'order_status_tracking', 'complaint_escalation'
];

const dedupe = (items = []) => {
    const seen = new Set();
    return items.filter((item) => {
        const key = `${item.bucket}:${item.sub_bucket}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const detectRuleCandidates = (query = '') => dedupe(
    PATTERNS.filter((item) => item.re.test(query || ''))
        .map(({ bucket, sub_bucket }) => ({ bucket, sub_bucket }))
);

const chooseDominant = (candidates = [], query = '') => {
    const business = candidates.filter((item) => !['greeting', 'human_assistance'].includes(item.bucket));
    const support = business.filter((item) => item.bucket === 'support');
    if (support.length) {
        const supportKinds = new Set(support.map((item) => item.sub_bucket));
        if (
            supportKinds.has('refund') &&
            supportKinds.has('cancellation') &&
            /\b(refund (?:status|pending|delayed|(?:is )?not received)|where(?:'s| is) (?:my )?refund|when (?:will|do) .*refund|money back)\b/i.test(query)
        ) {
            return support.find((item) => item.sub_bucket === 'refund');
        }
        return [...support].sort(
            (a, b) => SUPPORT_PRIORITY.indexOf(a.sub_bucket) - SUPPORT_PRIORITY.indexOf(b.sub_bucket)
        )[0];
    }
    const sales = business.filter((item) => item.bucket === 'sales');
    if (sales.length) {
        const byKind = (kind) => sales.find((item) => item.sub_bucket === kind);
        if (byKind('recommendation_styling')) return byKind('recommendation_styling');
        if (byKind('product_search') && /\b(show|find|looking for|search(?:ing)? for|want to buy|shop|browse)\b/i.test(query)) return byKind('product_search');
        if (byKind('availability') && /\b(in stock|available|availability|restock|back in stock)\b/i.test(query)) return byKind('availability');
        if (byKind('size_fit_help') && /\b(which size|will this fit|fit help|size chart|measurements?)\b/i.test(query)) return byKind('size_fit_help');
        if (byKind('pre_purchase_delivery') && /\b(arrive|deliver|delivery|need (?:it )?by|ship by|ready to ship|rts|urgent)\b/i.test(query)) return byKind('pre_purchase_delivery');
        if (byKind('product_search')) return byKind('product_search');
        if (byKind('pricing_offer')) return byKind('pricing_offer');
        return sales[0];
    }
    if (business.length) return business[0];
    return candidates.find((item) => item.bucket === 'human_assistance') || candidates[0] || { bucket: 'unclear', sub_bucket: 'unclear' };
};

const inferJourney = (bucket) => ({
    support: 'post_order', sales: 'pre_purchase', general_info: 'information_only',
    account_access: 'information_only', human_assistance: 'unclear',
    greeting: 'conversation_only', spam_irrelevant: 'conversation_only', unclear: 'unclear'
}[bucket] || 'unclear');

const analyzeRouteByRules = (query = '', compactContext = {}) => {
    const candidates = detectRuleCandidates(query);
    const humanRequested = candidates.some((item) => item.bucket === 'human_assistance');
    const realIntents = candidates.filter((item) => !['greeting', 'human_assistance'].includes(item.bucket));
    const primary = chooseDominant(candidates, query);
    const contextDependent = /^(yes|no|this one|that one|return it|cancel it|any update|what about this|same one|the black one)[.!?\s]*$/i.test((query || '').trim());
    const uniqueRealIntents = dedupe(realIntents);
    const businessBuckets = new Set(uniqueRealIntents.map((item) => item.bucket));
    const sameSalesBundle = businessBuckets.size === 1 && businessBuckets.has('sales');
    const competing = uniqueRealIntents.length > 1 && !sameSalesBundle;
    const weak = !candidates.length || contextDependent;
    const longFreeForm = (query || '').length > 220;
    const needsLlmCheck = weak || competing || longFreeForm;

    const secondary = candidates
        .filter((item) => `${item.bucket}:${item.sub_bucket}` !== `${primary.bucket}:${primary.sub_bucket}`)
        .filter((item) => !['greeting', 'human_assistance'].includes(item.bucket))
        .slice(0, 3);

    return {
        primary_bucket: primary.bucket,
        sub_bucket: primary.sub_bucket,
        secondary_intents: secondary,
        journey_stage: inferJourney(primary.bucket),
        confidence: needsLlmCheck ? 0.62 : 0.96,
        human_requested: humanRequested,
        needs_human_review: false,
        reason_code: needsLlmCheck ? 'LLM_CHECK' : 'RULE_HIGH_CONFIDENCE',
        needs_llm_check: needsLlmCheck,
        candidates,
        context_has_active_order: !!compactContext?.has_active_orders
    };
};

const validIntent = (bucket, subBucket) => !!ALLOWED[bucket]?.has(subBucket);

const normalizeRouterResult = (result = {}, ruleResult = {}) => {
    let bucket = result?.primary_bucket;
    let subBucket = result?.sub_bucket;

    const routerFailed = result?.reason_code === 'ROUTER_CALL_FAILED';
    if (!validIntent(bucket, subBucket) || routerFailed) {
        bucket = ruleResult?.primary_bucket || 'unclear';
        subBucket = ruleResult?.sub_bucket || 'unclear';
    }

    const ruleHasSupport = (ruleResult?.candidates || []).some((item) => item.bucket === 'support');
    if (['human_assistance', 'sales', 'general_info'].includes(bucket) && ruleHasSupport) {
        bucket = ruleResult?.primary_bucket || bucket;
        subBucket = ruleResult?.sub_bucket || subBucket;
    }

    const secondary = dedupe(Array.isArray(result?.secondary_intents) ? result.secondary_intents : [])
        .filter((item) => validIntent(item?.bucket, item?.sub_bucket))
        .filter((item) => `${item.bucket}:${item.sub_bucket}` !== `${bucket}:${subBucket}`)
        .filter((item) => !['greeting', 'human_assistance'].includes(item.bucket))
        .slice(0, 3);

    const confidence = !routerFailed && Number.isFinite(Number(result?.confidence))
        ? Math.max(0, Math.min(1, Number(result.confidence)))
        : Number(ruleResult?.confidence || 0.5);

    return {
        primary_bucket: bucket,
        sub_bucket: subBucket,
        secondary_intents: secondary.length ? secondary : (ruleResult?.secondary_intents || []),
        journey_stage: ['pre_purchase', 'post_order', 'information_only', 'conversation_only', 'unclear'].includes(result?.journey_stage)
            ? result.journey_stage
            : inferJourney(bucket),
        confidence,
        human_requested: result?.human_requested === true || ruleResult?.human_requested === true,
        needs_human_review: result?.needs_human_review === true || confidence < 0.6,
        reason_code: String(result?.reason_code || ruleResult?.reason_code || 'NORMALIZED').slice(0, 40)
    };
};

module.exports = {
    analyzeRouteByRules,
    normalizeRouterResult
};
