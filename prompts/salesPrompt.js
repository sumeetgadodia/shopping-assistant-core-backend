'use strict';

const catalog = require('./sales/catalogMaster');
const corePrompt = require('./sales/corePrompt');
const constraintRulesPrompt = require('./sales/constraintRulesPrompt');
const outputContractPrompt = require('./sales/outputContractPrompt');
const { buildStylistKnowledge } = require('./sales/stylistKnowledge');

const INTENT_MODULES = Object.freeze({
    product_search: require('./sales/intents/productSearchPrompt'),
    recommendation_styling: require('./sales/intents/recommendationStylingPrompt'),
    size_fit_help: require('./sales/intents/sizeFitPrompt'),
    availability: require('./sales/intents/availabilityPrompt'),
    pricing_offer: require('./sales/intents/pricingOfferPrompt'),
    pre_purchase_delivery: require('./sales/intents/prePurchaseDeliveryPrompt'),
    purchase_assistance: require('./sales/intents/purchaseAssistancePrompt'),
    unclear: require('./sales/intents/clarificationPrompt')
});

const BASE_FACETS = [
    'audience_uFilter',
    'level2CategoryName_uFilter',
    'price'
];

const EXPLICIT_OR_CONFIRMED_FACETS = [
    'level3CategoryNames_uFilter',
    'baseColor_uFilter',
    'shopByOccassion_uFilter',
    'classificationTag_uFilter'
];

const OPTIONAL_MATCH_FACETS = [
    'designerName_uFilter',
    'attrPattern_uFilter',
    'attrTypeOfWork_uFilter',
    'baseFabricMaterial_uFilter',
    'celebrity_uFilter',
    'attrLengthSleeve_uFilter',
    'attrNeckline_uFilter',
    'waistRise_uFilter',
    'fit_uFilter'
];

const SIZE_FACETS = new Set([
    'size_uFilter', 'rtsSize_uFilter', 'rtsSizeRow_uFilter', 'rtsSizeUsa_uFilter',
    'warehouseSizeUsa_uFilter', 'discountSize_uFilter', 'discountSizeUsa_uFilter',
    'discountSizeRow_uFilter'
]);

const AMBIGUOUS_DESIGNERS = new Set([
    'three', 'cord', 'love', 'beige', 'dot', 'manner', 'khat', 'kora', 'koai',
    'mati', 'ilk', 'ease', 'begum', 'advait', 'roqa', 'prata', 'kalp', 'domani'
]);

const VALUE_ALIASES = Object.freeze({
    level2CategoryName_uFilter: [
        [/\b(?:gown|gowns)\b/i, 'Gowns'], [/\b(?:dress|dresses)\b/i, 'Dresses'],
        [/\b(?:lehenga|lehenga choli|lehngas?|lehangas?)\b/i, 'Lehengas'], [/\b(?:saree|sari|sarees|saris)\b/i, 'Sarees'],
        [/\bkurta sets?\b/i, 'Kurta Sets'], [/\bkurtas?\b/i, 'Kurtas'], [/\bjumpsuits?\b/i, 'Jumpsuits'],
        [/\bpant sets?\b/i, 'Pant Sets'], [/\bco[- ]?ord sets?\b/i, 'Co-ord Sets'], [/\bsherwanis?\b/i, 'Sherwanis'],
        [/\bbandhgalas?\b/i, 'Bandhgalas'], [/\b(?:bags?|clutches?|potlis?|batwas?)\b/i, 'Bags'],
        [/\b(?:footwear|heels?|flats?|juttis?|shoes?)\b/i, 'Footwear']
    ],
    level3CategoryNames_uFilter: [
        [/\bpre[- ]?draped sarees?\b/i, 'Pre-Draped Sarees'], [/\banarkali sets?\b|\banarkalis?\b/i, 'Anarkali Sets'],
        [/\bsharara sets?\b|\bshararas?\b/i, 'Sharara Sets'], [/\bkaftan dresses?\b/i, 'Kaftan Dresses'],
        [/\bkaftan sets?\b/i, 'Kaftan Sets'], [/\bpotlis?\b|\bbatwas?\b/i, 'Potlis/Batwas'], [/\bclutches?\b/i, 'Clutches']
    ]
});

