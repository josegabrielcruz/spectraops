// API Gateway
import express, { type Express } from 'express';
import cors from 'cors';
import errorRouter from './error';

const app: Express = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'SpectraOps Core Engine API' });
});

app.use('/api/errors', errorRouter);

export default app;
