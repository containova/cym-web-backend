const router = require('express').Router();
const authController = require('../controllers/auth');
const { verifyAccessToken } = require('../services/jwt.service');


router.post('/register', [], (req, res) => {
	authController.register(req, res);
});

router.post('/login', [], (req, res) => {
	authController.login(req, res);
});

router.post('/machine-login', [], (req, res) => {
	authController.machineLogin(req, res);
});

router.get('/machine-profile', verifyAccessToken, (req, res) => {
	authController.getMachineProfile(req,res);
});

module.exports = router;
