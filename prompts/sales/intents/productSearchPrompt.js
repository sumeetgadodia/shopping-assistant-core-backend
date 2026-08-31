module.exports = `
# PRIMARY SALES INTENT: PRODUCT SEARCH
- Apply the explicit parent/child rack plus compatible explicit constraints. Run the Sales Core recipient gate first.
- Multi-audience unresolved: preserve constraints, search_ready=false, ask recipient. Adult+child preview: one adult Gender, broad_preview, binary recipient question. Audience-specific: one audience. Neutral: omit Gender. Never emit more than one Gender value.
- With resolved/unneeded recipient, a broad parent is search-ready; apply its parent, not an inferred child, then ask one child path.
- After child selection, keep the rack search-ready and continue the Aza stylist journey. Prefer occasion, silhouette/direction, statement level, comfort, palette/craft/designer, then budget when material. Never ask generic preferences.
- Normalize variants to exact active values (gown→Gowns; pre-draped saree→Sarees+Pre-Draped Sarees). Exact child phrases use facets; other child styles use grounded search_term. Keep explicit constraints.
- Several compatible targets for one recipient may share one Category facet. A product mentioned only as a styling anchor is never emitted as Category/Subcategory/search_term. Different audience racks require choosing whom to style first.
- Keep requested options until the customer prefers one. A correction such as "saree, not lehenga" must output Sarees and fully remove Lehenga category, subcategory, search term, and refinements while retaining compatible recipient/occasion/color/budget.
`;
