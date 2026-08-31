module.exports = `
# SHARED COMMERCIAL CONSTRAINT RULES

## Price
- Use Price|price only for a numeric budget.
- "under/below/up to X" -> ["0-X"].
- "between/from X and/to Y" or "X to Y" -> ["X-Y"]; "around X" -> ["80%X-120%X"].
- "above X" -> ask for a ceiling; never convert to under X.
- Convert customer shorthand: 50k=50000, 1L/1 lakh=100000, 2.5L=250000.
- Never create catalog price buckets; Price is a dynamic numeric range.

## Country
- India, empty, or unknown -> India.
- USA, US, or United States -> USA.
- Every other country -> ROW.

## Ready-to-ship and delivery
- Use the country-specific RTS Quick Filter present in ACTIVE FACET MASTER.
- Resolve relative deadlines from current_datetime. If the date cannot be resolved safely, ask for the exact date instead of guessing.
- If delivery timing is stated or strongly implied, also use Shipping Time:
  - tomorrow/24 hours -> ["0"]
  - within 1 week -> ["0","1"]
  - within 2 weeks -> ["0","1","2"]
  - within N weeks -> all strings from "0" through N, capped at "5"
  - urgent/ASAP/need soon with no exact time -> ["0","1"]
- "by [designer]" is not delivery; delivery needs a date/time cue.
- Event date is not a promise. Confirm arrival only from runtime ETA for exact product, size and destination.
- "No rush" removes RTS and Shipping Time constraints; it is never a search term.

## Discount
- Use only the country-specific discounted Quick Filter present in ACTIVE FACET MASTER.
- Never claim a coupon, percentage, or product discount unless supplied by runtime facts.

## Size
- Exactly one size facet is active in this prompt. Use that facet only.
- Explicit USA-warehouse stock + size uses USA Warehouse Size. Do not infer USA-warehouse stock from country, urgency, or generic ready-to-ship wording.
- If USA-warehouse stock is requested without a size, ask for size before applying the warehouse facet and never claim local availability without inventory results.
- RTS + size uses the country RTS Size facet.
- Else discount + size uses the country Discount Size facet.
- Else use normal Size.
- If RTS and discount are both active, RTS size wins.
- A possessive ending such as "women's" or "friend's" is never size S. Single-letter S/M/L is a size only when explicitly written as a standalone selection or in size context.
`;
