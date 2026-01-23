import { Router } from 'express';
import authRoutes from './auth.routes';

const router = Router();

router.use('/auth', authRoutes);

// Add more routes here
// router.use('/keys', keyRoutes);

export default router;