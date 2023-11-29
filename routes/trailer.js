const { getTrailerDetails, postTrailerDetails, getAllWithinYardTrailersList } = require('../controllers/trailer');
const { verifyAccessToken } = require('../services/jwt.service');

const router = require('express').Router();


router.get('/', verifyAccessToken, (req, res) => {
    getTrailerDetails(req, res);
});

router.post('/', verifyAccessToken, (req, res)=>{
    postTrailerDetails(req,res)
})

router.get('/withinyardlist', verifyAccessToken, (req, res) => {
    getAllWithinYardTrailersList(req, res);
});

module.exports = router