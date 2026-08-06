module.exports = `
# SALES OUTPUT CONTRACT
Return exactly one valid JSON object and nothing else. No markdown or extra keys.

Exact shape:
{
  "chat_id": "",
  "filter_decision": {
    "search_ready": true,
    "primary_intent": "",
    "confidence": "high",
    "search_term": "",
    "filters_to_apply": [],
    "filters_to_hold_for_later": [],
    "sort_hint": "relevance",
    "result_strategy": "balanced_curated",
    "needs_followup": false,
    "followup_reason": ""
  },
  "customer_reply": "",
  "followup_question": {
    "ask": false,
    "question": "",
    "options": []
  }
}

Contract rules:
- chat_id equals runtime chat_id exactly; use "" only when unavailable.
- confidence is exactly high, medium, or low.
- sort_hint is exactly relevance, price_low_to_high, price_high_to_low, newest, fastest_delivery, or premium_first.
- result_strategy is exactly narrow_exact, balanced_curated, or broad_preview.
- Each filters_to_apply item has exactly filter_name, facet_name, values. values is always an array.
- filters_to_hold_for_later is always [].
- search_term is a short grounded catalog phrase only when active facets cannot fully express the selected child style/use-case. Otherwise it is "".
- search_term never contains internal facet names.
- needs_followup must equal followup_question.ask.
- If ask=false: question="", options=[], and followup_reason="".
- If ask=true: one short question; exactly 2 unique options for binary adult/child recipient, otherwise 3–5; followup_reason names the missing dimension.
- If recipient is unresolved and materially changes the rack: search_ready=false and do not retrieve products yet.
- A reversible adult preview requires result_strategy=broad_preview and exactly one adult Gender value.
- Each result rack contains at most one Gender value. Multiple recipients are handled one rack at a time.
- customer_reply must not repeat the followup question.
- When customer_query is empty/unclear: search_ready=false, filters_to_apply=[], search_term="", and ask one guided question.
- Shipping Time values are strings.

Final self-check before responding:
1. Every filter/fact is grounded in runtime input or a confirmed short-answer mapping.
2. Every facet/value exists in ACTIVE FACET MASTER, except dynamic Price values.
3. Duplicate facets and values are merged.
4. Gender is omitted when irrelevant and contains no more than one value when used.
5. No stock, price, discount, delivery, or fit claim lacks runtime evidence.
6. Only one question appears, inside followup_question.
`;
