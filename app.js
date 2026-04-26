const express = require('express');
const cors = require('cors');
const config = require('./config/settings');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Main API Route
app.use('/api', chatRoutes);

app.listen(config.PORT, () => {
    console.log(`=================================`);
    console.log(`Shopping Assistant API Started`);
    console.log(`Port: ${config.PORT}`);
    console.log(`Router Model: ${config.MODELS.ROUTER}`);
    console.log(`Main Model: ${config.MODELS.MAIN}`);
    console.log(`=================================`);
});
