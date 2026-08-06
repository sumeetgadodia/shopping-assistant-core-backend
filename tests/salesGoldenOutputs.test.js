const assert = require('node:assert/strict');
const { getSalesPrompt } = require('../prompts/salesPrompt');
const { validateSalesPayload } = require('../services/salesValidationService');

const filter = (filter_name, facet_name, values) => ({ filter_name, facet_name, values });

const cases = [
    {
        name: 'rich wedding lehenga search',
        query: 'Show wedding lehengas under 50k ready to ship',
        subBucket: 'product_search',
        country: 'India',
        output: {
            chat_id: 'golden-1',
            filter_decision: {
                search_ready: true,
                primary_intent: 'Ready-to-ship wedding lehengas under ₹50k',
                confidence: 'high',
                search_term: '',
                filters_to_apply: [
                    filter('Gender', 'audience_uFilter', ['Women']),
                    filter('Category', 'level2CategoryName_uFilter', ['Lehengas']),
                    filter('Occasion', 'shopByOccassion_uFilter', ['Wedding']),
                    filter('Price', 'price', ['0-50000']),
                    filter('Quick Filters', 'quickFilters_uFilter', ['rts']),
                    filter('Shipping Time', 'estimatedDeliveryWeek_uFilter', ['0', '1'])
                ],
                filters_to_hold_for_later: [],
                sort_hint: 'fastest_delivery',
                result_strategy: 'balanced_curated',
                needs_followup: true,
                followup_reason: 'recipient'
            },
            customer_reply: 'I’ll start with women’s ready-to-ship wedding lehengas under ₹50k.',
            followup_question: {
                ask: true,
                question: 'Who are you shopping for?',
                options: ['Women', 'Girls']
            }
        }
    },
    {
        name: 'summer is not resort',
        query: 'Suggest something light for a summer wedding',
        subBucket: 'recommendation_styling',
        country: 'India',
        output: {
            chat_id: 'golden-2',
            filter_decision: {
                search_ready: false,
                primary_intent: 'Light summer wedding outfit',
                confidence: 'medium',
                search_term: '',
                filters_to_apply: [filter('Occasion', 'shopByOccassion_uFilter', ['Wedding'])],
                filters_to_hold_for_later: [],
                sort_hint: 'relevance',
                result_strategy: 'broad_preview',
                needs_followup: true,
                followup_reason: 'recipient'
            },
            customer_reply: 'I’ll keep the wedding edit light and comfortable.',
            followup_question: {
                ask: true,
                question: 'Who are you shopping for?',
                options: ['Women', 'Men', 'Girls', 'Boys', 'Couple/family looks']
            }
        }
    },
    {
        name: 'availability without false claim',
        query: 'Is this available in size M?',
        subBucket: 'availability',
        country: 'India',
        output: {
            chat_id: 'golden-3',
            filter_decision: {
                search_ready: false,
                primary_intent: 'Check product availability in size M',
                confidence: 'medium',
                search_term: '',
                filters_to_apply: [filter('Size', 'size_uFilter', ['M'])],
                filters_to_hold_for_later: [],
                sort_hint: 'relevance',
                result_strategy: 'narrow_exact',
                needs_followup: true,
                followup_reason: 'product_reference'
            },
            customer_reply: 'I’ll check size M against the exact product.',
            followup_question: {
                ask: true,
                question: 'How would you like to identify the product?',
                options: ['Share product link', 'Share product name', 'Choose a category']
            }
        }
    },
    {
        name: 'country-specific discount size',
        query: 'Show sale kurtas in XL',
        subBucket: 'product_search',
        country: 'USA',
        output: {
            chat_id: 'golden-4',
            filter_decision: {
                search_ready: false,
                primary_intent: 'Sale kurtas in XL',
                confidence: 'high',
                search_term: '',
                filters_to_apply: [
                    filter('Category', 'level2CategoryName_uFilter', ['Kurtas']),
                    filter('Discount Size USA', 'discountSizeUsa_uFilter', ['XL']),
                    filter('Quick Filters', 'quickFilters_uFilter', ['discountedProductUsa'])
                ],
                filters_to_hold_for_later: [],
                sort_hint: 'price_low_to_high',
                result_strategy: 'broad_preview',
                needs_followup: true,
                followup_reason: 'recipient'
            },
            customer_reply: 'I’ll narrow the sale kurta edit to XL once I know who you’re shopping for.',
            followup_question: {
                ask: true,
                question: 'Who are you shopping for?',
                options: ['Women', 'Men', 'Girls', 'Boys']
            }
        }
    }
];

for (const item of cases) {
    const composed = getSalesPrompt({
        subBucket: item.subBucket,
        query: item.query,
        country: item.country
    });
    const checked = validateSalesPayload(item.output, {
        chatId: item.output.chat_id,
        activeFacetNames: composed.diagnostics.active_facets
    });
    assert.equal(checked.isValid, true, item.name);
    assert.deepEqual(checked.payload.filter_decision.filters_to_apply, item.output.filter_decision.filters_to_apply, item.name);
    assert.equal(checked.payload.filter_decision.search_ready, item.output.filter_decision.search_ready, item.name);
    assert.equal(checked.payload.customer_reply, item.output.customer_reply, item.name);
    assert.deepEqual(checked.payload.followup_question, item.output.followup_question, item.name);
}

console.log(`sales golden outputs passed (${cases.length} cases)`);
