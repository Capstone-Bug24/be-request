import express from 'express';
import * as alertCtrl from '../controllers/alert.controller.js';

const router =express.Router();

router.put('/:id/resolve', alertCtrl.resolveAlert);
export default router;