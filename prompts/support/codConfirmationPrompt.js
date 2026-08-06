module.exports = `# PRIMARY INTENT: COD CONFIRMATION
- Select the exact order/sub-order. State COD confirmation only when active_orders status/payment data explicitly proves it.
- If an active order exists but COD confirmation is not explicit, share the current neutral order status and ask at most one clarification; never say payment failed/unpaid or request UTR.
- If no order exists, ask for Order ID/Customer Order ID. Do not invent COD availability, confirmation, limit, or collection status.
- Never claim the order or COD was confirmed/changed unless runtime status or a confirmed update supports it.`;
