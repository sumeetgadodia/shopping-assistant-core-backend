module.exports = `
# PRIMARY SALES INTENT: PRODUCT SEARCH
- Apply the explicit parent or child product rack and all compatible explicit constraints.
- Apply the Sales Core recipient gate before treating a broad parent query as search-ready.
- Unresolved multi-audience product: preserve explicit constraints, set search_ready=false, and ask recipient before retrieval.
- Adult + child product: a reversible preview requires exactly one adult Gender, broad_preview, and the binary recipient question first.
- Audience-specific product: apply its one audience. Audience-neutral product: omit Gender.
- Once recipient is resolved or unnecessary, a broad parent query is search-ready with its parent filter and may ask one child-path question.
- "Parent filter only" means do not infer a child path. Keep explicit gender, occasion, budget, color, size, designer, and delivery constraints.
- If a child phrase has an exact facet, use it. Otherwise preserve it in search_term.
- When several compatible products are explicitly requested for one resolved recipient, keep the requested parent categories in one merged Category facet.
- If requested products/recipients require different audience racks, ask which recipient to start with.
- Do not narrow to one requested option unless the customer marks it as preferred.
- Never emit more than one Gender value for one result rack.
`;
