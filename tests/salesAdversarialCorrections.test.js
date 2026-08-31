'use strict';

const assert = require('node:assert/strict');
const { analyzeRouteByRules } = require('../services/routingService');
const { getSalesPrompt } = require('../prompts/salesPrompt');
const { validateSalesPayload, validateProductRack } = require('../services/salesValidationService');

const rawPayload = (overrides = {}) => ({
    filter_decision: {
        search_ready: true,
        primary_intent: 'shopping', confidence: 'high', search_term: '',
        filters_to_apply: [], filters_to_hold_for_later: [], sort_hint: 'relevance',
        result_strategy: 'balanced_curated', needs_followup: false, followup_reason: '',
        ...(overrides.filter_decision || {})
    },
    customer_reply: overrides.customer_reply || 'I’ll curate the closest Aza edit for you.',
    followup_question: overrides.followup_question || { ask: false, question: '', options: [] }
});

const compose = (query, runtime = {}) => getSalesPrompt({
    subBucket: runtime.subBucket || 'product_search', query,
    country: runtime.country || 'India', salesState: runtime.salesState || {}, chatThread: []
});

const run = (query, payload = rawPayload(), runtime = {}) => {
    const composed = compose(query, runtime);
    return validateSalesPayload(payload, {
        chatId: 'adversarial', query, subBucket: runtime.subBucket || 'product_search',
        salesState: runtime.salesState || {}, productContext: runtime.productContext || {},
        productResults: runtime.productResults || [], actionResult: runtime.actionResult,
        customerMeasurements: runtime.customerMeasurements,
        activeFacetNames: composed.diagnostics.active_facets,
        activeFacetValues: composed.diagnostics.active_facet_values
    });
};

const facetMap = (checked) => new Map(
    checked.payload.filter_decision.filters_to_apply.map((filter) => [filter.facet_name, filter.values])
);
const route = (query) => analyzeRouteByRules(query, {});

// R01–R06: deterministic conversion routing.
for (const [query, subBucket] of [
    ['Mahima Mahajan', 'product_search'], ['Corset', 'product_search'],
    ['Add the second one to cart', 'purchase_assistance'], ['Is the blue one available?', 'availability'],
    ['Need it before next Friday', 'pre_purchase_delivery'], ['Something by Anita Dongre', 'product_search']
]) {
    assert.equal(route(query).primary_bucket, 'sales', query);
    assert.equal(route(query).sub_bucket, subBucket, query);
    assert.equal(route(query).needs_llm_check, false, query);
}

// R07: category morphology.
let composed = compose('Pre draped saree');
assert.deepEqual(composed.diagnostics.active_facet_values.level2CategoryName_uFilter, ['Sarees']);
assert.deepEqual(composed.diagnostics.active_facet_values.level3CategoryNames_uFilter, ['Pre-Draped Sarees']);

// R08–R11: negation scope.
composed = compose('No black lehengas, show blue');
assert.deepEqual(composed.diagnostics.active_facet_values.baseColor_uFilter, ['Blue']);
assert.equal(composed.diagnostics.active_facet_values.attrNeckline_uFilter, undefined);
composed = compose('Everything except red');
assert.equal(composed.diagnostics.active_facet_values.baseColor_uFilter, undefined);
composed = compose('Lehenga without sequins');
assert.equal(composed.diagnostics.active_facet_values.attrTypeOfWork_uFilter, undefined);
let checked = run('Not for women, show girls lehengas');
assert.deepEqual(facetMap(checked).get('audience_uFilter'), ['Girls']);

// R12–R14: control/action words cannot become attributes.
for (const query of ['No preference', 'Yes, show me more', 'Open the second one']) {
    composed = compose(query);
    assert.equal(composed.diagnostics.active_facet_values.attrNeckline_uFilter, undefined, query);
}

// R15–R17: one phrase, one contextual facet.
composed = compose('Gold lehenga');
assert.deepEqual(composed.diagnostics.active_facet_values.baseColor_uFilter, ['Gold']);
assert.equal(composed.diagnostics.active_facet_values.baseFabricMaterial_uFilter, undefined);
composed = compose('Zari lehenga');
assert.deepEqual(composed.diagnostics.active_facet_values.attrTypeOfWork_uFilter, ['Zari']);
assert.equal(composed.diagnostics.active_facet_values.baseFabricMaterial_uFilter, undefined);
composed = compose('Mirror work lehenga');
assert.deepEqual(composed.diagnostics.active_facet_values.attrTypeOfWork_uFilter, ['Mirror Work']);
assert.equal(composed.diagnostics.active_facet_values.shopByOccassion_uFilter, undefined);

// R18–R19: designer “by” versus deadline.
composed = compose('Something by Anita Dongre');
assert.ok(composed.diagnostics.active_facets.includes('designerName_uFilter'));
assert.ok(!composed.diagnostics.active_facets.includes('estimatedDeliveryWeek_uFilter'));
assert.equal(route('Need it by Friday').sub_bucket, 'pre_purchase_delivery');

// R20–R24: recipient, kids and multiple-recipient sequencing.
checked = run('Kurta for him');
assert.deepEqual(facetMap(checked).get('audience_uFilter'), ['Men']);
checked = run('Dress for her');
assert.deepEqual(facetMap(checked).get('audience_uFilter'), ['Women']);
checked = run('Kids lehenga');
assert.equal(checked.payload.filter_decision.search_ready, false);
assert.deepEqual(checked.payload.followup_question.options, ['Girls', 'Boys']);
checked = run('Girls lehenga');
assert.match(checked.payload.followup_question.question, /age or size/i);
checked = run('Bride and groom looks', rawPayload(), { subBucket: 'recommendation_styling' });
assert.deepEqual(checked.payload.followup_question.options, ['Bride', 'Groom']);
assert.equal(facetMap(checked).has('audience_uFilter'), false);

