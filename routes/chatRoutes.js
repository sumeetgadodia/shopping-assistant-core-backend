const express = require('express');
const router = express.Router();
const { runPipeline } = require('../services/chatPipeline');

router.post('/chat', async (req, res) => {
    const { message, user_id, channel_data } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Message field is required." });
    }

    try {
        const result = await runPipeline(message, user_id || 'guest', channel_data || {});
        res.json(result);
    } catch (e) {
        console.error("API Error:", e);
        res.status(500).json({ error: "Internal server error processing chat." });
    }
});

module.exports = router;
