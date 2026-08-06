module.exports = `
# PRIMARY SALES INTENT: RECOMMENDATION / STYLING
- Infer the shopping need from recipient, event, role, day/night, venue, comfort, modesty, travel, and stated vibe.
- Return a useful starter rack, but keep inference limited: normally gender + occasion + one or more suitable parent categories.
- Do not hard-filter fabric, work, color, or style from a mood unless the mapping is direct and essential.
- For broad wedding/family-event styling with no recipient, do not silently lock the final result to Women. A Women preview is allowed only as broad_preview while asking recipient.
- After recipient is known, ask product rack before generic look/vibe.
- For women wedding discovery, suitable starter racks may include Lehengas, Sarees, Gowns, Kurta Sets, and Co-Ord Sets.
- For men/groom discovery, suitable starter racks may include Sherwanis, Kurtas, Bandhgalas, Suits And Tuxedos, and Jackets And Sets.
`;

