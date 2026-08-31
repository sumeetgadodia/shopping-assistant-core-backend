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
- Sales Core owns recipient logic; banks never override it. Never mix audiences or globally default Women.
- Women Wedding/Festive: Lehengas, Sarees, Gowns, Kurta/Co-Ord Sets; Anarkali/Sharara only as exact child paths.
- Cocktail/reception: Gowns, Sarees, Dresses, Lehengas, Co-Ord Sets. Haldi/mehendi/day: Lehengas, Sarees, Kurta/Co-Ord Sets.
- Resort: Dresses, Kaftan Dresses, Co-Ord Sets, Jumpsuits; Sarees only with Indian/wedding context. Men/groom: Sherwanis, Kurtas, Bandhgalas, Suits/Tuxedos, Jackets/Sets. Kids: ask Girls/Boys, then age/size.
- Curate one coherent Aza designer edit, not a catalog dump. Lead with taste/occasion unless urgency is explicit; return the rack plus one purposeful question.
`;

const REFINEMENT_BANKS = Object.freeze({
    wedding_moment: ['Wedding ceremony', 'Sangeet', 'Reception', 'Mehendi/Haldi', 'Engagement'],
    wedding_role: ['Bride', 'Bridesmaid', 'Close family', 'Wedding guest', 'Show all'],
    look_direction: ['Classic Indian', 'Modern glamour', 'Soft romantic', 'Statement craft', 'Minimal luxe'],
    statement_level: ['Understated elegance', 'Refined statement', 'High glamour', 'Light and effortless', 'No preference'],
    bridal_budget: ['Under ₹50k', '₹50k–₹1L', '₹1L+', 'No budget limit'],
    wedding_budget: ['Under ₹50k', '₹50k–₹1L', '₹1L–₹2L', 'No budget limit'],
    comfort: ['Light and easy', 'Glam and statement', 'Easy to dance in', 'Modest coverage', 'No preference'],
    delivery: ['Ready to ship', 'Within 1 week', 'Within 2 weeks', 'No rush'],
    bag_type: ['Potlis', 'Clutches', 'Handbags', 'Totes', 'Show all'],
    bag_detail: ['Palette', 'Craft', 'Size', 'Carry style', 'No preference'],
    lehenga_color: ['Pink', 'Ivory', 'Red', 'Gold/Green', 'No preference'],
    saree_color: ['Red', 'Gold', 'Pink/Ivory', 'Green', 'No preference'],
    gown_color: ['Black', 'Red', 'Pink', 'Gold/Ivory', 'No preference']
});

const compactThreadText = (chatThread = []) => (Array.isArray(chatThread) ? chatThread : [])
    .slice(-4)
    .map((turn) => `${turn?.from || ''}: ${turn?.message || ''}`)
    .join('\n');

const stripNegatedFamilyCues = (text = '') => String(text || '').replace(
    /\b(?:not|no|instead of|rather than|without)\s+(?:an?|the)?\s*(?:sarees?|saris?|lehengas?|lehngas?|gowns?|dresses?|kurtas?|kurta sets?|sherwanis?|bandhgalas?|jewell?ery|bags?|footwear|shoes?|anarkalis?|shararas?|kaftans?|co[- ]?ords?)\b/gi,
    ' '
);

const familyKeysForText = (text = '') => Object.entries(FAMILY_BANKS)
    .filter(([, bank]) => bank.cues.test(stripNegatedFamilyCues(text).replace(/\badd (?:this|it|the item) to (?:my )?bag\b/gi, ' ')))
    .map(([key]) => key);

const confirmedFamilyText = (salesState = {}) => (Array.isArray(salesState?.confirmed_filters)
    ? salesState.confirmed_filters
        .filter((item) => ['level2CategoryName_uFilter', 'level3CategoryNames_uFilter'].includes(item?.facet_name))
        .flatMap((item) => Array.isArray(item?.values) ? item.values : [])
    : []).join(' ');

const selectFamilyBanks = ({ query = '', chatThread = [], salesState = {} } = {}) => {
    const targetMatch = String(query || '').match(/^([\s\S]*?)\b(?:to match|to go with|for this|with this)\b/i);
    const targetKeys = targetMatch ? familyKeysForText(targetMatch[1]) : [];
    if (targetKeys.length) return targetKeys.slice(0, 3);

    const currentKeys = familyKeysForText(query);
    if (currentKeys.length) return currentKeys.slice(0, 3);

    const stateKeys = familyKeysForText(`${salesState?.search_term || ''} ${confirmedFamilyText(salesState)}`);
    if (stateKeys.length) return stateKeys.slice(0, 3);

    const customerTurns = (Array.isArray(chatThread) ? chatThread : [])
        .filter((turn) => String(turn?.from || '').toLowerCase() === 'customer')
        .slice(-4)
        .reverse();
    const retained = [];
    for (const turn of customerTurns) {
        for (const key of familyKeysForText(turn?.message || '')) {
            if (!retained.includes(key)) retained.push(key);
            if (retained.length === 3) return retained;
        }
    }
    return retained;
};

const answeredDimensions = (salesState = {}) => new Set(
    (Array.isArray(salesState?.answered_dimensions) ? salesState.answered_dimensions : [])
        .map((value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_'))
        .filter(Boolean)
);

const selectRefinementBanks = (text = '', familyKeys = [], salesState = {}) => {
    const selected = [];
    const answered = answeredDimensions(salesState);
    const isAnswered = (...dimensions) => dimensions.some((dimension) => answered.has(dimension));
    const add = (key, ...dimensions) => {
        if (!isAnswered(key, ...dimensions) && !selected.includes(key)) selected.push(key);
    };
    const hasWedding = /\b(wedding|bride|bridal|groom|sangeet|reception|engagement|mehendi|haldi)\b/i.test(text);
    const hasExactMoment = /\b(sangeet|reception|engagement|mehendi|haldi|wedding ceremony)\b/i.test(text);
    const hasRole = /\b(bride|bridal|groom|bridesmaid|close family|wedding guest)\b/i.test(text);

    if (hasWedding && !hasExactMoment) add('wedding_moment', 'occasion_moment', 'event_moment');
    if (hasWedding && !hasRole) add('wedding_role', 'occasion_role', 'wearer_role');
    if (familyKeys.length) add('look_direction', 'style', 'styling_direction');
    if (familyKeys.length) add('statement_level', 'mood', 'vibe');
    if (/\b(light|comfort|dance|modest|summer|outdoor|destination|beach|coverage|easy)\b/i.test(text) || isAnswered('look_direction', 'style')) {
        add('comfort', 'practicality', 'wearability');
    }
    if (/\b(bride|bridal)\b/i.test(text)) add('bridal_budget', 'budget', 'price');
    else if (hasWedding) add('wedding_budget', 'budget', 'price');
    if (familyKeys.includes('lehenga')) add('lehenga_color', 'color', 'colour', 'palette');
    else if (familyKeys.includes('saree')) add('saree_color', 'color', 'colour', 'palette');
    else if (familyKeys.includes('gown')) add('gown_color', 'color', 'colour', 'palette');
    if (familyKeys.includes('bags')) {
        add('bag_type', 'product_type', 'bag_type');
        if (isAnswered('bag_type', 'product_type')) add('bag_detail', 'bag_detail', 'palette', 'craft');
    }
    if (/\b(urgent|ready to ship|rts|deliver|delivery|need .* by|within .*week|tomorrow|asap)\b/i.test(text)) {
        add('delivery', 'delivery_timeline', 'shipping_time');
    }
    return selected.slice(0, 5);
};

const buildStylistKnowledge = (input = {}) => {
    const familyKeys = selectFamilyBanks(input);
    const text = [stripNegatedFamilyCues(input?.query || ''), compactThreadText(input?.chatThread), input?.salesState?.search_term || '', confirmedFamilyText(input?.salesState)].join('\n');
    const refinementKeys = selectRefinementBanks(text, familyKeys, input?.salesState || {});
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

Question-bank rules:
- Banks are choices, not a checklist: ask one highest-impact unanswered question, then move on next turn. Do not stop because filters are known.
- With focused runtime products, prefer a grounded comparison/selection question. Options may be search phrases; only exact active values enter filters, otherwise use grounded search_term after selection.
`
    };
};

module.exports = {
    FAMILY_BANKS,
    REFINEMENT_BANKS,
    buildStylistKnowledge,
    selectFamilyBanks
};
