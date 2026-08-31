'use strict';

const catalog = require('../prompts/sales/catalogMaster');
const { validateResponse } = require('./validationService');

const CONFIDENCE = new Set(['high', 'medium', 'low']);
const SORT_HINTS = new Set(['relevance', 'price_low_to_high', 'price_high_to_low', 'newest', 'fastest_delivery', 'premium_first']);
const RESULT_STRATEGIES = new Set(['narrow_exact', 'balanced_curated', 'broad_preview']);
const CONTROL_ANSWERS = new Set([
    'no preference', 'show all', 'any color', 'any colour', 'no budget limit', 'no rush'
]);
const DISCOVERY_BUCKETS = new Set(['product_search', 'recommendation_styling', 'pricing_offer']);
const JEWELLERY_CATEGORIES = [
    'Earrings', 'Necklaces', 'Jewellery Sets', 'Rings', 'Bracelets', 'Bangles',
    'Hair Accessories', 'Maang Tikkas', 'Matha Pattis', 'Hathphools', 'Nose Rings',
    'Malas', 'Anklets', 'Passas', 'Kaleeras'
].filter((value) => catalog.level2CategoryName_uFilter.values.includes(value));
const STOP_QUESTION_PATTERN = /\b(?:no more questions?|stop asking|just show me|just let me browse|let me browse|skip the questions?|dont ask|do not ask)\b/i;
const PRODUCT_REFERENCE_PATTERN = /\b(?:this|that|it|the (?:first|second|third|fourth|\d+(?:st|nd|rd|th)) one|\d+(?:st|nd|rd|th) one)\b/i;
const ANCHOR_ONLY_FACETS = new Set([
    'level2CategoryName_uFilter', 'level3CategoryNames_uFilter', 'baseColor_uFilter',
    'shopByOccassion_uFilter', 'classificationTag_uFilter', 'attrPattern_uFilter',
    'attrTypeOfWork_uFilter', 'baseFabricMaterial_uFilter'
]);

const asShortText = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';

const validPriceRange = (value) => {
    const match = String(value).match(/^(\d+)-(\d+)$/);
    if (!match) return false;
    const min = Number(match[1]);
    const max = Number(match[2]);
    return Number.isSafeInteger(min) && Number.isSafeInteger(max) && min >= 0 && max >= min;
};

const normalizeFilters = (rawFilters = [], activeFacetNames = null, errors = []) => {
    const merged = new Map();
    const active = Array.isArray(activeFacetNames) ? new Set(activeFacetNames) : null;

    (Array.isArray(rawFilters) ? rawFilters : []).forEach((item) => {
        const facetName = typeof item?.facet_name === 'string' ? item.facet_name : '';
        const facet = catalog[facetName];
        if (!facet) {
            errors.push('unknown_facet_removed');
            return;
        }
        if (active && !active.has(facetName)) {
            errors.push('inactive_facet_removed');
            return;
        }
        if (!Array.isArray(item?.values)) {
            errors.push('invalid_filter_values_removed');
            return;
        }

        const values = item.values
            .map((value) => String(value))
            .filter((value) => facet.dynamic_numeric_range ? validPriceRange(value) : facet.values.includes(value));
        if (values.length !== item.values.length) errors.push('unknown_filter_value_removed');
        if (!values.length) return;

        if (item?.filter_name !== facet.filter_name) errors.push('filter_name_corrected');
        if (!merged.has(facetName)) merged.set(facetName, new Set());
        values.forEach((value) => merged.get(facetName).add(value));
    });

    return [...merged.entries()].map(([facetName, values]) => {
        let normalizedValues = [...values];
        if (facetName === 'audience_uFilter' && normalizedValues.length > 1) {
            normalizedValues = normalizedValues.slice(0, 1);
            errors.push('multiple_gender_values_reduced');
        }
        return {
            filter_name: catalog[facetName].filter_name,
            facet_name: facetName,
            values: normalizedValues
        };
    });
};

const normalizeFollowup = (followup = {}, errors = [], allowFreeText = false) => {
    if (followup?.ask !== true) return { ask: false, question: '', options: [] };

    const question = asShortText(followup?.question, 180);
    const options = [...new Set((Array.isArray(followup?.options) ? followup.options : [])
        .map((option) => asShortText(option, 60))
        .filter(Boolean))].slice(0, 5);

    if (!question) {
        errors.push('invalid_followup_removed');
        return { ask: false, question: '', options: [] };
    }
    if (options.length < 2 && !allowFreeText) errors.push('followup_options_too_few');
    if ((followup?.options || []).length > 5) errors.push('followup_options_truncated');
    return { ask: true, question, options };
};

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const removeDuplicatedQuestion = (reply = '', question = '', errors = []) => {
    if (!reply || !question) return reply;
    const normalizedReply = reply.trim();
    const exactAtEnd = new RegExp(`(?:\\s|^)*${escapeRegExp(question)}\\s*$`, 'i');
    if (!exactAtEnd.test(normalizedReply)) return normalizedReply;
    errors.push('duplicate_followup_removed_from_reply');
    return normalizedReply.replace(exactAtEnd, '').trim();
};

