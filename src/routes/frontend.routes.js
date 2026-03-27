// src/routes/frontend.routes.js
import express from 'express';
import * as authCtrl from '../controllers/frontend.controller.js';

const router = express.Router();

router.post('/signup', authCtrl.signUp);
router.post('/login', authCtrl.login);
router.put('/profile', authCtrl.updateProfile);

export default router;