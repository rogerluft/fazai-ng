/**
 * Main API Router
 * Aggregates all route modules
 */

import { Router } from 'express';
import cloudflareRoutes from './cloudflare.routes';
import spamexpertsRoutes from './spamexperts.routes';
import opnsenseRoutes from './opnsense.routes';

const router = Router();

// Mount route modules
router.use('/cloudflare', cloudflareRoutes);
router.use('/spamexperts', spamexpertsRoutes);
router.use('/opnsense', opnsenseRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

export default router;