const normalizedText = (value = '') => String(value || '').toLowerCase()
    .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const canonicalFilter = (facetName, values) => ({
    filter_name: catalog[facetName].filter_name,
    facet_name: facetName,
    values: [...new Set(values)].filter((value) => (
        catalog[facetName].dynamic_numeric_range ? validPriceRange(value) : catalog[facetName].values.includes(value)
    ))
});

const filterMap = (filters = []) => new Map(filters.map((filter) => [filter.facet_name, { ...filter, values: [...filter.values] }]));

const setFacet = (map, facetName, values, errors, correction) => {
    const filter = canonicalFilter(facetName, values);
    if (!filter.values.length) return;
    const previous = map.get(facetName);
    if (!previous || JSON.stringify(previous.values) !== JSON.stringify(filter.values)) errors.push(correction);
    map.set(facetName, filter);
};

const isNegatedAt = (text, index) => /\b(?:no|not|without|except|rather than|instead of)(?:\s+for)?\s*$/i
    .test(String(text).slice(Math.max(0, index - 36), index));

const audienceResolution = (query = '') => {
    const text = String(query || '');
    if (/\b(?:bride|bridal)\b.{0,35}\bgroom\b|\bgroom\b.{0,35}\b(?:bride|bridal)\b/i.test(text)) {
        return { audience: '', multiOptions: ['Bride', 'Groom'], kidsAmbiguous: false };
    }
    if (/\b(?:mother|mom|mum)\b.{0,35}\bdaughter\b|\bdaughter\b.{0,35}\b(?:mother|mom|mum)\b/i.test(text)) {
        return { audience: '', multiOptions: ['Mother', 'Daughter'], kidsAmbiguous: false };
    }
    if (/\b(?:couple|family looks?|family outfits?|his and her)\b/i.test(text)) {
        return { audience: '', multiOptions: ['Women', 'Men', 'Girls', 'Boys', 'Couple/family'], kidsAmbiguous: false };
    }

    const patterns = [
        ['Women', /\b(?:women(?:s|wear)?|woman|ladies(?:wear)?|lady|wife|bride|bridal|mother|mom|mum|for her)\b/gi],
        ['Men', /\b(?:men(?:s|wear)?|man|gentleman|husband|groom|father|dad|for him)\b/gi],
        ['Girls', /\b(?:girls?|daughter|baby girl)\b/gi],
        ['Boys', /\b(?:boys?|son|baby boy)\b/gi]
    ];
    const signals = [];
    for (const [audience, re] of patterns) {
        for (const match of text.matchAll(re)) {
            if (!isNegatedAt(text, match.index || 0)) signals.push({ audience, index: match.index || 0 });
        }
    }
    signals.sort((a, b) => a.index - b.index);
    const kidsAmbiguous = /\b(?:kids?|children|child)\b/i.test(text) && !signals.some((item) => ['Girls', 'Boys'].includes(item.audience));
    return { audience: signals.at(-1)?.audience || '', multiOptions: [], kidsAmbiguous };
};

const explicitAudience = (query = '') => audienceResolution(query).audience;

const targetText = (query = '') => {
    const beforeAnchor = String(query).split(/\b(?:to match|to go with|to complement|for this look)\b/i)[0];
    return beforeAnchor.replace(/\b(?:not|instead of|rather than|without)\s+(?:a |an |the )?(?:sarees?|lehengas?|gowns?|dresses?|kurtas?|kurta sets?|sherwanis?|bandhgalas?|jewell?ery|bags?|footwear)\b/gi, ' ');
};

