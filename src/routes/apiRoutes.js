import { Router } from 'express';
import { getClimateAndRecommendations, getPersonalizedClimateAndRecommendations } from '../controllers/climateController.js';
import { login, register } from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { updateMyFarm } from '../controllers/farmController.js';

const router = Router();

router.get('/climate-recommendations',verifyToken, getClimateAndRecommendations);
router.get('/personal-recommendations', verifyToken, getPersonalizedClimateAndRecommendations);


// Protected route to update persistent farm profile
router.put("/farm", verifyToken, updateMyFarm);
router.post('/auth/login', login);
router.post('/auth/register', register);

export default router;