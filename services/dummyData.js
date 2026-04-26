// Stage 6: Fact Retrieval Layer
const getProducts = (filters) => {
    // Dummy product catalog retrieval
    return [
        { id: "P101", name: "Black Embroidered Saree", price: "₹22,000", delivery: "RTS", designer: "Tarun Tahiliani" },
        { id: "P102", name: "Midnight Blue Georgette Saree", price: "₹24,500", delivery: "1 week", designer: "Seema Gujral" },
        { id: "P103", name: "Black Sequin Saree", price: "₹19,000", delivery: "RTS", designer: "Punit Balana" }
    ];
};

const getOrderFacts = (orderId) => {
    // Dummy order status retrieval
    return { 
        order_id: orderId || "W3QKOSO2", 
        status: "Delayed in Transit", 
        cancellation_eligible: true, 
        refund_mode: "Source Account",
        items: ["Red Bridal Lehenga"]
    };
};

// Stage 1-5: Preprocessing Layer
const enrichCustomerContext = (userId, channelData) => {
    return {
        session: { channel: channelData?.channel || "web", type: "returning_session" },
        profile: { segment: "premium", preferred_size: "M", loyalty_tier: "Gold" },
        past_orders: [{ id: "W3QKOSO2", status: "Delayed" }],
        live_behavior: { browsing_category: "sarees" }
    };
};

module.exports = { getProducts, getOrderFacts, enrichCustomerContext };