const explicitProductFilters = (query = '') => {
    const text = targetText(query);
    const result = {};
    if (/\b(?:jewell?ery|jewels?|accessories)\b/i.test(text)) result.level2CategoryName_uFilter = JEWELLERY_CATEGORIES;
    else if (/\b(?:earrings?|jhumkas?|chandbalis?)\b/i.test(text)) result.level2CategoryName_uFilter = ['Earrings'];
    else if (/\b(?:necklaces?|chokers?)\b/i.test(text)) result.level2CategoryName_uFilter = ['Necklaces'];
    else if (/\b(?:potlis?|batwas?)\b/i.test(text)) {
        result.level2CategoryName_uFilter = ['Bags'];
        result.level3CategoryNames_uFilter = ['Potlis/Batwas'];
    } else if (/\bclutches?\b/i.test(text)) {
        result.level2CategoryName_uFilter = ['Bags'];
        result.level3CategoryNames_uFilter = ['Clutches'];
    } else if (/\bbags?\b/i.test(text) && !/\badd\b.{0,24}\b(?:bag|cart)\b/i.test(text)) result.level2CategoryName_uFilter = ['Bags'];
    else if (/\blehengas?|lehngas?|lehangas?\b/i.test(text)) result.level2CategoryName_uFilter = ['Lehengas'];
    else if (/\b(?:pre[- ]?draped sarees?|sarees?|saris?)\b/i.test(text)) {
        result.level2CategoryName_uFilter = ['Sarees'];
        if (/\bpre[- ]?draped\b/i.test(text)) result.level3CategoryNames_uFilter = ['Pre-Draped Sarees'];
    }
    else if (/\bgowns?\b/i.test(text)) result.level2CategoryName_uFilter = ['Gowns'];
    else if (/\b(?:dresses|dress)\b/i.test(text)) result.level2CategoryName_uFilter = ['Dresses'];
    else if (/\banarkalis?\b/i.test(text)) {
        result.level2CategoryName_uFilter = ['Kurta Sets'];
        result.level3CategoryNames_uFilter = ['Anarkali Sets'];
    } else if (/\bshararas?\b/i.test(text)) {
        result.level2CategoryName_uFilter = ['Kurta Sets'];
        result.level3CategoryNames_uFilter = ['Sharara Sets'];
    }
    else if (/\bkurta sets?\b/i.test(text)) result.level2CategoryName_uFilter = ['Kurta Sets'];
    else if (/\bkurtas?\b/i.test(text)) result.level2CategoryName_uFilter = ['Kurtas'];
    else if (/\bjumpsuits?\b/i.test(text)) result.level2CategoryName_uFilter = ['Jumpsuits'];
    else if (/\bpant sets?\b/i.test(text)) result.level2CategoryName_uFilter = ['Pant Sets'];
    else if (/\bco[- ]?ord sets?\b/i.test(text)) result.level2CategoryName_uFilter = ['Co-ord Sets'];
    else if (/\bsherwanis?\b/i.test(text)) result.level2CategoryName_uFilter = ['Sherwanis'];
    else if (/\bbandhgalas?\b/i.test(text)) result.level2CategoryName_uFilter = ['Bandhgalas'];
    else if (/\bfootwear|heels?|flats?|juttis?|shoes?\b/i.test(text)) result.level2CategoryName_uFilter = ['Footwear'];
    return result;
};

const parseAmount = (raw = '') => {
    const match = String(raw).replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k|l|lac|lakh)?/i);
    if (!match) return null;
    const multiplier = /^k$/i.test(match[2] || '') ? 1000 : /^(?:l|lac|lakh)$/i.test(match[2] || '') ? 100000 : 1;
    return Math.round(Number(match[1]) * multiplier);
};

const explicitPrice = (query = '') => {
    const text = String(query);
    const range = text.match(/\b(?:(?:between|from)\s+)?(?:₹|rs\.?|inr)?\s*([\d,.]+\s*(?:k|l|lac|lakh)?)\s*(?:and|to|-)\s*(?:₹|rs\.?|inr)?\s*([\d,.]+\s*(?:k|l|lac|lakh)?)/i);
    if (range) {
        const min = parseAmount(range[1]);
        const max = parseAmount(range[2]);
        if (Number.isSafeInteger(min) && Number.isSafeInteger(max) && max >= min) return `${min}-${max}`;
    }
    const upper = text.match(/\b(?:under|below|up to|upto|max(?:imum)?)\s+(?:₹|rs\.?|inr)?\s*([\d,.]+\s*(?:k|l|lac|lakh)?)/i);
    if (upper && isNegatedAt(text, upper.index || 0)) return '';
    const max = upper ? parseAmount(upper[1]) : null;
    if (Number.isSafeInteger(max)) return `0-${max}`;
    const around = text.match(/\b(?:around|about|approximately|approx)\s+(?:₹|rs\.?|inr)?\s*([\d,.]+\s*(?:k|l|lac|lakh)?)/i);
    const target = around ? parseAmount(around[1]) : null;
    if (Number.isSafeInteger(target)) return `${Math.max(0, Math.round(target * 0.8))}-${Math.round(target * 1.2)}`;
    return '';
};

