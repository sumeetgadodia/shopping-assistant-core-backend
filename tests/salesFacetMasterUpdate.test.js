'use strict';

const assert = require('node:assert/strict');
const catalog = require('../prompts/sales/catalogMaster');
const { getSalesPrompt, matchedValues } = require('../prompts/salesPrompt');

assert.equal(Object.keys(catalog).length, 26);
assert.equal(Object.values(catalog).reduce((total, facet) => total + facet.values.length, 0), 1834);

for (const [facetName, facet] of Object.entries(catalog)) {
    assert.ok(!/[\u0600-\u06FF]/.test(facetName), `${facetName}: Arabic facet name`);
    assert.ok(!/[\u0600-\u06FF]/.test(facet.filter_name), `${facetName}: Arabic filter name`);
    assert.equal(new Set(facet.values).size, facet.values.length, `${facetName}: duplicate exact values`);
    facet.values.forEach((value) => {
        assert.ok(!/[\u0600-\u06FF]/.test(value), `${facetName}: Arabic value ${value}`);
    });
}

const requiredLatestValues = {
    level2CategoryName_uFilter: ['Hair Accessories', 'Button Sets', 'Kaleeras'],
    level3CategoryNames_uFilter: ['Midi Dresses', 'Classic Sarees', 'Jhumka Earrings'],
    designerName_uFilter: ['ROHIT DOSHI', 'Soup By Sougat Paul', 'Anushree Reddy'],
    attrPattern_uFilter: ['Geometric', 'Animal Print', 'ornamental'],
    attrTypeOfWork_uFilter: ['Cutdana', 'Floral Motifs', 'aari'],
    baseColor_uFilter: ['Mint', 'Lavender', 'Mustard', 'Tan'],
    shopByOccassion_uFilter: ['Engagement Party', 'After Party', 'Groomsmen', 'Evening'],
    baseFabricMaterial_uFilter: ['Raw Silk', 'Tissue', 'Vegan Leather', 'Cotton Jacquard'],
    attrLengthSleeve_uFilter: ['Cape Sleeve'],
    attrNeckline_uFilter: ['V Neck', 'Jacket: Open', 'Asymmetric Neck']
};

for (const [facetName, values] of Object.entries(requiredLatestValues)) {
    values.forEach((value) => assert.ok(catalog[facetName].values.includes(value), `${facetName}: missing ${value}`));
}

const requiredPriorValues = {
    level3CategoryNames_uFilter: ['Midi Dress', 'Formal Shirts', 'Half & Half Sarees'],
    designerName_uFilter: ['Anita Dongre', 'Leh Studios', 'Bunka'],
    attrTypeOfWork_uFilter: ['Thread Embroidery', 'Digital Print', 'Chikankari'],
    baseFabricMaterial_uFilter: ['Silk Organza', 'Cotton Chanderi', 'Metal Alloy'],
    attrNeckline_uFilter: ['Point Collar', 'Deep Neck', 'Standard Collar'],
    waistRise_uFilter: ['Regular Waist', 'High Waist'],
    fit_uFilter: ['Regular Fit', 'Tailored Fit']
};

for (const [facetName, values] of Object.entries(requiredPriorValues)) {
    values.forEach((value) => assert.ok(catalog[facetName].values.includes(value), `${facetName}: lost prior ${value}`));
}

[
    'audienceTxtAr_uFilter', 'categoryPath2TxtAr_uFilter', 'designerNameTxtAr_uFilter',
    'category_uFilter', 'categoryPath2_uFilter', 'categoryPath3_uFilter', 'color_uFilter',
    'estimatedShippingTime_uFilter', 'priceBucket_uFilter', 'mainCategoryToken_uFilter',
    'subCategoryToken_uFilter', 'categoryToken_uFilter', 'sellingPrice', 'sellingPriceUsa',
    'sellingPriceRow'
].forEach((facetName) => assert.equal(catalog[facetName], undefined, `${facetName}: duplicate/internal facet included`));

assert.equal(catalog.price.dynamic_numeric_range, true);
assert.deepEqual(catalog.price.values, []);
assert.deepEqual(matchedValues('designerName_uFilter', 'Show Rohit Doshi'), ['ROHIT DOSHI']);
assert.deepEqual(matchedValues('designerName_uFilter', 'Show Anita Dongre'), ['Anita Dongre']);

let composed = getSalesPrompt({
    subBucket: 'availability',
    query: 'Show size M available in the USA warehouse',
    country: 'USA'
});
assert.equal(composed.diagnostics.size_mode, 'usa_warehouse');
assert.ok(composed.diagnostics.active_facets.includes('warehouseSizeUsa_uFilter'));
assert.ok(!composed.diagnostics.active_facets.includes('rtsSizeUsa_uFilter'));
assert.match(composed.prompt, /USA Warehouse Size\|warehouseSizeUsa_uFilter/);

composed = getSalesPrompt({
    subBucket: 'availability',
    query: 'Show size M ready to ship',
    country: 'USA'
});
assert.equal(composed.diagnostics.size_mode, 'rts');
assert.ok(composed.diagnostics.active_facets.includes('rtsSizeUsa_uFilter'));
assert.ok(!composed.diagnostics.active_facets.includes('warehouseSizeUsa_uFilter'));

console.log('sales facet-master update tests passed (26 facets / 1,834 exact English values)');
