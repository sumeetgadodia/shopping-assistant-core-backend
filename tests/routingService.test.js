const assert = require('node:assert/strict');
const { analyzeRouteByRules, normalizeRouterResult } = require('../services/routingService');

const route = (query) => analyzeRouteByRules(query, { has_active_orders: true });

let result = route('Hi, connect me to an agent and tell me where is my order');
assert.equal(result.primary_bucket, 'support');
assert.equal(result.sub_bucket, 'order_status_tracking');
assert.equal(result.human_requested, true);

result = route('My shipment is delayed. Cancel it and show similar lehengas.');
assert.equal(result.primary_bucket, 'support');
assert.equal(result.sub_bucket, 'cancellation');
assert.equal(result.needs_llm_check, true);
assert.ok(result.secondary_intents.some((item) => item.sub_bucket === 'delivery_delay'));
assert.ok(result.secondary_intents.some((item) => item.bucket === 'sales'));

result = route('I received the wrong item and want to return it');
assert.equal(result.primary_bucket, 'support');
assert.equal(result.sub_bucket, 'wrong_missing_item');

result = route('The return was picked up but my refund is not received');
assert.equal(result.primary_bucket, 'support');
assert.equal(result.sub_bucket, 'refund');

result = route('My cancellation was approved but the refund is not received');
assert.equal(result.primary_bucket, 'support');
assert.equal(result.sub_bucket, 'refund');

result = route('Change my delivery address and tell me where is my order');
assert.equal(result.primary_bucket, 'support');
assert.equal(result.sub_bucket, 'order_modification');

result = route('Show me lehengas for a wedding');
assert.equal(result.primary_bucket, 'sales');
assert.equal(result.sub_bucket, 'product_search');
assert.equal(result.needs_llm_check, false);

result = route('Can I visit the store without an appointment?');
assert.equal(result.primary_bucket, 'general_info');
assert.equal(result.sub_bucket, 'store_visit_appointment');

result = route('Please confirm my COD order');
assert.equal(result.primary_bucket, 'support');
assert.equal(result.sub_bucket, 'cod_confirmation');

result = route('What is your return policy?');
assert.equal(result.primary_bucket, 'support');
assert.equal(result.sub_bucket, 'return_exchange');

result = route('yes');
assert.equal(result.primary_bucket, 'unclear');
assert.equal(result.needs_llm_check, true);

const normalized = normalizeRouterResult({
    primary_bucket: 'sales',
    sub_bucket: 'product_search',
    secondary_intents: [],
    journey_stage: 'pre_purchase',
    confidence: 0.8
}, route('Cancel my delayed order and show similar options'));
assert.equal(normalized.primary_bucket, 'support');
assert.equal(normalized.sub_bucket, 'cancellation');

console.log('routingService tests passed');