const reasonFacets = (reason = '') => {
    const key = normalizedText(reason);
    if (/colou?r|palette/.test(key)) return ['baseColor_uFilter'];
    if (/budget|price/.test(key)) return ['price'];
    if (/delivery|shipping|rts|urgent|timeline/.test(key)) return ['quickFilters_uFilter', 'estimatedDeliveryWeek_uFilter'];
    if (/occasion|moment|event/.test(key)) return ['shopByOccassion_uFilter'];
    if (/recipient|wearer|gender|audience/.test(key)) return ['audience_uFilter'];
    if (/product|rack|silhouette|category/.test(key)) return ['level2CategoryName_uFilter', 'level3CategoryNames_uFilter'];
    return [];
};

const hasRuntimeProduct = (runtime = {}) => (
    (Array.isArray(runtime.productResults) && runtime.productResults.length > 0) ||
    (runtime.productContext && typeof runtime.productContext === 'object' && Object.keys(runtime.productContext).length > 0)
);

const runtimeProducts = (runtime = {}) => [
    ...(runtime.productContext && typeof runtime.productContext === 'object' ? [runtime.productContext] : []),
    ...(Array.isArray(runtime.productResults) ? runtime.productResults : [])
];

const hasRuntimeFact = (runtime = {}, kind = '') => runtimeProducts(runtime).some((product) => {
    if (kind === 'stock') return product?.in_stock === true || !!product?.stock_status || !!product?.availability || Array.isArray(product?.available_sizes);
    if (kind === 'delivery') return !!product?.estimated_delivery || !!product?.eta || !!product?.delivery_date;
    if (kind === 'discount') return Number(product?.discount_percent) > 0 || Number(product?.discount) > 0 || !!product?.sale_price;
    if (kind === 'fit') return !!product?.size_chart && !!runtime?.customerMeasurements;
    return false;
});

const guardCommercialReply = (reply = '', runtime = {}, errors = []) => {
    let safe = reply;
    if (/\b(?:is|are|we have|its|it is)\s+(?:currently\s+)?(?:available|in stock)|\bsize\s+[a-z0-9-]+\s+is available\b/i.test(safe) && !hasRuntimeFact(runtime, 'stock')) {
        safe = 'I’ll verify the exact size and availability against the selected piece.';
        errors.push('unsupported_stock_claim_replaced');
    } else if (/\b(?:will|can)\s+(?:arrive|reach|be delivered)|\barrives?\s+(?:by|on)|\bdelivery (?:is|will be)\b/i.test(safe) && !hasRuntimeFact(runtime, 'delivery')) {
        safe = 'I’ll check the delivery window for the exact product, size and destination.';
        errors.push('unsupported_delivery_claim_replaced');
    } else if (/\b(?:offer|give|get|apply|available)\s+(?:you\s+)?\d+%|\b\d+%\s+(?:off|discount)\b/i.test(safe) && !hasRuntimeFact(runtime, 'discount')) {
        safe = 'I’ll check the current offer available on the selected piece.';
        errors.push('unsupported_discount_claim_replaced');
    } else if (/\b(?:will|should)\s+fit\b|\bfits?\s+(?:you\s+)?perfectly\b/i.test(safe) && !hasRuntimeFact(runtime, 'fit')) {
        safe = 'I can guide you using the product size chart and your measurements.';
        errors.push('unsupported_fit_claim_replaced');
    } else if (/\b(?:i(?:’|')?ve|we(?:’|')?ve|has been)\s+added\b|\badded (?:it|this|the .+ one) to (?:your )?(?:bag|cart)\b/i.test(safe) && runtime?.actionResult?.success !== true && runtime?.cartResult?.success !== true) {
        safe = 'I can help you proceed once the exact product and size are confirmed.';
        errors.push('unsupported_cart_claim_replaced');
    }
    return safe;
};

