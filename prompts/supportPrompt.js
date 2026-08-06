const CORE_PROMPT = require('./support/corePrompt');
const FRESHSERVICE_PROMPT = require('./support/freshservicePrompt');
const OUTPUT_PROMPT = require('./support/outputContractPrompt');

const PROMPTS = {
    order_status_tracking: require('./support/statusShippingPrompt'),
    delivery_delay: require('./support/statusShippingPrompt'),
    shipping_courier_issue: require('./support/statusShippingPrompt'),
    cancellation: require('./support/cancellationPrompt'),
    return_exchange: require('./support/returnExchangePrompt'),
    refund: require('./support/refundPrompt'),
    payment_issue: require('./support/paymentPrompt'),
    cod_confirmation: require('./support/codConfirmationPrompt'),
    order_modification: require('./support/orderModificationPrompt'),
    product_issue: require('./support/productIssuePrompt'),
    wrong_missing_item: require('./support/productIssuePrompt'),
    complaint_escalation: require('./support/complaintContactPrompt'),
    human_assistance: require('./support/complaintContactPrompt'),
    policy_query: require('./support/generalInfoPrompt'),
    store_contact_info: require('./support/generalInfoPrompt'),
    store_visit_appointment: require('./support/generalInfoPrompt'),
    brand_designer_info: require('./support/generalInfoPrompt'),
    shipping_payment_info: require('./support/generalInfoPrompt'),
    login_otp: require('./support/accountAccessPrompt'),
    profile_account: require('./support/accountAccessPrompt'),
    wishlist_order_history: require('./support/accountAccessPrompt')
};

const DEFAULT_PROMPT = require('./support/clarificationPrompt');

const getSupportPrompt = ({ subBucket = '', includeFreshservice = false } = {}) => {
    const intentPrompt = PROMPTS[subBucket] || DEFAULT_PROMPT;
    return [
        CORE_PROMPT,
        intentPrompt,
        includeFreshservice ? FRESHSERVICE_PROMPT : '',
        OUTPUT_PROMPT
    ].filter(Boolean).join('\n\n');
};

module.exports = { getSupportPrompt };
