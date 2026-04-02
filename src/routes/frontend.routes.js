// src/routes/frontend.routes.js
import express from 'express';
import * as authCtrl from '../controllers/frontend.controller.js';

const router = express.Router();

router.post('/signup', authCtrl.signUp);
router.post('/login', authCtrl.login);
router.put('/profile', authCtrl.updateProfile);
router.delete('/deleteuser', authCtrl.deleteUser);
router.put('/update-password', authCtrl.updatePassword);

export default router;