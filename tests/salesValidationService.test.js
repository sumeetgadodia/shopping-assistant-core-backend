const assert = require('node:assert/strict');
const { validateSalesPayload, validPriceRange } = require('../services/salesValidationService');

assert.equal(validPriceRange('0-50000'), true);
assert.equal(validPriceRange('50000-10000'), false);
assert.equal(validPriceRange('under-50000'), false);

const raw = {
    chat_id: 'model-invented-id',
    filter_decision: {
        search_ready: true,
        primary_intent: 'Wedding lehengas',
        confidence: 'HIGH',
        search_term: '',
        filters_to_apply: [
            { filter_name: 'Wrong Name', facet_name: 'level2CategoryName_uFilter', values: ['Lehengas', 'Not A Category'] },
            { filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Sarees', 'Lehengas'] },
            { filter_name: 'Price', facet_name: 'price', values: ['0-50000', '50000-10000'] },
            { filter_name: 'Designer', facet_name: 'designerName_uFilter', values: ['Imaginary Designer'] }
        ],
        filters_to_hold_for_later: [
            { filter_name: 'Color', facet_name: 'baseColor_uFilter', values: ['Black'] }
        ],
        sort_hint: 'best',
        result_strategy: 'curated',
        needs_followup: false,
        followup_reason: 'style'
    },
    customer_reply: 'I’ll curate wedding lehengas under ₹50k. Which style should I show first?',
    followup_question: {
        ask: true,
        question: 'Which style should I show first?',
        options: ['Bridal lehenga', 'Fish cut lehenga', 'Mirror work lehenga', 'Corset lehenga', 'Pastel lehenga', 'No preference']
    }
};

const checked = validateSalesPayload(raw, {
    chatId: 'runtime-chat-id',
    activeFacetNames: ['level2CategoryName_uFilter', 'baseColor_uFilter', 'price']
});

assert.equal(checked.isValid, true);
assert.equal(checked.payload.chat_id, 'runtime-chat-id');
assert.equal(checked.payload.filter_decision.confidence, 'medium');
assert.equal(checked.payload.filter_decision.sort_hint, 'relevance');
assert.equal(checked.payload.filter_decision.result_strategy, 'balanced_curated');
assert.equal(checked.payload.filter_decision.needs_followup, true);
assert.equal(checked.payload.filter_decision.followup_reason, 'style');
assert.equal(checked.payload.followup_question.options.length, 5);
assert.equal(checked.payload.customer_reply, 'I’ll curate wedding lehengas under ₹50k.');
assert.deepEqual(checked.payload.filter_decision.filters_to_hold_for_later, []);
assert.deepEqual(checked.payload.filter_decision.filters_to_apply, [
    { filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Lehengas', 'Sarees'] },
    { filter_name: 'Price', facet_name: 'price', values: ['0-50000'] },
    { filter_name: 'Color', facet_name: 'baseColor_uFilter', values: ['Black'] }
]);
assert.ok(checked.errors.includes('unknown_filter_value_removed'));
assert.ok(checked.errors.includes('inactive_facet_removed'));
assert.ok(checked.errors.includes('duplicate_followup_removed_from_reply'));

const invalid = validateSalesPayload(null, { chatId: 'x' });
assert.equal(invalid.isValid, false);
assert.equal(invalid.payload, null);

console.log('sales validation tests passed');