const normalize = (value = '') => String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const combinedText = ({ query = '', chatThread = [], salesState = {} } = {}) => {
    const turns = (Array.isArray(chatThread) ? chatThread : [])
        .slice(-4)
        .filter((turn) => String(turn?.from || '').toLowerCase() === 'customer')
        .map((turn) => `${turn?.from || ''}: ${turn?.message || ''}`);
    const stateText = [salesState?.search_term || '', salesState?.last_followup?.question || ''];
    return [query, ...turns, ...stateText].join('\n');
};

const isNegatedOccurrence = (paddedText, start) => {
    const prefix = paddedText.slice(Math.max(0, start - 38), start);
    return /\b(?:no|not|without|except|excluding|exclude|avoid|rather than|instead of)(?:\s+for)?\s+(?:a |an |the )?$/i.test(prefix);
};

const facetContextAllows = (facetName, key, text) => {
    const normalized = normalize(text);
    if (facetName === 'attrNeckline_uFilter' && ['yes', 'no'].includes(key)) return false;
    if (facetName === 'attrNeckline_uFilter' && key === 'open') {
        return /\b(?:front open|open front|open neck|open neckline|open (?:sherwani|kurta|jacket|blouse|gown|dress|shirt|coat))\b/i.test(text);
    }
    if (facetName === 'shopByOccassion_uFilter' && key === 'work') {
        return /\b(?:for work|workwear|work wear|office|corporate)\b/i.test(text);
    }
    if (facetName === 'baseFabricMaterial_uFilter' && ['gold', 'zari', 'lace'].includes(key)) {
        return new RegExp(`\\b(?:${key})\\s+(?:fabric|material|textile)\\b|\\b(?:fabric|material|made of|woven in)\\s+(?:${key})\\b`, 'i').test(text);
    }
    if (facetName === 'attrTypeOfWork_uFilter' && key === 'gold') return /\bgold (?:work|embroidery|zari)\b/i.test(text);
    if (facetName === 'attrTypeOfWork_uFilter' && key === 'lace') return /\blace (?:work|embroidery|applique)\b/i.test(text);
    if (facetName === 'baseColor_uFilter' && ['zari', 'lace'].includes(key)) return false;
    return !!normalized;
};

const matchedValues = (facetName, text) => {
    const facet = catalog[facetName];
    if (!facet) return [];
    const designerCue = /\b(designer|brand|label|by)\b/i.test(text);
    const seen = new Set();
    const paddedText = ` ${normalize(text)} `;
    const selectedSpans = [];
    const matches = [];
    const limit = facetName === 'designerName_uFilter' ? 5 : 12;

    for (const value of [...facet.values].sort((a, b) => b.length - a.length)) {
        const key = normalize(value);
        if (!key || seen.has(key)) continue;
        if (facetName === 'designerName_uFilter' && AMBIGUOUS_DESIGNERS.has(key)) {
            const exactQuery = normalize(text) === key;
            if (!designerCue && !exactQuery) continue;
        }

        const needle = ` ${key} `;
        const spans = [];
        let start = paddedText.indexOf(needle);
        while (start >= 0) {
            spans.push([start + 1, start + needle.length - 1]);
            start = paddedText.indexOf(needle, start + 1);
        }
        const independentSpans = spans.filter(([spanStart, spanEnd]) => !isNegatedOccurrence(paddedText, spanStart) && !selectedSpans.some(
            ([selectedStart, selectedEnd]) => spanStart >= selectedStart && spanEnd <= selectedEnd
        ));
        if (!independentSpans.length) continue;
        if (!facetContextAllows(facetName, key, text)) continue;

        seen.add(key);
        selectedSpans.push(...independentSpans);
        matches.push(value);
        if (matches.length >= limit) break;
    }

    (VALUE_ALIASES[facetName] || []).forEach(([re, value]) => {
        if (matches.includes(value) || !catalog[facetName].values.includes(value)) return;
        const found = String(text || '').match(re);
        if (!found) return;
        const normalizedFull = ` ${normalize(text)} `;
        const normalizedMatch = normalize(found[0]);
        const start = normalizedFull.indexOf(` ${normalizedMatch} `) + 1;
        if (start > 0 && isNegatedOccurrence(normalizedFull, start)) return;
        matches.unshift(value);
    });

    return [...new Set(matches)].slice(0, limit);
};

