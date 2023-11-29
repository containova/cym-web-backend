const { addYard, getYards, getUniqueYard } = require('../controllers/yard');
const { verifyAccessToken } = require('../services/jwt.service');

const router = require('express').Router();

router.post('/', verifyAccessToken, (req, res) => {
    addYard(req, res);
});

router.get('/', verifyAccessToken, (req, res) => {
    getYards(req, res);
});

router.get('/:yardId', verifyAccessToken, (req, res) => {
    getUniqueYard(req, res);
});

module.exports = router