import express from 'express';
import dotenv from 'dotenv';
import routes from './routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '10mb' }));
app.use('/', routes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TradingView access server running on port ${PORT}`);
});