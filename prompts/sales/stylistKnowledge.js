const FAMILY_BANKS = Object.freeze({
    saree: {
        label: 'Saree',
        cues: /\b(sarees?|saris?|pre[- ]?draped|saree gown|blouses?)\b/i,
        parent: 'Category=Sarees',
        options: ['Pre-Draped Sarees', 'Wedding saree', 'Cocktail saree', 'Reception saree', 'Organza saree', 'Saree blouse']
    },
    lehenga: {
        label: 'Lehenga',
        cues: /\b(lehengas?|lehngas?|fish cut|lehenga choli|corset lehenga)\b/i,
        parent: 'Category=Lehengas',
        options: ['Bridal lehenga', 'Fish cut lehenga', 'Mirror work lehenga', 'Corset lehenga', 'Pastel lehenga', 'Sangeet lehenga']
    },
    gown: {
        label: 'Gown',
        cues: /\bgowns?\b/i,
        parent: 'Category=Gowns',
        options: ['Cocktail gown', 'Reception gown', 'Party gown', 'Wedding gown', 'Engagement gown', 'Corset gown']
    },
    dress: {
        label: 'Western dress',
        cues: /\b(maxi dress|midi dress|mini dress|short dress|summer dress|party dress|cocktail dress|western dress|dresses)\b/i,
        parent: 'Category=Dresses',
        options: ['Cocktail dress', 'Party dress', 'Maxi Dress', 'Midi Dress', 'Mini Dress', 'Summer dress']
    },
    kurta: {
        label: 'Kurta / Kurta Set',
        cues: /\b(kurta|kurta set|kurtas)\b/i,
        parent: 'Category=Kurtas or Kurta Sets, based on wording',
        options: ['Festive kurta set', 'Wedding kurta set', 'Cotton kurta set', 'Silk kurta set', 'Chikankari kurta set', 'Kurta with jacket']
    },
    anarkali_sharara: {
        label: 'Anarkali / Sharara / Gharara',
        cues: /\b(anarkali|sharara|gharara|farshi)\b/i,
        parent: 'Use the exact category/subcategory when present',
        options: ['Festive Anarkali', 'Wedding Anarkali', 'Haldi sharara', 'Mehendi sharara', 'Gharara set', 'Farshi salwar']
    },
    fusion_coord: {
        label: 'Fusion / Co-Ord',
        cues: /\b(fusion|indo[- ]?western|co[- ]?ord|pant set|jumpsuit|drape set|cape set)\b/i,
        parent: 'Use Fusion only when explicit; choose the exact product rack separately',
        options: ['Co-Ord Sets', 'Sarees', 'Gowns', 'Pant Sets', 'Jumpsuits', 'Draped saree']
    },
    kaftan: {
        label: 'Kaftan',
        cues: /\bkaftans?\b/i,
        parent: 'Sub Category=Kaftan Dresses or Kaftan Sets, based on wording',
        options: ['Kaftan Dresses', 'Kaftan Sets', 'Resort', 'Brunch', 'Vacation', 'Festive']
    },
    men_wedding: {
        label: 'Men wedding',
        cues: /\b(sherwani|groom|bandhgala|tuxedo|nehru jacket|men(?:'s)? wedding|husband.*wedding)\b/i,
        parent: 'Gender=Men',
        options: ['Wedding sherwani', 'Bandhgala', 'Tuxedo', 'Nehru jacket set', 'Kurta with jacket']
    },
    men_formal: {
        label: 'Men formal',
        cues: /\b(men(?:'s)? formal|formal shirt|suit|tuxedo|blazer|cocktail.*men|men.*reception)\b/i,
        parent: 'Gender=Men',
        options: ['Bandhgala', 'Suits And Tuxedos', 'Blazers & Sets', 'Formal Shirts']
    },
    men_footwear: {
        label: 'Men footwear',
        cues: /\b(men(?:'s)? (?:footwear|shoes)|wedding shoes|loafers?|kolhapuri|sneakers.*men)\b/i,
        parent: 'Gender=Men; Category=Footwear',
        options: ['Wedding shoes', 'Loafers', 'Sneakers', 'Sandals', 'Kolhapuri']
    },
    girls: {
        label: 'Girls',
        cues: /\b(girls?|daughter|girl child)\b/i,
        parent: 'Gender=Girls',
        options: ['Lehenga', 'Dress', 'Sharara set', 'Kurta set', 'Gown', 'Party dress']
    },
    boys: {
        label: 'Boys',
        cues: /\b(boys?|son|boy child)\b/i,
        parent: 'Gender=Boys',
        options: ['Kurta set', 'Sherwani', 'Nehru jacket set', 'Jacket set', 'Shirt', 'Festive look']
    },
    bags: {
        label: 'Bags',
        cues: /\b(bag|bags|clutch|potli|batwa|handbag|tote|purse)\b/i,
        parent: 'Category=Bags',
        options: ['Clutches', 'Potlis/Batwas', 'Handbags', 'Tote bag', 'Wedding bag', 'Party bag']
    },
    earrings: {
        label: 'Earrings',
        cues: /\b(earrings?|chandbali|jhumka|stud earrings?|ear cuff|dangler)\b/i,
        parent: 'Category=Earrings',
        options: ['Chandbali Earrings', 'Dangler Earrings', 'Stud Earrings', 'Jhumka style', 'Ear cuff']
    },
    necklaces: {
        label: 'Necklaces',
        cues: /\b(necklaces?|choker|pendant|layered necklace|pearl necklace)\b/i,
        parent: 'Category=Necklaces when applicable',
        options: ['Chokers', 'Pendant Necklaces', 'Layered Necklaces', 'Pearl necklace', 'Necklace set']
    },
    jewellery: {
        label: 'Jewellery',
        cues: /\b(jewellery|jewelry|jewels|accessory|accessories)\b/i,
        parent: 'Ask product type before occasion when jewellery is broad',
        options: ['Earrings', 'Necklaces', 'Jewellery Sets', 'Bangles', 'Chokers']
    },
    footwear: {
        label: 'Footwear',
        cues: /\b(footwear|heels|flats|juttis|sandals|wedges|sneakers|shoes)\b/i,
        parent: 'Category=Footwear',
        options: ['Heels', 'Flats', 'Juttis', 'Sandals', 'Wedges']
    }
});

const RETAINED_FIRST_BETS = `
General first-bet guidance:
- Broad fashion/styling with no recipient: Women may be a reversible broad_preview only when nothing indicates Men, Girls, Boys, kids, gifting, couple, family, or broad wedding-guest intent.
- Broad wedding/wedding-guest request with no recipient: ask recipient first; if search must run, a Women preview must remain broad and explicitly reversible.
- Women + Wedding: suitable parent racks are Lehengas, Sarees, Gowns, Kurta Sets, Co-Ord Sets.
- Women + Festive: suitable parent racks are Lehengas, Sarees, Kurta Sets, Co-Ord Sets, with Anarkali Sets or Sharara Sets only as exact subcategories.
- Cocktail/reception/night: suitable racks include Gowns, Sarees, Dresses, Lehengas, Co-Ord Sets.
- Haldi/mehendi/day/summer: suitable racks include Lehengas, Sarees, Kurta Sets, Co-Ord Sets, with Sharara/Anarkali as subcategory paths.
- Resort/beach/vacation: Dresses, Kaftan Dresses, Co-Ord Sets, Jumpsuits; add Sarees only in an Indian/wedding context.
- Men/groom/husband: Men + Sherwanis, Kurtas, Bandhgalas, Suits And Tuxedos, Jackets And Sets.
- Kids generic: ask Girls/Boys. Once rack is known, ask age/size early.
`;

const REFINEMENT_BANKS = Object.freeze({
    bridal_budget: ['Under ₹50k', '₹50k–₹1L', '₹1L+', 'No budget limit'],
    wedding_budget: ['Under ₹50k', '₹50k–₹1L', '₹1L–₹2L', 'No budget limit'],
    comfort: ['Light and easy', 'Glam and statement', 'Easy to dance in', 'Modest coverage', 'No preference'],
    delivery: ['Ready to ship', 'Within 1 week', 'Within 2 weeks', 'No rush'],
    lehenga_color: ['Pink', 'Ivory', 'Red', 'Gold', 'Green', 'No preference'],
    saree_color: ['Red', 'Gold', 'Pink', 'Ivory', 'Green', 'No preference'],
    gown_color: ['Black', 'Red', 'Pink', 'Gold', 'Ivory', 'No preference']
});

const compactThreadText = (chatThread = []) => (Array.isArray(chatThread) ? chatThread : [])
    .slice(-4)
    .map((turn) => `${turn?.from || ''}: ${turn?.message || ''}`)
    .join('\n');

const selectFamilyBanks = ({ query = '', chatThread = [], salesState = {} } = {}) => {
    const text = [query, compactThreadText(chatThread), salesState?.search_term || ''].join('\n');
    return Object.entries(FAMILY_BANKS)
        .filter(([, bank]) => bank.cues.test(text))
        .slice(0, 3)
        .map(([key]) => key);
};

const selectRefinementBanks = (text = '') => {
    const selected = [];
    if (/\b(bride|bridal)\b/i.test(text)) selected.push('bridal_budget');
    else if (/\b(wedding|sangeet|reception|engagement|groom)\b/i.test(text)) selected.push('wedding_budget');
    if (/\b(light|comfort|dance|modest|summer|outdoor|destination|beach)\b/i.test(text)) selected.push('comfort');
    if (/\b(urgent|ready to ship|rts|deliver|delivery|need .* by|within .*week|tomorrow|asap)\b/i.test(text)) selected.push('delivery');
    if (/\blehenga\b/i.test(text)) selected.push('lehenga_color');
    else if (/\bsaree\b/i.test(text)) selected.push('saree_color');
    else if (/\bgown\b/i.test(text)) selected.push('gown_color');
    return [...new Set(selected)].slice(0, 3);
};

const buildStylistKnowledge = (input = {}) => {
    const familyKeys = selectFamilyBanks(input);
    const text = [input?.query || '', compactThreadText(input?.chatThread), input?.salesState?.search_term || ''].join('\n');
    const refinementKeys = selectRefinementBanks(text);
    const familyText = familyKeys.length
        ? familyKeys.map((key) => {
            const bank = FAMILY_BANKS[key];
            return `- ${bank.label}: ${bank.parent}. Guided child paths: ${bank.options.join(', ')}.`;
        }).join('\n')
        : '- No product-family bank was selected. Use the general first-bet guidance and active catalog facets only.';
    const refinementText = refinementKeys.length
        ? refinementKeys.map((key) => `- ${key}: ${REFINEMENT_BANKS[key].join(', ')}`).join('\n')
        : '- No special refinement bank is required.';

    return {
        familyKeys,
        refinementKeys,
        prompt: `
# TURN-SCOPED STYLIST KNOWLEDGE
Treat broad terms as parent racks, not complete intent. Apply the safe parent plus explicit constraints, then expose only one relevant child/refinement bank. Do not hard-filter several child paths from a broad parent.

${RETAINED_FIRST_BETS}
Selected product-family banks:
${familyText}

Selected next-refinement banks:
${refinementText}

Follow-up options may be customer search phrases. Only exact active facet values can enter filters_to_apply; otherwise wait for selection and use a grounded search_term.
`
    };
};

module.exports = {
    FAMILY_BANKS,
    REFINEMENT_BANKS,
    buildStylistKnowledge,
    selectFamilyBanks
};
