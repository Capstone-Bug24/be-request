import express from 'express';
import * as aiCtrl from '../controllers/ai.controller.js';

const router =express.Router();

router.post('/events', aiCtrl.handleAiEvent);
export default router;