const countryBucket = (country = '') => {
    const value = normalize(country);
    if (!value || value === 'india' || value === 'in') return 'india';
    if (['usa', 'us', 'united states', 'united states of america'].includes(value)) return 'usa';
    return 'row';
};

const hasSizeSignal = (text = '') => {
    const value = String(text || '');
    return /\b(size|fit|measurements?|xxs|xs|xl|xxl|[3-6]xl|free size|\d{1,2}-\d{1,2} y|\d{1,2}-\d{1,2} m)\b/i.test(value) ||
        /\b(?:size|in)\s+(?:s|m|l)\b/i.test(value) ||
        /(?:^|[\s,(])(?:S|M|L)(?=$|[\s,.)])/g.test(value);
};

const hasRtsSignal = (text = '') => {
    const value = String(text || '');
    const explicitDelivery = /\b(ready[- ]?to[- ]?ship|rts|urgent|asap|need (?:it )?soon|fast(?:est)? delivery|deliver(?:y)? by|arrive by|arrival by|tomorrow|within \d+ weeks?)\b/i.test(value);
    const datedNeed = /\bneed\b.{0,60}\bby\s+(?=(?:today|tonight|tomorrow|this|next|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|\d))/i.test(value);
    return explicitDelivery || datedNeed;
};
const hasDiscountSignal = (text = '') => /\b(discount|discounted|sale|offer|best price)\b/i.test(text);
const hasDeliverySignal = (text = '') => hasRtsSignal(text) || /\b(deliver|delivery|shipping time|arrive|arrival|ship by|can (?:it|this) (?:reach|arrive)|will (?:it|this) (?:reach|arrive))\b/i.test(text);
const hasUsaWarehouseSignal = (text = '') => {
    const value = String(text || '');
    return /\b(?:us|usa|united states)\s+(?:warehouse|stock|inventory)\b/i.test(value) ||
        /\b(?:warehouse|stock|inventory)\s+in\s+(?:the\s+)?(?:us|usa|united states)\b/i.test(value) ||
        /\bships?\s+from\s+(?:the\s+)?(?:us|usa|united states)\b/i.test(value);
};

const sizeFacetFor = (bucket, rts, discount, usaWarehouse) => {
    if (usaWarehouse) return 'warehouseSizeUsa_uFilter';
    if (rts) return bucket === 'usa' ? 'rtsSizeUsa_uFilter' : bucket === 'row' ? 'rtsSizeRow_uFilter' : 'rtsSize_uFilter';
    if (discount) return bucket === 'usa' ? 'discountSizeUsa_uFilter' : bucket === 'row' ? 'discountSizeRow_uFilter' : 'discountSize_uFilter';
    return 'size_uFilter';
};

const quickFilterValues = (bucket, text) => {
    const values = [];
    if (hasRtsSignal(text)) values.push(bucket === 'usa' ? 'rtsUsa' : bucket === 'row' ? 'rtsRow' : 'rts');
    if (hasDiscountSignal(text)) values.push(bucket === 'usa' ? 'discountedProductUsa' : bucket === 'row' ? 'discountedProductRow' : 'discountedProduct');
    if (/\b(customi[sz](?:able|ation)|custom size)\b/i.test(text)) values.push('customizable');
    if (/\b(virtual try[- ]?on|vto|try it on)\b/i.test(text)) values.push('virtualTryonAvailable');
    if (/\b(new arrivals?|new collection|latest arrivals?)\b/i.test(text)) values.push('productActivatedInLast60Days');
    return [...new Set(values)];
};

