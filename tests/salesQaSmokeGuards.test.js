'use strict';

const assert = require('node:assert/strict');
const { getSalesPrompt } = require('../prompts/salesPrompt');
const { validateSalesPayload } = require('../services/salesValidationService');
const { analyzeRouteByRules } = require('../services/routingService');

const rawPayload = (overrides = {}) => ({
    filter_decision: {
        search_ready: true,
        primary_intent: 'shopping',
        confidence: 'high',
        search_term: '',
        filters_to_apply: [],
        filters_to_hold_for_later: [],
        sort_hint: 'relevance',
        result_strategy: 'balanced_curated',
        needs_followup: false,
        followup_reason: '',
        ...(overrides.filter_decision || {})
    },
    customer_reply: overrides.customer_reply || 'I’m curating the closest matching options for you.',
    followup_question: overrides.followup_question || { ask: false, question: '', options: [] }
});

const runGuard = (query, raw, runtime = {}) => {
    const composed = getSalesPrompt({
        subBucket: runtime.subBucket || 'product_search',
        query,
        country: 'India',
        salesState: runtime.salesState || {},
        chatThread: runtime.chatThread || []
    });
    return validateSalesPayload(raw, {
        chatId: 'qa-smoke',
        query,
        subBucket: runtime.subBucket || 'product_search',
        salesState: runtime.salesState || {},
        productContext: runtime.productContext || {},
        productResults: runtime.productResults || [],
        activeFacetNames: composed.diagnostics.active_facets,
        activeFacetValues: composed.diagnostics.active_facet_values
    });
};

const facets = (checked) => new Map(
    checked.payload.filter_decision.filters_to_apply.map((filter) => [filter.facet_name, filter.values])
);

