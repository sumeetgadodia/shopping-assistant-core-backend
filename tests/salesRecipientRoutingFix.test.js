'use strict';

const assert = require('node:assert/strict');
const { getSalesPrompt } = require('../prompts/salesPrompt');
const { validateSalesPayload } = require('../services/salesValidationService');

const promptCases = [
    { query: 'Kurta set', family: 'kurta' },
    { query: 'Designer lehenga', family: 'lehenga' },
    { query: 'Saree', family: 'saree' },
    { query: 'Clutch bags', family: 'bags' }
];

for (const item of promptCases) {
    const composed = getSalesPrompt({
        subBucket: 'product_search',
        query: item.query,
        country: 'India'
    });
    assert.ok(composed.diagnostics.family_banks.includes(item.family), item.query);
    assert.match(composed.prompt, /Recipient gate/);
    assert.match(composed.prompt, /Never mix audiences/);
    assert.match(composed.prompt, /Never emit more than one Gender value/);
}

const mixedGenderPayload = {
    chat_id: 'model-id',
    filter_decision: {
        search_ready: true,
        primary_intent: 'Designer lehengas',
        confidence: 'high',
        search_term: '',
        filters_to_apply: [
            { filter_name: 'Gender', facet_name: 'audience_uFilter', values: ['Women', 'Girls'] },
            { filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Lehengas'] }
        ],
        filters_to_hold_for_later: [],
        sort_hint: 'relevance',
        result_strategy: 'broad_preview',
        needs_followup: true,
        followup_reason: 'recipient'
    },
    customer_reply: 'I’ll start with women’s designer lehengas.',
    followup_question: {
        ask: true,
        question: 'Who are you shopping for?',
        options: ['Women', 'Girls']
    }
};

const checked = validateSalesPayload(mixedGenderPayload, {
    chatId: 'runtime-id',
    activeFacetNames: ['audience_uFilter', 'level2CategoryName_uFilter']
});

assert.equal(checked.isValid, true);
assert.deepEqual(checked.payload.filter_decision.filters_to_apply[0], {
    filter_name: 'Gender',
    facet_name: 'audience_uFilter',
    values: ['Women']
});
assert.deepEqual(checked.payload.followup_question.options, ['Women', 'Girls']);
assert.ok(checked.corrections.includes('multiple_gender_values_reduced'));

console.log(`sales recipient-routing fix tests passed (${promptCases.length} prompt cases + validator guard)`);
