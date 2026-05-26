import express from 'express';
import * as hisCtrl from '../controllers/history.controller.js';

const router = express.Router();

router.get('/logs', hisCtrl.logs);

export default router;