const nextStylistFollowup = (filters, runtime = {}) => {
    const answered = new Set((runtime.salesState?.answered_dimensions || []).map(normalizedText));
    const previousReason = normalizedText(runtime.salesState?.last_followup?.reason || '');
    if (runtime.salesState?.last_followup?.ask && String(runtime.query || '').trim()) answered.add(previousReason);
    const categories = filters.get('level2CategoryName_uFilter')?.values || [];
    const subcategories = filters.get('level3CategoryNames_uFilter')?.values || [];
    const audience = filters.get('audience_uFilter')?.values?.[0] || '';
    const has = (...keys) => keys.some((key) => answered.has(normalizedText(key)));

    if (['Girls', 'Boys'].includes(audience) && categories.length && !has('age', 'size', 'age_size')) {
        return { ask: true, question: 'What age or size should I curate for?', options: ['1–3 Y', '4–6 Y', '7–9 Y', '10–13 Y', 'Share size'], reason: 'age_size' };
    }
    if (categories.includes('Bags') && !subcategories.length && !has('product_type', 'bag_type')) {
        return { ask: true, question: 'Which bag style should I begin with?', options: ['Potlis', 'Clutches', 'Handbags', 'Totes', 'Show all'], reason: 'bag_type' };
    }
    if (categories.includes('Bags') && !has('bag_detail', 'palette', 'craft')) {
        return { ask: true, question: 'What should guide this bag edit next?', options: ['Palette', 'Craft', 'Size', 'Carry style', 'No preference'], reason: 'bag_detail' };
    }

    if (categories.some((value) => JEWELLERY_CATEGORIES.includes(value)) && !has('product_type', 'jewellery_type')) {
        return { ask: true, question: 'Which jewellery would you like to begin with?', options: ['Earrings', 'Chokers', 'Necklaces', 'Jewellery Sets', 'Show all'], reason: 'jewellery_type' };
    }
    if (!filters.has('shopByOccassion_uFilter') && !has('occasion', 'occasion_moment', 'event_moment')) {
        return { ask: true, question: 'What are you dressing for?', options: ['Wedding', 'Festive', 'Sangeet', 'Reception', 'Other'], reason: 'occasion' };
    }
    if (!has('look_direction', 'style', 'styling_direction')) {
        return { ask: true, question: 'Which direction feels most like you?', options: ['Classic Indian', 'Modern glamour', 'Soft romantic', 'Statement craft', 'Minimal luxe'], reason: 'look_direction' };
    }
    if (!has('statement_level', 'mood', 'vibe')) {
        return { ask: true, question: 'How statement-led should the look feel?', options: ['Understated elegance', 'Refined statement', 'High glamour', 'Light and effortless', 'No preference'], reason: 'statement_level' };
    }
    if (!filters.has('baseColor_uFilter') && !has('color', 'colour', 'palette')) {
        return { ask: true, question: 'Which palette should I refine this toward?', options: ['Classic jewel tones', 'Soft pastels', 'Ivory and gold', 'Bright festive', 'No preference'], reason: 'palette' };
    }
    if (!filters.has('price') && !has('budget', 'price')) {
        return { ask: true, question: 'Which budget should I curate within?', options: ['Under ₹50k', '₹50k–₹1L', '₹1L–₹2L', '₹2L+', 'No budget limit'], reason: 'budget' };
    }
    if (previousReason === 'decision step' && /\brefine this edit\b/i.test(runtime.query || '')) {
        return { ask: true, question: 'What should I refine first?', options: ['Silhouette', 'Palette', 'Craft', 'Comfort', 'Budget'], reason: 'refinement_focus' };
    }
    return { ask: true, question: 'Would you like to refine the edit or complete the look?', options: ['Refine this edit', 'Compare favourites', 'Complete the look', 'Just show me'], reason: 'decision_step' };
};

