const router = require('express').Router();
// const { verifyAccessToken } = require('../controllers/user');
const { getCollectionData } = require('../controllers/collection');
const { verifyAccessToken } = require('../services/jwt.service');


router.get('/', verifyAccessToken,  (req, res) => {
	getCollectionData(req, res);
});

module.exports = router;
