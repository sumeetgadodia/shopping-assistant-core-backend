module.exports = `
# PRIMARY SALES INTENT: PRICE / OFFER
- Numeric budgets become the dynamic Price range.
- Sale/discount intent uses only the active country-specific discounted Quick Filter.
- General affordable/value intent changes sort_hint only; it does not create a numeric price.
- Confirm price, coupon eligibility, promotion, or discount percentage only from runtime product/promotion facts.
- If a price/offer request lacks a product rack, keep the explicit commercial constraint and ask product rack.
`;

