const router = require('express').Router()
const { getMovementLogDetails, getMachineSpecificMovementLog } = require('../controllers/movementlog');
const { verifyAccessToken } = require('../services/jwt.service');

router.get('/', verifyAccessToken, (req, res) => {
    getMovementLogDetails(req, res)
});

router.get('/:machineId', verifyAccessToken, (req, res) => {
    getMachineSpecificMovementLog(req, res)
});

module.exports = router