import app from './api/index';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SpectraOps Core Engine API listening on port ${PORT}`);
});
