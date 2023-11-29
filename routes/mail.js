const router = require('express').Router();
const mailSendController = require('../controllers/mail');
const { verifyAccessToken } = require('../services/jwt.service');


router.post('/', (req, res) => {
	mailSendController.mailSend(req, res);
});



module.exports = router;
