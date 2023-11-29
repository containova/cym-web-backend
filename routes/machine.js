const router = require('express').Router();
const {
    getMachineMovements,
    getMachineDetails,
    getUniqueMachineDetails,
    deleteMachine,
    addMachineDetails,
    updateMachineDetails,
    postMachineStatus,
    getMachineStatus,
    getMachineList,
    getMachineBreakdownDetails,
} = require('../controllers/machine');
const { verifyAccessToken } = require('../services/jwt.service');


router.get("/statusupdate", verifyAccessToken, (req, res) => {
    getMachineStatus(req, res);
})

router.post('/statusupdate', verifyAccessToken, (req, res) => {
    postMachineStatus(req, res);
});

router.get('/', verifyAccessToken, (req, res) => {
    getMachineDetails(req, res);
});

router.get("/machinelist", verifyAccessToken, (req, res) => {
    getMachineList(req, res);
})

router.get('/machinemovements', verifyAccessToken, (req, res) => {
    getMachineMovements(req, res);
});

router.post('/addmachine', verifyAccessToken, (req, res) => {
    addMachineDetails(req, res);
});

router.patch('/updatemachine', verifyAccessToken, (req, res) => {
    updateMachineDetails(req, res);
});

router.delete('/deletemachine', verifyAccessToken, (req, res) => {
    deleteMachine(req, res);
});

router.get('/breakdowndetails', verifyAccessToken, (req,res)=>{
    getMachineBreakdownDetails(req, res);
})

router.get('/:machineId', verifyAccessToken, (req, res) => {
    getUniqueMachineDetails(req, res);
});


module.exports = router;
