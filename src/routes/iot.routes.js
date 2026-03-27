// src/routes/iot.routes.js
import express from 'express';
import * as iotCtrl from '../controllers/iot.controller.js';


const router = express.Router();

router.post('/collect', iotCtrl.collectData);
router.get('/latest', iotCtrl.getLatestData);

export default router;