const applyRuntimeSalesGuards = ({ filters, followup, reply, searchTerm, searchReady, resultStrategy }, runtime, errors) => {
    if (!runtime?.query && !runtime?.salesState) return { filters, followup, reply, searchTerm, searchReady, resultStrategy, followupReason: '' };

    const query = String(runtime.query || '');
    const queryKey = normalizedText(query);
    const map = filterMap(filters);
    const activeValues = runtime.activeFacetValues || {};
    const productFilters = explicitProductFilters(query);
    const hasStylingAnchor = /\b(?:to match|to go with|to complement|for this look)\b/i.test(query) &&
        !!productFilters.level2CategoryName_uFilter;
    const recipient = audienceResolution(query);
    const audience = recipient.audience;
    const price = explicitPrice(query);
    const controlAnswer = CONTROL_ANSWERS.has(queryKey);
    const stopQuestions = STOP_QUESTION_PATTERN.test(query);
    let clearedFacets = [];
    let retrievalBlocked = false;

    if (productFilters.level2CategoryName_uFilter) {
        map.delete('level2CategoryName_uFilter');
        map.delete('level3CategoryNames_uFilter');
    }
    if (hasStylingAnchor) ANCHOR_ONLY_FACETS.forEach((facetName) => map.delete(facetName));

    if (controlAnswer) {
        clearedFacets = reasonFacets(runtime.salesState?.last_followup?.reason || runtime.salesState?.last_followup?.question || runtime.rawFollowupReason || '');
        let removed = false;
        clearedFacets.forEach((facetName) => { if (map.delete(facetName)) removed = true; });
        if (removed) errors.push('control_answer_cleared_optional_filter');
        searchTerm = '';
    }

    Object.entries(activeValues).forEach(([facetName, values]) => {
        if (!catalog[facetName] || !Array.isArray(values) || !values.length) return;
        if (clearedFacets.includes(facetName)) return;
        if (hasStylingAnchor && ANCHOR_ONLY_FACETS.has(facetName)) return;
        if (productFilters.level2CategoryName_uFilter && ['level2CategoryName_uFilter', 'level3CategoryNames_uFilter'].includes(facetName)) return;
        if (audience && facetName === 'audience_uFilter') return;
        setFacet(map, facetName, values, errors, 'confirmed_or_explicit_filter_restored');
    });
    Object.entries(productFilters).forEach(([facetName, values]) => setFacet(map, facetName, values, errors, 'explicit_product_target_enforced'));
    if (price) setFacet(map, 'price', [price], errors, 'explicit_price_enforced');
    if (audience) setFacet(map, 'audience_uFilter', [audience], errors, 'explicit_recipient_enforced');

    const categoryGrounded = !!productFilters.level2CategoryName_uFilter ||
        (Array.isArray(activeValues.level2CategoryName_uFilter) && activeValues.level2CategoryName_uFilter.length > 0);
    const audienceGrounded = !!audience ||
        (Array.isArray(activeValues.audience_uFilter) && activeValues.audience_uFilter.length > 0);
    if (!categoryGrounded) {
        map.delete('level2CategoryName_uFilter');
        map.delete('level3CategoryNames_uFilter');
    }
    if (!audienceGrounded || recipient.multiOptions.length || recipient.kidsAmbiguous) map.delete('audience_uFilter');

    const genericRecipientRequest = !categoryGrounded && DISCOVERY_BUCKETS.has(runtime.subBucket);
    if (!audienceGrounded && genericRecipientRequest) {
        map.delete('audience_uFilter');
    }
    const categories = map.get('level2CategoryName_uFilter')?.values || [];
    const isJewellery = categories.length > 0 && categories.every((value) => JEWELLERY_CATEGORIES.includes(value));
    const existingAudience = map.get('audience_uFilter')?.values?.[0] || '';
    let guardedFollowup = followup;
    let followupReason = asShortText(runtime.rawFollowupReason, 100);

    if (recipient.multiOptions.length) {
        map.delete('audience_uFilter');
        searchReady = false;
        retrievalBlocked = true;
        guardedFollowup = { ask: true, question: 'Who would you like me to style first?', options: recipient.multiOptions };
        followupReason = 'recipient_sequence';
        errors.push('multiple_recipients_sequenced');
    } else if (recipient.kidsAmbiguous) {
        map.delete('audience_uFilter');
        searchReady = false;
        retrievalBlocked = true;
        guardedFollowup = { ask: true, question: 'Who are you shopping for?', options: ['Girls', 'Boys'] };
        followupReason = 'recipient';
        errors.push('kids_recipient_blocked_retrieval');
    } else if (!existingAudience && genericRecipientRequest) {
        searchReady = false;
        retrievalBlocked = true;
        guardedFollowup = { ask: true, question: 'Who are you shopping for?', options: ['Women', 'Men', 'Girls', 'Boys', 'Couple/family'] };
        followupReason = 'recipient';
        errors.push('unresolved_recipient_blocked_retrieval');
    } else if (existingAudience && !categories.length && DISCOVERY_BUCKETS.has(runtime.subBucket)) {
        searchReady = false;
        retrievalBlocked = true;
        guardedFollowup = existingAudience === 'Men' || existingAudience === 'Boys'
            ? { ask: true, question: 'Which collection would you like to explore?', options: ['Sherwanis', 'Kurta Sets', 'Bandhgalas', 'Jackets And Sets', 'Suits And Tuxedos'] }
            : { ask: true, question: 'Which collection would you like to explore?', options: ['Lehengas', 'Sarees', 'Gowns', 'Kurta Sets', 'Co-ord Sets'] };
        followupReason = 'product_rack';
        errors.push('unresolved_product_rack_blocked_retrieval');
    } else if (!existingAudience && categories.includes('Sarees')) {
        setFacet(map, 'audience_uFilter', ['Women'], errors, 'dominant_recipient_enforced');
    } else if (!existingAudience && categories.some((value) => ['Lehengas', 'Gowns', 'Dresses'].includes(value))) {
        setFacet(map, 'audience_uFilter', ['Women'], errors, 'adult_preview_recipient_enforced');
        guardedFollowup = { ask: true, question: 'Who are you shopping for?', options: ['Women', 'Girls'] };
        followupReason = 'recipient';
        resultStrategy = 'broad_preview';
    } else if (!existingAudience && categories.some((value) => ['Sherwanis', 'Bandhgalas'].includes(value))) {
        setFacet(map, 'audience_uFilter', ['Men'], errors, 'adult_preview_recipient_enforced');
        guardedFollowup = { ask: true, question: 'Who are you shopping for?', options: ['Men', 'Boys'] };
        followupReason = 'recipient';
        resultStrategy = 'broad_preview';
    } else if (!existingAudience && (categories.some((value) => ['Kurta Sets', 'Kurtas', 'Footwear'].includes(value)) || isJewellery)) {
        map.delete('audience_uFilter');
        searchReady = false;
        retrievalBlocked = true;
        guardedFollowup = { ask: true, question: 'Who are you shopping for?', options: ['Women', 'Men', 'Girls', 'Boys'] };
        followupReason = 'recipient';
        errors.push('unresolved_recipient_blocked_retrieval');
    }

    if (!retrievalBlocked && DISCOVERY_BUCKETS.has(runtime.subBucket) && (map.size > 0 || !!searchTerm)) {
        searchReady = true;
    }

    const closeToBuy = ['availability', 'purchase_assistance', 'size_fit_help', 'pre_purchase_delivery'].includes(runtime.subBucket);
    const productReferenceRequired = closeToBuy && !hasRuntimeProduct(runtime) &&
        (PRODUCT_REFERENCE_PATTERN.test(query) || !productFilters.level2CategoryName_uFilter);
    if (productReferenceRequired) {
        searchReady = false;
        retrievalBlocked = true;
        guardedFollowup = { ask: true, question: 'Please share the product link or name so I can check the exact piece.', options: [] };
        followupReason = 'product_reference';
        reply = 'I’ll check the exact product once you share its link or name.';
        errors.push('missing_product_reference_blocked_guess');
    } else if (stopQuestions) {
        guardedFollowup = { ask: false, question: '', options: [] };
        followupReason = '';
        reply = 'Of course—I’ll keep the current Aza edit open for you to browse.';
        errors.push('stop_instruction_honored');
    } else if (DISCOVERY_BUCKETS.has(runtime.subBucket) && searchReady) {
        const previousQuestion = normalizedText(runtime.salesState?.last_followup?.question || '');
        const repeatsPrevious = guardedFollowup.ask && previousQuestion && normalizedText(guardedFollowup.question) === previousQuestion;
        if (!guardedFollowup.ask || (repeatsPrevious && String(query).trim())) {
            const next = nextStylistFollowup(map, runtime);
            guardedFollowup = { ask: next.ask, question: next.question, options: next.options };
            followupReason = next.reason;
            errors.push(repeatsPrevious ? 'repeated_followup_advanced' : 'stylist_followup_restored');
        }
    }

    const replyMatchesQuery = queryKey && normalizedText(reply) === queryKey;
    if (replyMatchesQuery) {
        reply = controlAnswer
            ? 'I’ll keep that preference open and refine the edit around your other choices.'
            : 'I’ll refine the Aza edit around your latest choice.';
        errors.push('customer_query_echo_replaced');
    }

    reply = guardCommercialReply(reply, runtime, errors);

    const guardedFilters = [...map.values()];
    const inferredReady = guardedFilters.length > 0 || !!searchTerm;
    if (!inferredReady) searchReady = false;
    else if (!retrievalBlocked && DISCOVERY_BUCKETS.has(runtime.subBucket)) searchReady = true;
    return { filters: guardedFilters, followup: guardedFollowup, reply, searchTerm, searchReady, resultStrategy, followupReason };
};

