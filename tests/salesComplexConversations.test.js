'use strict';

const assert = require('node:assert/strict');
const { analyzeRouteByRules } = require('../services/routingService');
const { getSalesPrompt } = require('../prompts/salesPrompt');
const { validateSalesPayload } = require('../services/salesValidationService');

const routeCases = [
    ['I need something elegant for my best friend’s sangeet, not too heavy, under 70k', 'sales', 'recommendation_styling'],
    ['What can I wear to a destination wedding in Goa?', 'sales', 'recommendation_styling'],
    ['Which one would look best for a daytime mehendi?', 'sales', 'recommendation_styling'],
    ['I need jewellery to match an emerald green saree', 'sales', 'recommendation_styling'],
    ['I am pear shaped and petite; what would suit me?', 'sales', 'recommendation_styling'],
    ['I like the second one. Do you have it in M?', 'sales', 'availability'],
    ['Does this come in XL?', 'sales', 'availability'],
    ['Buy this one', 'sales', 'purchase_assistance'],
    ['Add it to bag', 'sales', 'purchase_assistance'],
    ['My event is next Saturday in Dubai; can it arrive?', 'sales', 'pre_purchase_delivery'],
    ['I want the most premium new arrivals', 'sales', 'product_search'],
    ['Between 50k and 1 lakh', 'sales', 'pricing_offer'],
    ['Which size will fit this lehenga?', 'sales', 'size_fit_help'],
    ['Show black wedding lehengas under 80k', 'sales', 'product_search'],
    ['Show sale kurtas in XL and tell me if returns are allowed', 'support', 'return_exchange']
];

for (const [query, bucket, subBucket] of routeCases) {
    const route = analyzeRouteByRules(query, {});
    assert.equal(route.primary_bucket, bucket, query);
    assert.equal(route.sub_bucket, subBucket, query);
    if (bucket === 'sales') assert.equal(route.needs_llm_check, false, query);
    if (bucket === 'sales') {
        const composed = getSalesPrompt({ subBucket, query, country: 'India' });
        assert.ok(composed.prompt.length < 18000, `${query}: ${composed.prompt.length}`);
    }
}

const activeSalesContext = {
    sales_state: {
        confirmed_filters: [
            { filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Lehengas'] }
        ],
        search_term: '',
        answered_dimensions: ['recipient'],
        last_sub_bucket: 'product_search',
        last_followup: {
            ask: true,
            question: 'Which colour should I show?',
            options: ['Black', 'Blue', 'No preference'],
            reason: 'color'
        }
    }
};

for (const query of ['Black', 'No preference', 'Same but in blue', 'Under 50k', 'No rush', 'Women']) {
    const route = analyzeRouteByRules(query, activeSalesContext);
    assert.equal(route.primary_bucket, 'sales', query);
    assert.equal(route.sub_bucket, 'product_search', query);
    assert.equal(route.needs_llm_check, false, query);
    assert.equal(route.context_has_active_sales, true, query);
}

let composed = getSalesPrompt({
    subBucket: 'recommendation_styling',
    query: 'I need something elegant for my best friend’s sangeet, not too heavy, under 70k',
    country: 'India'
});
assert.ok(!composed.diagnostics.active_facets.includes('size_uFilter'), 'possessive must not activate size S');

composed = getSalesPrompt({ subBucket: 'product_search', query: 'Women’s kurta set', country: 'India' });
assert.ok(!composed.diagnostics.active_facets.includes('size_uFilter'), 'women’s must not activate size S');

composed = getSalesPrompt({ subBucket: 'product_search', query: 'Kurta set in size S', country: 'India' });
assert.ok(composed.diagnostics.active_facets.includes('size_uFilter'));

composed = getSalesPrompt({ subBucket: 'product_search', query: 'I need something by Anita Dongre', country: 'India' });
assert.ok(composed.diagnostics.active_facets.includes('designerName_uFilter'));
assert.ok(!composed.diagnostics.active_facets.includes('quickFilters_uFilter'), 'designer “by” must not imply RTS');
assert.ok(!composed.diagnostics.active_facets.includes('estimatedDeliveryWeek_uFilter'), 'designer “by” must not imply delivery');

composed = getSalesPrompt({ subBucket: 'pre_purchase_delivery', query: 'Can this arrive by next Saturday?', country: 'USA' });
assert.ok(composed.diagnostics.active_facets.includes('quickFilters_uFilter'));
assert.ok(composed.diagnostics.active_facets.includes('estimatedDeliveryWeek_uFilter'));
assert.match(composed.prompt, /\[rtsUsa\]/);

composed = getSalesPrompt({
    subBucket: 'product_search',
    query: 'Actually make it a saree, not a lehenga',
    chatThread: [
        { from: 'customer', message: 'Show gowns' },
        { from: 'customer', message: 'Maybe lehengas' }
    ],
    country: 'India'
});
assert.deepEqual(composed.diagnostics.family_banks, ['saree']);
assert.ok(!composed.diagnostics.refinement_banks.includes('lehenga_color'));

composed = getSalesPrompt({
    subBucket: 'product_search',
    query: 'Same but in blue',
    salesState: activeSalesContext.sales_state,
    country: 'India'
});
assert.deepEqual(composed.diagnostics.family_banks, ['lehenga']);

composed = getSalesPrompt({
    subBucket: 'recommendation_styling',
    query: 'I need jewellery to match an emerald green saree',
    country: 'India'
});
assert.deepEqual(composed.diagnostics.family_banks, ['jewellery']);
assert.match(composed.prompt, /Separate shopping target from anchor/);

composed = getSalesPrompt({ subBucket: 'purchase_assistance', query: 'Add it to bag', country: 'India' });
assert.ok(!composed.diagnostics.family_banks.includes('bags'));
assert.match(composed.prompt, /control answers/i);

const controlPayload = {
    filter_decision: {
        search_ready: true,
        confidence: 'high',
        search_term: 'No preference',
        filters_to_apply: [],
        filters_to_hold_for_later: [],
        sort_hint: 'relevance',
        result_strategy: 'balanced_curated',
        needs_followup: false,
        followup_reason: ''
    },
    customer_reply: 'I’ll keep the edit broad.',
    followup_question: { ask: false, question: '', options: [] }
};
const checked = validateSalesPayload(controlPayload, { chatId: 'complex-1', activeFacetNames: [] });
assert.equal(checked.payload.filter_decision.search_term, '');
assert.equal(checked.payload.filter_decision.search_ready, false);
assert.ok(checked.corrections.includes('control_answer_removed_from_search_term'));
assert.ok(checked.corrections.includes('empty_search_marked_not_ready'));

console.log(`sales complex-conversation tests passed (${routeCases.length} routing + 6 continuity + 11 composition/validation checks)`);
