import express from 'express';
import * as alertCtrl from '../controllers/alert.controller.js';

const router =express.Router();

router.post('/resolve', alertCtrl.resolveAlert);
export default router;