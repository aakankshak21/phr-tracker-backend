const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const dashboardRoutes = require('./routes/dashboard');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api', dashboardRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`PHR API running on http://localhost:${PORT}`);
});
