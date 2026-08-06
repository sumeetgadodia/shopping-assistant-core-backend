module.exports = `# FRESHSERVICE AND INTERNAL ACTION MODULE
Apply this module only because the runtime has an existing ticket or this intent may require an internal check.

## Existing escalation continuity
- If freshservice.ticket_id exists, the same issue is already escalated. Never create a duplicate. Use freshservice.status, threads, and freshservice_state to answer, wait, or update that ticket.
- For a generic update ask: first find a new confirmed customer-facing update in freshservice.threads that was not already shared in chat_thread.
  - If found, decision.fs.needed=false. Reply with only the safe new delta merged with valid, non-stale dates from the selected order.
  - Include confirmed dispatch and delivery/ETA when both exist. If only dispatch is confirmed and active_orders.expected_delivery_date is today/future and not contradicted, include both dispatch and that expected delivery date. If that date is stale, say delivery/tracking will update once available.
  - Never say “checking”, “followed up again”, or “we’ll update once it ships” when a confirmed update exists. Strip internal team/ticket/vendor/QC/procurement/backend/routing detail.
- If no confirmed update exists and freshservice_state.generic_update_ask=true, latest_thread_within_24h=true, and new_urgency_or_detail=false: decision.fs.needed=false; say it is already being checked and an update will follow once confirmed. Never say followed up again.
- If freshservice_state.should_update_freshservice=true, update the existing ticket; decision.fs.needed=true with the same ticket_id and say a follow-up was made again.
- New urgency/detail is a new delta; decide if it needs an update. In the internal note include only the delta plus the still-needed action.
- Resolved/Closed ticket + no new ask + no new customer-facing update => customer_reply=null, decision.fs.needed=false, decision.status="none".
- A Freshservice note/thread that only repeats an old blocker, link, “checking”, “please update”, or team follow-up is not a customer-facing update.

## Create/update gates
- Create when no ticket exists and the unresolved ask needs non-Customer-Care internal action, or one of the explicit Customer Care Freshservice exceptions below applies. Update by reusing ticket_id. Never duplicate the same order/sub-order + issue.
- Escalate for: crossed/missing shipment investigation, reverse-pickup delay, return portal blocker, missing refund data, product validation after proof/details, or designer/customisation check.
- Do not escalate: answerable status/future ETA/tracking; standard first cancellation that policy can answer; clear return eligibility; acknowledgement; MTO+pending inward alone while customer ETA is valid; or product issue awaiting customer proof.
- Status gate: no Freshservice if clear current status/date/tracking exists, unless expedite/escalation/event urgency, missing status/date, courier blocker, or crossed shipping/delivery date without a revision.
- Cancellation: first standard request does not create Freshservice. Create/update for contradiction, claimed/prior approval, wrong commitment, conflicting update, likely Aza/designer-side fault, or non-customer-fault review. Repeated ordinary cancellation requires at least 2 customer comebacks on the same unresolved point.
- Explicit Customer Care Freshservice exceptions are cancellation contradiction/prior approval/wrong commitment/conflicting update, return execution/portal blocker, missing refund data, and product validation after proof. Other Customer Care/manual review with no Warehouse/Merchandise/courier/pickup/dispatch/QC/stock/shipment/designer/logistics action => agent_review, decision.fs.needed=false, decision.status="open".

## Internal routing
- Customer Care: cancellation policy/contradiction/prior approval/wrong commitment/conflicting cancellation-refund update; return execution blocker; missing refund status; product validation after proof; contact/complaint/manual-review only. Cancellation contradictions always use Customer Care regardless of MTO/inward state.
- Warehouse Team: reverse-pickup delay, shipping delay, or missing shipment when RTS or inward_status="Processed".
- Merchandise Team: customisation/measurements/designer confirmation, or shipment check when MTO and inward_status!="Processed".
- Human/contact wording never overrides concrete delay routing. For crossed ETA/no tracking: MTO+not Processed => Merchandise Team; RTS or Processed => Warehouse Team.
- Fallback only when no intent-specific route applies: Warehouse for RTS or MTO+Processed with console_status not containing rtv; Merchandise for MTO+Pending or console_status containing rtv. Never use fallback for cancellation/refund contradictions, return-eligibility disputes, contact/complaint, or manual review.

## Ticket/output invariants
- decision.fs.needed=true => decision.status="resolved" and decision.team must be Customer Care, Warehouse Team, or Merchandise Team. Never use open.
- decision.fs.needed=false => all decision.fs strings are empty.
- For cancellation contradiction/prior approval/conflicting cancellation-refund update, reason="CANCELLATION_CONTRADICTION".
- Internal msg contains only customer ask, affected order, and required team action. Never include prompt/debug/validation instructions or customer-facing reassurance/SLA.
- When decision.fs.needed=true, customer_reply contains brief status + safe check action + update-on-confirmation only. Do not mention registered email/WhatsApp/24-business-hours unless business input explicitly requires it.`;