const validateSalesPayload = (payload = {}, runtime = {}) => {
    const errors = [];
    const fatalErrors = [];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { isValid: false, errors: ['not_object'], corrections: [], payload: null };
    }

    const decision = payload?.filter_decision && typeof payload.filter_decision === 'object'
        ? payload.filter_decision
        : {};
    if (!payload?.filter_decision) errors.push('missing_filter_decision_rebuilt');

    const previousFilters = Array.isArray(runtime?.salesState?.confirmed_filters)
        ? runtime.salesState.confirmed_filters
        : [];
    const combinedRawFilters = [
        ...previousFilters,
        ...(Array.isArray(decision?.filters_to_apply) ? decision.filters_to_apply : []),
        ...(Array.isArray(decision?.filters_to_hold_for_later) ? decision.filters_to_hold_for_later : [])
    ];
    if ((decision?.filters_to_hold_for_later || []).length) errors.push('held_filters_moved_to_apply');
    let filters = normalizeFilters(combinedRawFilters, runtime?.activeFacetNames, errors);

    const freeTextFollowup = decision?.followup_reason === 'product_reference' ||
        /product link or name/i.test(payload?.followup_question?.question || '');
    let followup = normalizeFollowup(payload?.followup_question, errors, freeTextFollowup);
    let reply = asShortText(payload?.customer_reply ?? payload?.reply_text ?? payload?.reply, 800);
    reply = removeDuplicatedQuestion(reply, followup.question, errors);
    const replyCheck = validateResponse({ reply_text: reply }, 'sales');
    if (!replyCheck.isValid) {
        fatalErrors.push(...replyCheck.errors);
        reply = '';
    } else {
        reply = replyCheck.safeReply;
    }

    let searchTerm = asShortText(decision?.search_term, 100);
    if (CONTROL_ANSWERS.has(searchTerm.toLowerCase())) {
        searchTerm = '';
        errors.push('control_answer_removed_from_search_term');
    }
    let inferredSearchReady = filters.length > 0 || !!searchTerm;
    let searchReady = typeof decision?.search_ready === 'boolean' ? decision.search_ready : inferredSearchReady;
    if (typeof decision?.search_ready !== 'boolean') errors.push('search_ready_normalized');
    if (searchReady && !inferredSearchReady) {
        searchReady = false;
        errors.push('empty_search_marked_not_ready');
    }

    const confidence = CONFIDENCE.has(decision?.confidence) ? decision.confidence : 'medium';
    const sortHint = SORT_HINTS.has(decision?.sort_hint) ? decision.sort_hint : 'relevance';
    let resultStrategy = RESULT_STRATEGIES.has(decision?.result_strategy)
        ? decision.result_strategy
        : (searchReady ? 'balanced_curated' : 'broad_preview');
    if (!CONFIDENCE.has(decision?.confidence)) errors.push('confidence_normalized');
    if (!SORT_HINTS.has(decision?.sort_hint)) errors.push('sort_hint_normalized');
    if (!RESULT_STRATEGIES.has(decision?.result_strategy)) errors.push('result_strategy_normalized');

    const guarded = applyRuntimeSalesGuards({
        filters, followup, reply, searchTerm, searchReady, resultStrategy
    }, {
        ...runtime,
        rawFollowupReason: decision?.followup_reason
    }, errors);
    ({ filters, followup, reply, searchTerm, searchReady, resultStrategy } = guarded);
    inferredSearchReady = filters.length > 0 || !!searchTerm;

    if (!reply) {
        errors.push('missing_reply_replaced');
        reply = searchReady && inferredSearchReady
            ? 'I’ll curate an Aza edit around your confirmed choices.'
            : 'Tell me a little more and I’ll shape the right Aza edit for you.';
    }

    const normalized = {
        chat_id: runtime?.chatId || '',
        filter_decision: {
            search_ready: searchReady,
            primary_intent: asShortText(decision?.primary_intent, 160),
            confidence,
            search_term: searchTerm,
            filters_to_apply: filters,
            filters_to_hold_for_later: [],
            sort_hint: sortHint,
            result_strategy: resultStrategy,
            needs_followup: followup.ask,
            followup_reason: followup.ask ? (guarded.followupReason || asShortText(decision?.followup_reason, 100)) : ''
        },
        customer_reply: reply,
        followup_question: followup
    };

    return {
        isValid: fatalErrors.length === 0,
        errors: [...new Set([...fatalErrors, ...errors])],
        corrections: [...new Set(errors)],
        payload: normalized
    };
};

const validateProductRack = (products = [], filters = []) => {
    const map = filterMap(Array.isArray(filters) ? filters : []);
    const audience = normalizedText(map.get('audience_uFilter')?.values?.[0] || '');
    const categories = new Set((map.get('level2CategoryName_uFilter')?.values || []).map(normalizedText));
    const accepted = [];
    const rejected = [];
    (Array.isArray(products) ? products : []).forEach((product) => {
        const productAudience = normalizedText(product?.audience || product?.product_gender || product?.gender || '');
        const productCategory = normalizedText(product?.category || product?.categoryTitle || product?.pc_subcategory_title || product?.subcategory || '');
        const reasons = [];
        if (audience && productAudience && productAudience !== audience) reasons.push('audience_mismatch');
        if (categories.size && productCategory && !categories.has(productCategory)) reasons.push('category_mismatch');
        if (reasons.length) rejected.push({ product, reasons });
        else accepted.push(product);
    });
    return { accepted, rejected, isValid: rejected.length === 0 };
};

module.exports = {
    validateSalesPayload,
    validateProductRack,
    normalizeFilters,
    validPriceRange,
    removeDuplicatedQuestion
};
