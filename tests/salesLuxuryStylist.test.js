'use strict';

const assert = require('node:assert/strict');
const { getSalesPrompt } = require('../prompts/salesPrompt');
const { validateSalesPayload } = require('../services/salesValidationService');

const firstTurn = getSalesPrompt({
    subBucket: 'recommendation_styling',
    query: 'Show me wedding lehengas',
    country: 'India'
});

assert.match(firstTurn.prompt, /digital luxury stylist/);
assert.match(firstTurn.prompt, /experienced Aza store stylist/);
assert.match(firstTurn.prompt, /search_ready=true and ask=true/);
assert.match(firstTurn.prompt, /no total conversation limit/i);
assert.match(firstTurn.prompt, /Never ask generic features\/preferences/);
assert.ok(firstTurn.diagnostics.refinement_banks.includes('wedding_moment'));
assert.ok(firstTurn.diagnostics.refinement_banks.includes('wedding_role'));
assert.ok(firstTurn.diagnostics.refinement_banks.includes('look_direction'));
assert.ok(firstTurn.diagnostics.prompt_chars < 18000);

const laterTurn = getSalesPrompt({
    subBucket: 'recommendation_styling',
    query: 'Modern glamour',
    country: 'India',
    chatThread: [
        { from: 'customer', message: 'I need a lehenga for a wedding reception' },
        { from: 'assistant', message: 'Which direction feels most like you?' }
    ],
    salesState: {
        confirmed_filters: [
            { filter_name: 'Gender', facet_name: 'audience_uFilter', values: ['Women'] },
            { filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Lehengas'] },
            { filter_name: 'Occasion', facet_name: 'shopByOccassion_uFilter', values: ['Reception'] }
        ],
        answered_dimensions: ['recipient', 'occasion_moment', 'look_direction'],
        last_followup: {
            ask: true,
            question: 'Which direction feels most like you?',
            options: ['Classic Indian', 'Modern glamour', 'Soft romantic'],
            reason: 'look_direction'
        }
    }
});

assert.ok(!laterTurn.diagnostics.refinement_banks.includes('wedding_moment'));
assert.ok(!laterTurn.diagnostics.refinement_banks.includes('look_direction'));
assert.ok(laterTurn.diagnostics.refinement_banks.includes('statement_level'));
assert.ok(laterTurn.diagnostics.refinement_banks.includes('comfort'));
assert.ok(laterTurn.diagnostics.prompt_chars < 18000);

const rackAndQuestion = {
    chat_id: 'model-id',
    filter_decision: {
        search_ready: true,
        primary_intent: 'Women wedding reception lehengas with modern glamour',
        confidence: 'high',
        search_term: 'modern glamour lehenga',
        filters_to_apply: [
            { filter_name: 'Gender', facet_name: 'audience_uFilter', values: ['Women'] },
            { filter_name: 'Category', facet_name: 'level2CategoryName_uFilter', values: ['Lehengas'] },
            { filter_name: 'Occasion', facet_name: 'shopByOccassion_uFilter', values: ['Reception'] }
        ],
        filters_to_hold_for_later: [],
        sort_hint: 'relevance',
        result_strategy: 'balanced_curated',
        needs_followup: true,
        followup_reason: 'statement_level'
    },
    customer_reply: 'I’ll refine the reception lehenga edit toward modern glamour.',
    followup_question: {
        ask: true,
        question: 'How statement-led should the look feel?',
        options: ['Understated elegance', 'Refined statement', 'High glamour', 'No preference']
    }
};

const checked = validateSalesPayload(rackAndQuestion, {
    chatId: 'luxury-stylist-1',
    activeFacetNames: laterTurn.diagnostics.active_facets
});

assert.equal(checked.isValid, true);
assert.equal(checked.payload.filter_decision.search_ready, true);
assert.equal(checked.payload.followup_question.ask, true);
assert.equal(checked.payload.chat_id, 'luxury-stylist-1');

console.log('sales luxury-stylist tests passed (identity + continuous journey + state progression + rack-and-question)');
