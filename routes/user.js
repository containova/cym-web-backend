const router = require('express').Router();
const { getUserDetails, getUsers, userRegistration, getUniqueUser } = require('../controllers/user')
const { verifyAccessToken } = require('../services/jwt.service');

router.get('/', verifyAccessToken, (req, res) => {
	getUsers(req,res)
});

router.post('/register', verifyAccessToken, (req, res) => {
	userRegistration(req, res);
});

router.get('/profile', verifyAccessToken, (req, res) => {
	getUserDetails(req,res)
});

router.get('/:userId', verifyAccessToken, (req, res) => {
    getUniqueUser(req, res);
});



module.exports = router;
