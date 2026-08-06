const assert = require('node:assert/strict');
const { analyzeRouteByRules } = require('../services/routingService');
const { getSalesPrompt } = require('../prompts/salesPrompt');

const scenarios = [
    { query: 'Lehengas', bucket: 'product_search', family: 'lehenga' },
    { query: 'Show wedding lehengas under 50k ready to ship', bucket: 'product_search', family: 'lehenga', facets: ['quickFilters_uFilter', 'estimatedDeliveryWeek_uFilter'] },
    { query: 'Suggest something light for a summer wedding', bucket: 'recommendation_styling' },
    { query: 'Show Anita Dongre sarees', bucket: 'product_search', family: 'saree', facets: ['designerName_uFilter'] },
    { query: 'Need a black gown in M ready to ship', bucket: 'pre_purchase_delivery', family: 'gown', facets: ['rtsSize_uFilter', 'quickFilters_uFilter'] },
    { query: 'Is this available in size M?', bucket: 'availability', facets: ['size_uFilter'] },
    { query: 'Which size will fit this?', bucket: 'size_fit_help', facets: ['size_uFilter'] },
    { query: 'Do you have anything under 50000?', bucket: 'pricing_offer' },
    { query: 'Show sale kurtas in XL', bucket: 'product_search', family: 'kurta', facets: ['discountSize_uFilter', 'quickFilters_uFilter'] }
];

for (const scenario of scenarios) {
    const route = analyzeRouteByRules(scenario.query, {});
    assert.equal(route.primary_bucket, 'sales', scenario.query);
    assert.equal(route.sub_bucket, scenario.bucket, scenario.query);
    assert.equal(route.needs_llm_check, false, scenario.query);

    const composed = getSalesPrompt({ subBucket: route.sub_bucket, query: scenario.query, country: 'India' });
    assert.ok(composed.prompt.length < 18000, scenario.query);
    if (scenario.family) assert.ok(composed.diagnostics.family_banks.includes(scenario.family), scenario.query);
    for (const facet of scenario.facets || []) {
        assert.ok(composed.diagnostics.active_facets.includes(facet), `${scenario.query}: ${facet}`);
    }
}

console.log(`sales scenario matrix passed (${scenarios.length} scenarios)`);

