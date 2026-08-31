const assert = require('node:assert/strict');
const { getSupportPrompt } = require('../prompts/supportPrompt');
const { validateSupportPayload } = require('../services/validationService');

const statusPrompt = getSupportPrompt({ subBucket: 'order_status_tracking', includeFreshservice: false });
assert.match(statusPrompt, /PRIMARY INTENT: ORDER STATUS/);
assert.doesNotMatch(statusPrompt, /FRESHSERVICE AND INTERNAL ACTION MODULE/);
assert.doesNotMatch(statusPrompt, /CANONICAL CANCELLATION POLICY/i);
assert.ok(statusPrompt.length < 14000);

const cancellationPrompt = getSupportPrompt({ subBucket: 'cancellation', includeFreshservice: true });
assert.match(cancellationPrompt, /PRIMARY INTENT: CANCELLATION/);
assert.match(cancellationPrompt, /FRESHSERVICE AND INTERNAL ACTION MODULE/);
assert.doesNotMatch(cancellationPrompt, /PRIMARY INTENT: RETURN \/ EXCHANGE/);
assert.ok(cancellationPrompt.length < 19000);

const payload = {
    chat_id: 'wrong-id',
    decision: {
        status: 'open',
        team: 'Warehouse Team',
        order: { order_no: 'A1', sub_id: 'S1' },
        card: { image_url: '', product_name: '', designer_name: '', order_no: 'A1', sub_id: 'S1', tracking_link: 'https://track.test/A1' },
        fs: { needed: true, ticket_id: '', reason: 'DELIVERY_DELAY', msg: 'SUMMARY: Delay\nCUSTOMER MESSAGE: Update\nAFFECTED SUBORDER: A1/S1\nACTION REQUIRED: Check shipment' }
    },
    customer_reply: 'Track here https://track.test/A1. I have shared this for review.',
    followup_question: { ask: false, question: 'unused', options: ['unused'] }
};

const checked = validateSupportPayload(payload, {
    chatId: 'runtime-id', subBucket: 'delivery_delay', freshservice: {},
    activeOrders: [{ customer_order_no: 'A1', sub_order_id: 'S1', tracking_link: 'https://track.test/A1', products: [] }]
});
assert.equal(checked.isValid, true);
assert.equal(checked.payload.chat_id, 'runtime-id');
assert.equal(checked.payload.decision.status, 'resolved');
assert.equal(checked.payload.followup_question.question, '');
assert.doesNotMatch(checked.payload.customer_reply, /https:\/\/track\.test/);

console.log('prompt composition tests passed');