let checked = runGuard('Show designer lehengas', rawPayload({
    filter_decision: {
        filters_to_apply: [{ filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Sarees'] }]
    }
}));
assert.deepEqual(facets(checked).get('level2CategoryName_uFilter'), ['Lehengas']);
assert.deepEqual(facets(checked).get('audience_uFilter'), ['Women']);
assert.deepEqual(checked.payload.followup_question.options, ['Women', 'Girls']);
assert.equal(checked.payload.filter_decision.result_strategy, 'broad_preview');

checked = runGuard('Show me kurta sets', rawPayload());
assert.equal(checked.payload.filter_decision.search_ready, false);
assert.deepEqual(facets(checked).get('level2CategoryName_uFilter'), ['Kurta Sets']);
assert.equal(facets(checked).has('audience_uFilter'), false);
assert.deepEqual(checked.payload.followup_question.options, ['Women', 'Men', 'Girls', 'Boys']);

checked = runGuard('I need a wedding outfit', rawPayload({
    filter_decision: {
        filters_to_apply: [
            { filter_name: 'Gender', facet_name: 'audience_uFilter', values: ['Women'] },
            { filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Lehengas', 'Sherwanis'] }
        ]
    }
}), { subBucket: 'recommendation_styling' });
assert.equal(checked.payload.filter_decision.search_ready, false);
assert.equal(facets(checked).has('level2CategoryName_uFilter'), false);
assert.equal(facets(checked).has('audience_uFilter'), false);
assert.equal(checked.payload.filter_decision.followup_reason, 'recipient');

checked = runGuard("I need women's jewellery to match an emerald-green saree", rawPayload({
    filter_decision: {
        filters_to_apply: [
            { filter_name: 'Gender', facet_name: 'audience_uFilter', values: ['Women'] },
            { filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Sarees'] },
            { filter_name: 'Color', facet_name: 'baseColor_uFilter', values: ['Green'] }
        ]
    }
}), { subBucket: 'recommendation_styling' });
assert.equal(facets(checked).get('level2CategoryName_uFilter').includes('Sarees'), false);
assert.ok(facets(checked).get('level2CategoryName_uFilter').includes('Jewellery Sets'));
assert.deepEqual(facets(checked).get('audience_uFilter'), ['Women']);
assert.equal(facets(checked).has('baseColor_uFilter'), false);

checked = runGuard('Women', rawPayload({
    filter_decision: {
        filters_to_apply: [{ filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Lehengas'] }]
    }
}), {
    salesState: {
        confirmed_filters: [{ filter_name: 'Occasion', facet_name: 'shopByOccassion_uFilter', values: ['Wedding'] }],
        last_followup: { ask: true, question: 'Who are you shopping for?', options: ['Women', 'Men', 'Girls', 'Boys'], reason: 'recipient' }
    }
});
assert.equal(checked.payload.filter_decision.search_ready, false);
assert.equal(facets(checked).has('level2CategoryName_uFilter'), false);
assert.equal(checked.payload.filter_decision.followup_reason, 'product_rack');

const priorState = {
    confirmed_filters: [
        { filter_name: 'Gender', facet_name: 'audience_uFilter', values: ['Women'] },
        { filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Lehengas'] },
        { filter_name: 'Color', facet_name: 'baseColor_uFilter', values: ['Blue'] },
        { filter_name: 'Price', facet_name: 'price', values: ['0-80000'] }
    ],
    answered_dimensions: ['recipient', 'occasion'],
    last_sub_bucket: 'product_search',
    last_followup: { ask: true, question: 'Which style should I show?', options: ['Classic', 'Modern'], reason: 'style' }
};
checked = runGuard('Actually make it a saree, not a lehenga', rawPayload({
    filter_decision: {
        filters_to_apply: [{ filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Lehengas'] }]
    }
}), { salesState: priorState });
assert.deepEqual(facets(checked).get('level2CategoryName_uFilter'), ['Sarees']);
assert.deepEqual(facets(checked).get('audience_uFilter'), ['Women']);
assert.deepEqual(facets(checked).get('baseColor_uFilter'), ['Blue']);
assert.deepEqual(facets(checked).get('price'), ['0-80000']);

const colorState = {
    ...priorState,
    last_followup: { ask: true, question: 'Which colour should I show?', options: ['Gold', 'Red', 'Green', 'No preference'], reason: 'color' }
};
checked = runGuard('No preference', rawPayload({
    customer_reply: 'No preference',
    followup_question: { ask: true, question: 'Which colour should I show?', options: ['Gold', 'Red', 'Green', 'No preference'] },
    filter_decision: { followup_reason: 'color' }
}), { salesState: colorState });
assert.equal(facets(checked).has('baseColor_uFilter'), false);
assert.notEqual(checked.payload.followup_question.question, colorState.last_followup.question);
assert.notEqual(checked.payload.customer_reply, 'No preference');

checked = runGuard('No more questions, just show me', rawPayload({
    customer_reply: 'No more questions, just show me',
    followup_question: { ask: true, question: 'Which style do you prefer?', options: ['Classic', 'Modern'] },
    filter_decision: { followup_reason: 'style' }
}), { salesState: priorState });
assert.equal(checked.payload.followup_question.ask, false);
assert.match(checked.payload.customer_reply, /browse/i);

checked = runGuard('I like the second one. Do you have it in M?', rawPayload(), { subBucket: 'availability' });
assert.equal(checked.payload.filter_decision.search_ready, false);
assert.equal(checked.payload.filter_decision.followup_reason, 'product_reference');
assert.match(checked.payload.followup_question.question, /product link or name/i);

assert.deepEqual(
    [analyzeRouteByRules('I need a wedding outfit', {}).primary_bucket, analyzeRouteByRules('I need a wedding outfit', {}).sub_bucket],
    ['sales', 'recommendation_styling']
);
assert.equal(analyzeRouteByRules('No more questions, just show me', { sales_state: priorState }).needs_llm_check, false);

console.log('sales QA smoke guards passed (9 runtime guards + 2 routing checks)');
