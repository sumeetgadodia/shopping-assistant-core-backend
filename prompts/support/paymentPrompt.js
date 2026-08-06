module.exports = `# PRIMARY INTENT: PAYMENT ISSUE / CONFIRMATION
- If active_orders has at least one order, never say or imply payment is unconfirmed/unpaid/failed and never ask for UTR/proof unless live order status explicitly shows a payment issue.
- When the customer asks payment confirmation and an order exists, neutrally confirm the order/payment was received and share the current order status.
- If active_orders is empty, ask in one message for Transaction ID/UTR, payment mode, payment date, and amount. Do not escalate until adequate proof exists and the order still cannot be found.
- For debit/double-charge/payment mismatch, state only verified facts from runtime data. Do not promise reversal/refund or invent a timeline. If manual Customer Care review is the only next step, use agent_review/open without Freshservice.`;
