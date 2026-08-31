'use strict';

const assert = require('node:assert/strict');

const llmPath = require.resolve('../services/llmService');
let responder = async () => ({});
require.cache[llmPath] = {
    id: llmPath, filename: llmPath, loaded: true,
    exports: { callLLM: (...args) => responder(...args) }
};
delete require.cache[require.resolve('../services/chatPipeline')];
const { runPipeline } = require('../services/chatPipeline');

const emptyDecision = () => ({
    status: 'resolved', team: '', order: { order_no: '', sub_id: '' },
    card: { image_url: '', product_name: '', designer_name: '', order_no: '', sub_id: '', tracking_link: '' },
    fs: { needed: false, ticket_id: '', reason: '', msg: '' }
});

(async () => {
    responder = async () => ({
        decision: emptyDecision(),
        customer_reply: 'Guest checkout is available. Registering helps you view orders and manage returns.',
        followup_question: { ask: false, question: '', options: [] }
    });
    let result = await runPipeline('Can I checkout as a guest?', 'guest', { chat_id: 'G1', country: 'India' });
    assert.equal(result.bot_type, 'general_info');
    assert.equal(result.metadata.sub_bucket, 'policy_query');
    assert.equal(result.metadata.validated, true);

    const order = {
        customer_order_no: 'QA-GUEST-1001', sub_order_id: 'QA-SUB-1001', status: 'Processing',
        expected_delivery_date: '2099-12-31', tracking_link: '', product_title: 'QA Test Saree',
        products: [{ name: 'QA Test Saree', image_url: 'https://static.test/qa-saree.jpg' }]
    };
    responder = async () => ({
        decision: {
            ...emptyDecision(),
            order: { order_no: 'QA-GUEST-1001', sub_id: 'QA-SUB-1001' },
            card: { image_url: 'https://static.test/qa-saree.jpg', product_name: 'QA Test Saree', designer_name: '', order_no: 'QA-GUEST-1001', sub_id: 'QA-SUB-1001', tracking_link: '' }
        },
        customer_reply: 'Your order is processing and is expected to be delivered by 31 December 2099.',
        followup_question: { ask: false, question: '', options: [] }
    });
    result = await runPipeline('Where is my order?', 'guest', {
        chat_id: 'G2', country: 'India', active_orders: [order], account_context: { guest: true, verified: true }
    });
    assert.equal(result.metadata.validated, true);
    assert.equal(result.metadata.order_card.order_no, 'QA-GUEST-1001');

    result = await runPipeline('Where is my order?', 'guest', {
        chat_id: 'G3', country: 'India', active_orders: [order], account_context: { guest: true, verified: false }
    });
    assert.equal(result.metadata.validated, false);
    assert.match(result.reply, /verify.*registered email or mobile/i);
    assert.equal(result.metadata.order_card.order_no, '');

    responder = async () => ({
        decision: emptyDecision(),
        customer_reply: 'Your ₹5,000 refund has been processed to your card.',
        followup_question: { ask: false, question: '', options: [] }
    });
    result = await runPipeline('Where is my refund?', 'qa-user', { chat_id: 'R1', country: 'India', active_orders: [] });
    assert.equal(result.metadata.validated, false);
    assert.doesNotMatch(result.reply, /processed to your card/i);

    console.log('support pipeline integration tests passed (guest FAQ + verified/unverified order + unsafe refund fallback)');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

