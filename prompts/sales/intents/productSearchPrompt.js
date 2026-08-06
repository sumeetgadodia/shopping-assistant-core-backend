module.exports = `
# PRIMARY SALES INTENT: PRODUCT SEARCH
- Apply the explicit parent or child product rack and all compatible explicit constraints.
- A broad parent query (saree, lehenga, gown, dress, kurta set, co-ord, jewellery, bag, footwear) is search-ready with its parent filter; ask one child-path question.
- "Parent filter only" means do not infer a child path. Keep explicit gender, occasion, budget, color, size, designer, and delivery constraints.
- If a child phrase has an exact facet, use it. Otherwise preserve it in search_term.
- When several compatible products are explicitly requested (for example sarees or lehengas), keep the requested parent categories in one merged Category facet.
- Do not narrow to one requested option unless the customer marks it as preferred.
`;

