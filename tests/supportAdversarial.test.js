'use strict';

const assert = require('node:assert/strict');
const { analyzeRouteByRules } = require('../services/routingService');
const { getSupportPrompt } = require('../prompts/supportPrompt');
const { validateSupportPayload } = require('../services/validationService');

const routeCases = [
    ['Track my guest order', 'support', 'order_status_tracking'],
    ['I checked out as a guest. Where is my order?', 'support', 'order_status_tracking'],
    ['I do not have my order ID but need to track my order', 'support', 'order_status_tracking'],
    ['How do I return an order placed as a guest?', 'support', 'return_exchange'],
    ['I ordered as a guest and cannot see my order history', 'account_access', 'wishlist_order_history'],
    ['Can I checkout as a guest?', 'general_info', 'policy_query'],
    ['What is your cancellation policy?', 'support', 'cancellation'],
    ['Can I cancel within 24 hours?', 'support', 'cancellation'],
    ['Can I cancel after 72 hours?', 'support', 'cancellation'],
    ['What happens if I reject delivery?', 'support', 'cancellation'],
    ['Can I cancel my EMI order?', 'support', 'cancellation'],
    ['What is the return window for India?', 'support', 'return_exchange'],
    ['What is the return window for international orders?', 'support', 'return_exchange'],
    ['Can I return jewellery?', 'support', 'return_exchange'],
    ['Can I return a customised lehenga?', 'support', 'return_exchange'],
    ['What are the return handling charges?', 'support', 'return_exchange'],
    ['How long does reverse pickup take?', 'support', 'return_exchange'],
    ['Where will my refund be credited?', 'support', 'refund'],
    ['My return passed QC but refund is missing', 'support', 'refund'],
    ['The product is damaged and I want an exchange', 'support', 'product_issue'],
    ['A blouse piece is missing from my order', 'support', 'wrong_missing_item'],
    ['I received the wrong size', 'support', 'product_issue'],
    ['My package says delivered but I did not receive it', 'support', 'delivery_delay'],
    ['Courier asked me for KYC', 'support', 'shipping_courier_issue'],
    ['Can you change my address after dispatch?', 'support', 'order_modification'],
    ['Please change the size in my order', 'support', 'order_modification'],
    ['Was my order placed successfully?', 'support', 'order_status_tracking'],
    ['How do I track with an AWB?', 'support', 'order_status_tracking'],
    ['I paid but no order was created', 'support', 'payment_issue'],
    ['My card was charged twice', 'support', 'payment_issue'],
    ['Which payment methods do you accept?', 'general_info', 'shipping_payment_info'],
    ['Is COD available?', 'general_info', 'shipping_payment_info'],
    ['Do you ship outside India?', 'general_info', 'shipping_payment_info'],
    ['How much does international shipping cost?', 'general_info', 'shipping_payment_info'],
    ['Will I pay customs duty?', 'general_info', 'shipping_payment_info'],
    ['Are items insured during shipping?', 'general_info', 'shipping_payment_info'],
    ['How long do garments take to ship?', 'general_info', 'shipping_payment_info'],
    ['Do I need an appointment to visit an Aza store?', 'general_info', 'store_visit_appointment'],
    ['What are the Bandra store timings?', 'general_info', 'store_contact_info'],
    ['Where is your nearest store?', 'general_info', 'store_contact_info'],
    ['Are Aza products authentic?', 'general_info', 'brand_designer_info'],
    ['Does Aza offer alterations?', 'general_info', 'policy_query'],
    ['Can you help me delete my personal data?', 'general_info', 'policy_query'],
    ['How can I opt out of marketing?', 'general_info', 'policy_query'],
    ['How long do you retain my data?', 'general_info', 'policy_query'],
    ['How do I update my profile?', 'account_access', 'profile_account'],
    ['I am not receiving the OTP', 'account_access', 'login_otp'],
    ['I forgot my password', 'account_access', 'login_otp'],
    ['I cannot access my wishlist', 'account_access', 'wishlist_order_history'],
    ['I want a human to check my refund', 'support', 'refund'],
    ['Cancel my delayed order and connect me to an agent', 'support', 'cancellation'],
    ['My item is damaged, what is the return policy?', 'support', 'product_issue'],
    ['The return was picked up but where is my money?', 'support', 'refund'],
    ['I want to return it', 'support', 'return_exchange'],
    ['Send me your privacy policy', 'general_info', 'policy_query'],
    ['I want to unsubscribe from emails', 'general_info', 'policy_query'],
    ['Do you guarantee website colours match exactly?', 'general_info', 'policy_query'],
    ['Can I order a sold out item?', 'sales', 'availability'],
    ['Any update?', 'support', 'order_status_tracking'],
    ['Yes', 'unclear', 'unclear']
];