const confirmedFacetValues = (salesState = {}) => {
    const confirmed = Array.isArray(salesState?.confirmed_filters) ? salesState.confirmed_filters : [];
    const selected = new Map();
    confirmed.forEach((item) => {
        const facet = catalog[item?.facet_name];
        if (!facet || facet.dynamic_numeric_range || !Array.isArray(item?.values)) return;
        const valid = item.values.filter((value) => facet.values.includes(String(value)));
        if (valid.length) selected.set(item.facet_name, valid);
    });
    return selected;
};

const renderFacet = (facetName, narrowedValues = null) => {
    const facet = catalog[facetName];
    if (!facet) return '';
    if (facet.dynamic_numeric_range) {
        return `${facet.filter_name}|${facet.facet_name}: dynamic ["min-max"] integer range; this is the only facet allowed to emit values not enumerated here.`;
    }
    const values = Array.isArray(narrowedValues) ? narrowedValues : facet.values;
    return `${facet.filter_name}|${facet.facet_name}:\n[${values.join(', ')}]`;
};

const selectActiveFacets = ({ query = '', chatThread = [], salesState = {}, country = '', subBucket = 'unclear' } = {}) => {
    const text = combinedText({ query, chatThread, salesState });
    const bucket = countryBucket(country);
    const confirmed = confirmedFacetValues(salesState);
    const selected = new Map(BASE_FACETS.map((facetName) => {
        if (catalog[facetName].dynamic_numeric_range) return [facetName, null];
        const currentValues = matchedValues(facetName, query);
        const retainedValues = confirmed.get(facetName) || [];
        return [facetName, currentValues.length ? currentValues : (retainedValues.length ? retainedValues : null)];
    }));
    EXPLICIT_OR_CONFIRMED_FACETS.forEach((facetName) => {
        const currentValues = matchedValues(facetName, query);
        const retainedValues = confirmed.get(facetName) || [];
        const values = currentValues.length ? currentValues : retainedValues;
        if (values.length) selected.set(facetName, values);
    });
    const confirmedQuick = confirmed.get('quickFilters_uFilter') || [];
    const rejectsRts = /\b(no rush|not urgent|do not need ready[- ]?to[- ]?ship|dont need ready[- ]?to[- ]?ship)\b/i.test(query);
    const rejectsDiscount = /\b(not on sale|no sale|without discount|do not need (?:a )?discount|dont need (?:a )?discount)\b/i.test(query);
    const rejectsUsaWarehouse = /\b(?:not|no need|do not need|dont need).{0,24}(?:us|usa|united states)\s+warehouse\b/i.test(query);
    const confirmedUsaWarehouse = confirmed.has('warehouseSizeUsa_uFilter');
    const usaWarehouse = !rejectsUsaWarehouse && (hasUsaWarehouseSignal(text) || confirmedUsaWarehouse);
    const rts = !rejectsRts && (
        hasRtsSignal(text) ||
        subBucket === 'pre_purchase_delivery' ||
        confirmedQuick.some((value) => /^rts/i.test(value))
    );
    const discount = !rejectsDiscount && (
        hasDiscountSignal(text) ||
        subBucket === 'pricing_offer' && /\b(offer|sale|discount)\b/i.test(text) ||
        confirmedQuick.some((value) => /^discountedProduct/i.test(value))
    );

    OPTIONAL_MATCH_FACETS.forEach((facetName) => {
        const values = matchedValues(facetName, text);
        if (values.length) selected.set(facetName, values);
    });

    confirmed.forEach((values, facetName) => {
        if (
            !BASE_FACETS.includes(facetName) &&
            !EXPLICIT_OR_CONFIRMED_FACETS.includes(facetName) &&
            !SIZE_FACETS.has(facetName) &&
            !['quickFilters_uFilter', 'estimatedDeliveryWeek_uFilter'].includes(facetName)
        ) selected.set(facetName, values);
    });

    const confirmedSizeValues = (Array.isArray(salesState?.confirmed_filters) ? salesState.confirmed_filters : [])
        .filter((item) => SIZE_FACETS.has(item?.facet_name))
        .flatMap((item) => Array.isArray(item?.values) ? item.values.map(String) : []);
    if (hasSizeSignal(text) || confirmedSizeValues.length || ['size_fit_help', 'availability', 'pre_purchase_delivery'].includes(subBucket)) {
        const activeSizeFacet = sizeFacetFor(bucket, rts, discount, usaWarehouse);
        const validConfirmedSizes = confirmedSizeValues.filter((value) => catalog[activeSizeFacet].values.includes(value));
        selected.set(activeSizeFacet, hasSizeSignal(query) || !validConfirmedSizes.length ? null : [...new Set(validConfirmedSizes)]);
    }

    const retainedQuick = confirmedQuick.filter((value) => {
        if (rejectsRts && /^rts/i.test(value)) return false;
        if (rejectsDiscount && /^discountedProduct/i.test(value)) return false;
        return true;
    });
    const currentQuick = quickFilterValues(bucket, text).filter((value) => {
        if (rejectsRts && /^rts/i.test(value)) return false;
        if (rejectsDiscount && /^discountedProduct/i.test(value)) return false;
        return true;
    });
    const requiredRtsQuick = rts
        ? [bucket === 'usa' ? 'rtsUsa' : bucket === 'row' ? 'rtsRow' : 'rts']
        : [];
    const quickValues = [...new Set([...retainedQuick, ...currentQuick, ...requiredRtsQuick])];
    if (quickValues.length) selected.set('quickFilters_uFilter', quickValues);
    const confirmedShipping = confirmed.get('estimatedDeliveryWeek_uFilter') || [];
    if (!rejectsRts && (hasDeliverySignal(text) || confirmedShipping.length || subBucket === 'pre_purchase_delivery')) {
        selected.set('estimatedDeliveryWeek_uFilter', hasDeliverySignal(query) ? null : (confirmedShipping.length ? confirmedShipping : null));
    }

    return {
        facets: selected,
        countryBucket: bucket,
        mode: usaWarehouse ? 'usa_warehouse' : rts ? 'rts' : discount ? 'discount' : 'standard'
    };
};

