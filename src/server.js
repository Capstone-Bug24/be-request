import dotenv from 'dotenv';
dotenv.config(); //env 로드 무조건 최상단

import app from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
