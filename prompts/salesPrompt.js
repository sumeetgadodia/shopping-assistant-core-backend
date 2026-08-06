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
    'level3CategoryNames_uFilter',
    'baseColor_uFilter',
    'shopByOccassion_uFilter',
    'classificationTag_uFilter',
    'price'
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
    'discountSize_uFilter', 'discountSizeUsa_uFilter', 'discountSizeRow_uFilter'
]);

const AMBIGUOUS_DESIGNERS = new Set([
    'three', 'cord', 'love', 'beige', 'dot', 'manner', 'khat', 'kora', 'koai',
    'mati', 'ilk', 'ease', 'begum', 'advait', 'roqa', 'prata', 'kalp', 'domani'
]);

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

const phrasePresent = (text, phrase) => {
    const haystack = ` ${normalize(text)} `;
    const needle = normalize(phrase);
    return !!needle && haystack.includes(` ${needle} `);
};

const matchedValues = (facetName, text) => {
    const facet = catalog[facetName];
    if (!facet) return [];
    const designerCue = /\b(designer|brand|label|by)\b/i.test(text);
    const seen = new Set();

    return [...facet.values]
        .sort((a, b) => b.length - a.length)
        .filter((value) => {
            const key = normalize(value);
            if (!phrasePresent(text, value) || seen.has(key)) return false;
            if (facetName === 'designerName_uFilter' && AMBIGUOUS_DESIGNERS.has(key)) {
                const exactQuery = normalize(text) === key;
                if (!designerCue && !exactQuery) return false;
            }
            seen.add(key);
            return true;
        })
        .slice(0, facetName === 'designerName_uFilter' ? 5 : 12);
};

const countryBucket = (country = '') => {
    const value = normalize(country);
    if (!value || value === 'india' || value === 'in') return 'india';
    if (['usa', 'us', 'united states', 'united states of america'].includes(value)) return 'usa';
    return 'row';
};

const hasSizeSignal = (text = '') => /\b(size|fit|measurements?|xxs|xs|s|m|l|xl|xxl|[3-6]xl|free size|\d{1,2}-\d{1,2} y|\d{1,2}-\d{1,2} m)\b/i.test(text);
const hasRtsSignal = (text = '') => /\b(ready[- ]?to[- ]?ship|rts|urgent|asap|need (?:it )?soon|fast(?:est)? delivery|deliver(?:y)? by|need .* by|tomorrow|within \d+ weeks?)\b/i.test(text);
const hasDiscountSignal = (text = '') => /\b(discount|discounted|sale|offer|best price)\b/i.test(text);
const hasDeliverySignal = (text = '') => hasRtsSignal(text) || /\b(deliver|delivery|shipping time|arrive|arrival|ship by)\b/i.test(text);

const sizeFacetFor = (bucket, rts, discount) => {
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
    const selected = new Map(BASE_FACETS.map((facetName) => [facetName, null]));
    const confirmed = confirmedFacetValues(salesState);
    const confirmedQuick = confirmed.get('quickFilters_uFilter') || [];
    const rejectsRts = /\b(no rush|not urgent|do not need ready[- ]?to[- ]?ship|dont need ready[- ]?to[- ]?ship)\b/i.test(query);
    const rejectsDiscount = /\b(not on sale|no sale|without discount|do not need (?:a )?discount|dont need (?:a )?discount)\b/i.test(query);
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
            !SIZE_FACETS.has(facetName) &&
            !['quickFilters_uFilter', 'estimatedDeliveryWeek_uFilter'].includes(facetName)
        ) selected.set(facetName, values);
    });

    const confirmedSizeValues = (Array.isArray(salesState?.confirmed_filters) ? salesState.confirmed_filters : [])
        .filter((item) => SIZE_FACETS.has(item?.facet_name))
        .flatMap((item) => Array.isArray(item?.values) ? item.values.map(String) : []);
    if (hasSizeSignal(text) || confirmedSizeValues.length || ['size_fit_help', 'availability', 'pre_purchase_delivery'].includes(subBucket)) {
        const activeSizeFacet = sizeFacetFor(bucket, rts, discount);
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
    const quickValues = [...new Set([...retainedQuick, ...currentQuick])];
    if (quickValues.length) selected.set('quickFilters_uFilter', quickValues);
    const confirmedShipping = confirmed.get('estimatedDeliveryWeek_uFilter') || [];
    if (!rejectsRts && (hasDeliverySignal(text) || confirmedShipping.length || subBucket === 'pre_purchase_delivery')) {
        selected.set('estimatedDeliveryWeek_uFilter', hasDeliverySignal(query) ? null : (confirmedShipping.length ? confirmedShipping : null));
    }

    return {
        facets: selected,
        countryBucket: bucket,
        mode: rts ? 'rts' : discount ? 'discount' : 'standard'
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