const getSalesPrompt = ({
    subBucket = 'unclear', query = '', chatThread = [], salesState = {}, country = ''
} = {}) => {
    const normalizedSubBucket = INTENT_MODULES[subBucket] ? subBucket : 'unclear';
    const knowledge = buildStylistKnowledge({ query, chatThread, salesState });
    const selection = selectActiveFacets({ query, chatThread, salesState, country, subBucket: normalizedSubBucket });
    const facetPrompt = [...selection.facets.entries()]
        .map(([facetName, values]) => renderFacet(facetName, values))
        .filter(Boolean)
        .join('\n\n');

    const modules = [
        'sales/core',
        `sales/intents/${normalizedSubBucket}`,
        'sales/constraints',
        ...knowledge.familyKeys.map((key) => `sales/knowledge/${key}`),
        ...knowledge.refinementKeys.map((key) => `sales/refinement/${key}`),
        'sales/active_facet_master',
        'sales/output_contract'
    ];

    const prompt = [
        corePrompt,
        INTENT_MODULES[normalizedSubBucket],
        constraintRulesPrompt,
        knowledge.prompt,
        `# ACTIVE FACET MASTER FOR THIS TURN\nCountry bucket: ${selection.countryBucket}. Size mode: ${selection.mode}.\nOnly the facets and values below may be emitted.\n\n${facetPrompt}`,
        outputContractPrompt
    ].join('\n\n');

    return {
        prompt,
        modules,
        diagnostics: {
            prompt_chars: prompt.length,
            active_facets: [...selection.facets.keys()],
            active_facet_values: Object.fromEntries(
                [...selection.facets.entries()]
                    .filter(([, values]) => Array.isArray(values) && values.length)
            ),
            country_bucket: selection.countryBucket,
            size_mode: selection.mode,
            family_banks: knowledge.familyKeys,
            refinement_banks: knowledge.refinementKeys
        }
    };
};

module.exports = {
    getSalesPrompt,
    selectActiveFacets,
    matchedValues,
    countryBucket
};
