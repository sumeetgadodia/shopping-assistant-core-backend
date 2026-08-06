const assert = require('node:assert/strict');
const { getSalesPrompt, matchedValues } = require('../prompts/salesPrompt');

const legacyPromptChars = 52780;

let composed = getSalesPrompt({
    subBucket: 'product_search',
    query: 'Show me wedding lehengas under 50k',
    country: 'India'
});
assert.match(composed.prompt, /PRIMARY SALES INTENT: PRODUCT SEARCH/);
assert.match(composed.prompt, /Selected product-family banks:\n- Lehenga:/);
assert.ok(composed.prompt.length < 18000);
assert.ok(composed.prompt.length < legacyPromptChars * 0.4);
assert.ok(composed.modules.includes('sales/knowledge/lehenga'));
assert.ok(!composed.diagnostics.active_facets.includes('designerName_uFilter'));

composed = getSalesPrompt({
    subBucket: 'product_search',
    query: 'Show Anita Dongre sarees',
    country: 'USA'
});
assert.ok(composed.diagnostics.active_facets.includes('designerName_uFilter'));
assert.match(composed.prompt, /Designers\|designerName_uFilter:\n\[Anita Dongre\]/);
assert.doesNotMatch(composed.prompt, /Tarun Tahiliani/);
assert.ok(composed.modules.includes('sales/knowledge/saree'));

composed = getSalesPrompt({
    subBucket: 'pre_purchase_delivery',
    query: 'Need a black gown in M ready to ship within 1 week',
    country: 'United States'
});
assert.ok(composed.diagnostics.active_facets.includes('rtsSizeUsa_uFilter'));
assert.ok(composed.diagnostics.active_facets.includes('quickFilters_uFilter'));
assert.ok(composed.diagnostics.active_facets.includes('estimatedDeliveryWeek_uFilter'));
assert.ok(!composed.diagnostics.active_facets.includes('size_uFilter'));
assert.match(composed.prompt, /\[rtsUsa\]/);

composed = getSalesPrompt({
    subBucket: 'product_search',
    query: 'Show sale kurtas in XL',
    country: 'UAE'
});
assert.ok(composed.diagnostics.active_facets.includes('discountSizeRow_uFilter'));
assert.match(composed.prompt, /\[discountedProductRow\]/);

composed = getSalesPrompt({
    subBucket: 'product_search',
    query: 'Show an organza saree with mirror work and a sweetheart neck',
    country: 'India'
});
assert.deepEqual(matchedValues('baseFabricMaterial_uFilter', 'organza saree'), ['Organza']);
assert.deepEqual(matchedValues('attrTypeOfWork_uFilter', 'mirror work lehenga'), ['Mirror Work']);
assert.deepEqual(matchedValues('attrNeckline_uFilter', 'sweetheart neck blouse'), ['Sweetheart Neck']);
assert.ok(composed.diagnostics.active_facets.includes('baseFabricMaterial_uFilter'));
assert.ok(composed.diagnostics.active_facets.includes('attrTypeOfWork_uFilter'));
assert.ok(composed.diagnostics.active_facets.includes('attrNeckline_uFilter'));

composed = getSalesPrompt({
    subBucket: 'product_search',
    query: 'Lehengas',
    country: 'India',
    salesState: {
        confirmed_filters: [{ filter_name: 'Gender', facet_name: 'audience_uFilter', values: ['Women'] }],
        last_followup: { question: 'Which style should I show first?' }
    }
});
assert.match(composed.prompt, /sales_state: structured confirmed filters/);
assert.ok(composed.modules.includes('sales/knowledge/lehenga'));

composed = getSalesPrompt({
    subBucket: 'product_search',
    query: 'Corset lehenga',
    country: 'USA',
    salesState: {
        confirmed_filters: [
            { filter_name: 'Size', facet_name: 'size_uFilter', values: ['M'] },
            { filter_name: 'Quick Filters', facet_name: 'quickFilters_uFilter', values: ['rtsUsa'] },
            { filter_name: 'Shipping Time', facet_name: 'estimatedDeliveryWeek_uFilter', values: ['0', '1'] }
        ]
    }
});
assert.ok(composed.diagnostics.active_facets.includes('rtsSizeUsa_uFilter'));
assert.ok(!composed.diagnostics.active_facets.includes('size_uFilter'));
assert.match(composed.prompt, /RTS Size USA\|rtsSizeUsa_uFilter:\n\[M\]/);

composed = getSalesPrompt({
    subBucket: 'product_search',
    query: 'Sarees',
    chatThread: [{ from: 'assistant', message: 'Would you like Anita Dongre or Tarun Tahiliani?' }]
});
assert.ok(!composed.diagnostics.active_facets.includes('designerName_uFilter'));

composed = getSalesPrompt({
    subBucket: 'product_search',
    query: 'No rush',
    country: 'India',
    salesState: {
        confirmed_filters: [
            { filter_name: 'Size', facet_name: 'rtsSize_uFilter', values: ['M'] },
            { filter_name: 'Quick Filters', facet_name: 'quickFilters_uFilter', values: ['rts'] },
            { filter_name: 'Shipping Time', facet_name: 'estimatedDeliveryWeek_uFilter', values: ['0', '1'] }
        ]
    }
});
assert.ok(!composed.diagnostics.active_facets.includes('quickFilters_uFilter'));
assert.ok(!composed.diagnostics.active_facets.includes('estimatedDeliveryWeek_uFilter'));
assert.ok(composed.diagnostics.active_facets.includes('size_uFilter'));

console.log('sales prompt composition tests passed');
