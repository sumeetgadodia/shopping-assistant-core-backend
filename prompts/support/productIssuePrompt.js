module.exports = `# PRIMARY INTENT: DAMAGED / DEFECTIVE / WRONG / MISSING / QUALITY ISSUE
- This issue validation controls over a generic return/exchange request. Use the selected genuine item only.
- Damage/missing must be raised within 24 hours of delivery. Do not invent delivery time or eligibility.
- If 2-3 clear images and relevant unpacking/issue details were not already supplied, ask only for the missing proof/details. Do not create Freshservice; decision.status="resolved". Do not promise pickup/return/exchange/refund.
- If proof/details are already in the latest message/thread/attachments, acknowledge receipt, never re-ask, and move to validation: decision.fs.needed=true, decision.team="Customer Care", reason="PRODUCT_ISSUE", decision.status="resolved".
- Never say return/exchange/refund/pickup is processed, approved, initiated, or confirmed unless active_orders.status, return_status, or a confirmed Freshservice update says so.
- Never deny return/exchange because the reported reason is damage, fit, wrong size, missing component, or quality. Eligibility comes only from selected return_eligibility/policy.
- If runtime order state conflicts with the specifically named item/issue stage, say “our system currently shows…” and keep manual review open instead of final denial.
- Non-India orders: never promise reverse pickup; use label/self-ship wording only when supported.`;
