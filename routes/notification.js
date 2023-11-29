const router = require('express').Router();
const { addNotification, getNotification } = require('../controllers/notification');
const { verifyAccessToken } = require('../services/jwt.service');

router.get('/', verifyAccessToken, (req, res) => {
	getNotification(req,res)
});

router.post('/', verifyAccessToken, (req, res) => {
	addNotification(req, res);
});



module.exports = router;