// R25–R27: recovered readiness and accessory journey.
checked = run('Saree');
assert.equal(checked.payload.filter_decision.search_ready, true);
assert.deepEqual(facetMap(checked).get('audience_uFilter'), ['Women']);
checked = run('Kurta set');
assert.equal(checked.payload.filter_decision.search_ready, false);
assert.deepEqual(checked.payload.followup_question.options, ['Women', 'Men', 'Girls', 'Boys']);
checked = run('Potli bags');
assert.equal(checked.payload.filter_decision.search_ready, true);
assert.match(checked.payload.followup_question.question, /bag edit/i);

// R28–R32: unsupported commercial/action claims are replaced.
checked = run('Do you have it in M?', rawPayload({ customer_reply: 'Yes, size M is available.' }), { subBucket: 'availability', productResults: [{}] });
assert.doesNotMatch(checked.payload.customer_reply, /yes|is available/i);
assert.ok(checked.errors.includes('unsupported_stock_claim_replaced'));
checked = run('Will it arrive Friday?', rawPayload({ customer_reply: 'Yes, it will arrive by Friday.' }), { subBucket: 'pre_purchase_delivery', productResults: [{}] });
assert.ok(checked.errors.includes('unsupported_delivery_claim_replaced'));
checked = run('Can I get a discount?', rawPayload({ customer_reply: 'I can offer you 20% off.' }), { subBucket: 'pricing_offer', productResults: [{}] });
assert.ok(checked.errors.includes('unsupported_discount_claim_replaced'));
checked = run('Will M fit me?', rawPayload({ customer_reply: 'M will fit you perfectly.' }), { subBucket: 'size_fit_help', productResults: [{}] });
assert.ok(checked.errors.includes('unsupported_fit_claim_replaced'));
checked = run('Add it to bag', rawPayload({ customer_reply: "I've added it to your bag." }), { subBucket: 'purchase_assistance', productResults: [{}] });
assert.ok(checked.errors.includes('unsupported_cart_claim_replaced'));

const baseState = {
    confirmed_filters: [
        { filter_name: 'Gender', facet_name: 'audience_uFilter', values: ['Women'] },
        { filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Lehengas'] },
        { filter_name: 'Color', facet_name: 'baseColor_uFilter', values: ['Blue'] },
        { filter_name: 'Price', facet_name: 'price', values: ['0-80000'] },
        { filter_name: 'Quick Filter', facet_name: 'quickFilters_uFilter', values: ['rts'] },
        { filter_name: 'Shipping Time', facet_name: 'estimatedDeliveryWeek_uFilter', values: ['0', '1'] }
    ],
    answered_dimensions: ['occasion'], last_sub_bucket: 'product_search',
    last_followup: { ask: true, question: 'Which colour?', options: ['Blue', 'Red'], reason: 'color' }
};

// R33–R36: state replacement, clearing and decision progression.
checked = run('Same but red', rawPayload(), { salesState: baseState });
assert.deepEqual(facetMap(checked).get('baseColor_uFilter'), ['Red']);
const budgetState = { ...baseState, last_followup: { ask: true, question: 'Which budget?', options: ['Under 80k', 'No budget limit'], reason: 'budget' } };
checked = run('No budget limit', rawPayload(), { salesState: budgetState });
assert.equal(facetMap(checked).has('price'), false);
assert.equal(facetMap(checked).has('attrNeckline_uFilter'), false);
const deliveryState = { ...baseState, last_followup: { ask: true, question: 'When do you need it?', options: ['Ready to ship', 'No rush'], reason: 'delivery_timeline' } };
checked = run('No rush', rawPayload(), { salesState: deliveryState });
assert.equal(facetMap(checked).has('quickFilters_uFilter'), false);
assert.equal(facetMap(checked).has('estimatedDeliveryWeek_uFilter'), false);
const decisionState = { ...baseState, answered_dimensions: ['occasion', 'look_direction', 'statement_level', 'palette', 'budget'], last_followup: { ask: true, question: 'Would you like to refine the edit or complete the look?', options: ['Refine this edit', 'Compare favourites', 'Complete the look', 'Just show me'], reason: 'decision_step' } };
checked = run('Refine this edit', rawPayload(), { salesState: decisionState });
assert.notEqual(checked.payload.followup_question.question, decisionState.last_followup.question);
assert.match(checked.payload.followup_question.question, /refine first/i);

// R37–R38: price language.
checked = run('Kurta set from 50k to 1 lakh');
assert.deepEqual(facetMap(checked).get('price'), ['50000-100000']);
checked = run('Lehengas not under 50k');
assert.equal(facetMap(checked).has('price'), false);

// R39–R40: rack integrity for audience and target category.
let rack = validateProductRack([
    { id: 'W1', product_gender: 'Women', pc_subcategory_title: 'Lehengas' },
    { id: 'G1', product_gender: 'Girls', pc_subcategory_title: 'Lehengas' }
], [
    { filter_name: 'Gender', facet_name: 'audience_uFilter', values: ['Women'] },
    { filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Lehengas'] }
]);
assert.equal(rack.accepted.length, 1);
assert.deepEqual(rack.rejected[0].reasons, ['audience_mismatch']);
rack = validateProductRack([{ id: 'S1', pc_subcategory_title: 'Sarees' }], [
    { filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Jewellery Sets'] }
]);
assert.deepEqual(rack.rejected[0].reasons, ['category_mismatch']);

console.log('sales adversarial corrections passed (40 regression cases)');
