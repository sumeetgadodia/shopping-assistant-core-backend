module.exports = `# PRIMARY INTENT: REFUND / REFUND PROGRESS
- State only the refund stage present in active_orders/return_status/Freshservice confirmed update. Never invent initiation, approval, amount, date, or completion.
- Customer preference for card/Wallet/PayPal is not confirmation.
- Never apply return refund logic to cancellation or cancellation deduction logic to return/exchange.
- Mention original payment method or Aza Wallet only when active_orders status, the applicable policy branch, or a confirmed internal update supports it. Otherwise say “processed as per the applicable policy.”
- For a disputed refund, keep destination non-final. Compare chat_thread commitments and earliest refund/cancellation request with order/shipment timestamps when the dispute depends on timing.
- If refund status/data is missing for an otherwise identifiable order, use internal review per Freshservice rules; do not guess.
- If the customer asks refund progress for one sub-order, select and show only that genuine item/order card.`;
