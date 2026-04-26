// Step 9: Validation Layer before sending to customer
const validateResponse = (llmPayload, intentContext) => {
    let isValid = true;
    let safeReply = llmPayload.reply_text;

    if (!safeReply) {
        return { isValid: false, safeReply: "I'm sorry, I couldn't process that. Could you rephrase?" };
    }

    // Rule: Do not invent cancellation success if it's a support query
    if (intentContext === 'support' && safeReply.toLowerCase().includes('successfully canceled')) {
        isValid = false;
        safeReply = "I see you want to cancel. Let me connect you to a human agent to process this securely.";
    }

    // Rule: Don't overwhelm with options (Keep it short)
    if (safeReply.length > 800) {
        isValid = false;
        // Truncate or replace with a safer short message
        safeReply = "I have several options for you, but my response got too long! Let me know if you'd like to see them one by one.";
    }

    return { isValid, safeReply };
};

module.exports = { validateResponse };
