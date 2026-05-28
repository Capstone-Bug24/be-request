import express from 'express';
import * as overCtrl from '../controllers/overview.controller.js';

const router = express.Router();
router.get('/', overCtrl.getOverview);

export default router;