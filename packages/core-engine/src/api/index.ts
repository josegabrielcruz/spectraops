// API Gateway placeholder
// TODO: Implement REST/GraphQL API using Express or Fastify
import express from 'express';
import errorRouter from './error';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'SpectraOps Core Engine API' });
});

app.use('/api/errors', errorRouter);

export default app;