for (const [query, bucket, subBucket] of routeCases) {
    const result = analyzeRouteByRules(query, { has_active_orders: true });
    assert.equal(result.primary_bucket, bucket, query);
    assert.equal(result.sub_bucket, subBucket, query);
}

const basePayload = (reply, overrides = {}) => ({
    decision: {
        status: 'resolved', team: '', order: { order_no: '', sub_id: '' },
        card: { image_url: '', product_name: '', designer_name: '', order_no: '', sub_id: '', tracking_link: '' },
        fs: { needed: false, ticket_id: '', reason: '', msg: '' },
        ...(overrides.decision || {})
    },
    customer_reply: reply,
    followup_question: overrides.followup_question || { ask: false, question: '', options: [] }
});
const check = (subBucket, payload, runtime = {}) => validateSupportPayload(payload, {
    chatId: 'support-adversarial', subBucket, activeOrders: [], freshservice: {}, ...runtime
});

for (const [name, subBucket, reply, error] of [
    ['refund', 'refund', 'Your ₹5,000 refund has been processed to your card.', 'unsupported_refund_claim'],
    ['refund ETA', 'refund', 'Your refund will reach you within 7 working days.', 'unsupported_refund_claim'],
    ['return', 'return_exchange', 'Your return has been approved and pickup is scheduled.', 'unsupported_return_claim'],
    ['delivery', 'order_status_tracking', 'Your order will arrive tomorrow.', 'unsupported_delivery_claim'],
    ['modification', 'order_modification', 'Your delivery address has been updated.', 'unsupported_modification_claim'],
    ['payment', 'payment_issue', 'Your payment is confirmed and the order is placed.', 'unsupported_payment_claim'],
    ['cancellation', 'cancellation', 'We accepted your cancellation and will issue the refund.', 'unconfirmed_cancellation_outcome']
]) {
    const result = check(subBucket, basePayload(reply));
    assert.equal(result.isValid, false, name);
    assert.ok(result.errors.includes(error), name);
}

let result = check('order_status_tracking', basePayload('Your order is processing.', {
    decision: { order: { order_no: 'FAKE1', sub_id: '999' }, card: { image_url: '', product_name: '', designer_name: '', order_no: 'FAKE1', sub_id: '999', tracking_link: 'https://evil.test/track' } }
}));
assert.ok(result.errors.includes('untrusted_order_reference'));

result = check('account_access', basePayload('Please confirm.', { followup_question: { ask: true, question: '', options: [] } }));
assert.ok(result.errors.includes('missing_followup_question'));

result = check('delivery_delay', basePayload('I created ticket FS999 for your case.'));
assert.ok(result.errors.includes('internal_ticket_wording'));

const verifiedOrder = {
    customer_order_no: 'QA-ORDER-1001', sub_order_id: 1365591, tracking_link: 'https://track.test/QA-ORDER-1001',
    product_title: 'Test Saree', products: [{ name: 'Test Saree', image_url: 'https://static.test/saree.jpg' }]
};
result = check('order_status_tracking', basePayload('Your order is processing.', {
    decision: {
        order: { order_no: 'QA-ORDER-1001', sub_id: 1365591 },
        card: { image_url: 'https://static.test/saree.jpg', product_name: 'Test Saree', designer_name: '', order_no: 'QA-ORDER-1001', sub_id: 1365591, tracking_link: 'https://track.test/QA-ORDER-1001' }
    }
}), { activeOrders: [verifiedOrder], isGuest: false });
assert.equal(result.isValid, true);
assert.equal(result.payload.decision.order.sub_id, '1365591');

result = check('order_status_tracking', basePayload('Your order is processing.', {
    decision: { order: { order_no: 'QA-ORDER-1001', sub_id: '1365591' }, card: { image_url: '', product_name: '', designer_name: '', order_no: 'QA-ORDER-1001', sub_id: '1365591', tracking_link: '' } }
}), { activeOrders: [verifiedOrder], isGuest: true, accountVerified: false });
assert.ok(result.errors.includes('unverified_guest_order_disclosure'));

const cancellationPrompt = getSupportPrompt({ subBucket: 'cancellation', includeFreshservice: true });
assert.match(cancellationPrompt, /5% deduction/);
assert.match(cancellationPrompt, /Aza Wallet has no deduction/);
const returnPrompt = getSupportPrompt({ subBucket: 'return_exchange', includeFreshservice: true });
assert.match(returnPrompt, /same email\/mobile used for the order/);
assert.match(returnPrompt, /normal returns never require damage images/i);
const infoPrompt = getSupportPrompt({ subBucket: 'policy_query', includeFreshservice: false });
assert.match(infoPrompt, /azafashions\.com\/store-locator/);
assert.doesNotMatch(infoPrompt, /pages\/store-locator/);
assert.ok(Math.max(cancellationPrompt.length, returnPrompt.length, infoPrompt.length) < 19000);

console.log('support adversarial tests passed (60 routes + 12 guards/policy checks)');
