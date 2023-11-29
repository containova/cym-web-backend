const router = require('express').Router();
const { shippinglinewiseinventory, emptySlots, blockwiseinventory, monthlyGateInGateOut, containerAging, trailerInCount, machineMovements, monthlyContainerMovements } = require('../controllers/report');
const { verifyAccessToken } = require('../services/jwt.service');

router.get('/visualreports/shippinglinewiseinventory', verifyAccessToken, (req, res) => {
    shippinglinewiseinventory(req, res);
});

router.get('/visualreports/emptyslots', verifyAccessToken, (req, res) => {
    emptySlots(req, res);
});

router.get('/visualreports/blockwiseinventory', verifyAccessToken, (req, res) => {
    blockwiseinventory(req, res);
});

router.get('/visualreports/monthlygateingateout', verifyAccessToken, (req, res) => {
    monthlyGateInGateOut(req, res);
});

router.get('/visualreports/containeraging', verifyAccessToken, (req, res) => {
    containerAging(req, res);
});

router.get('/visualreports/trailerincount', verifyAccessToken, (req, res) => {
    trailerInCount(req, res);
});

router.get('/visualreports/machinemovements', verifyAccessToken, (req,res)=>{
    machineMovements(req,res);
});

router.get('/visualreports/monthlycontainermovements', verifyAccessToken, (req, res)=>{
    monthlyContainerMovements(req, res);
});

module.exports = router;