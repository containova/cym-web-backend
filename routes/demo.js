const router = require('express').Router();
const { postdemoInfo, getDemoInfo } = require('../controllers/demo');

router.post('/', (req, res) => {
    postdemoInfo(req, res);
});

router.get('/', (req, res) => {
    getDemoInfo(req, res);
});

module.exports = router