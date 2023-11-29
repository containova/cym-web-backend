const router = require('express').Router();
const { getMachineDetails, getUniqueMachineDetails, addMachineDetails, updateMachineDetails, deleteMachine, getFreightStations, getActiveFreightStations, getUniqueFreightStation, getSlots, updateSlots, checkSlotAvailability, addFrieghtStation } = require('../controllers/freightstation')
const multer = require('multer');
const { verifyAccessToken } = require('../services/jwt.service');

const upload = multer();

// router.get('/:fsId/machines', (req, res) => {
//     getMachineDetails(req, res);
// });

// router.get('/:fsId/machines/:machineId', (req, res) => {
//     getUniqueMachineDetails(req, res);
// });

// router.post('/:fsId/machines', (req, res) => {
//     addMachineDetails(req, res);
// });

// router.patch('/:fsId/machines/:machineId', (req, res) => {
//     updateMachineDetails(req, res);
// });

// router.delete('/:fsId/machines/:machineId', (req, res) => {
//     deleteMachine(req, res);
// });

router.get('/', verifyAccessToken, (req, res) => {
    getFreightStations(req, res);
});

router.get('/active', verifyAccessToken, (req, res) => {
    getActiveFreightStations(req, res);
});

router.get('/:fsId', verifyAccessToken, (req, res) => {
    getUniqueFreightStation(req, res);
});

router.post('/', upload.single('fsLayoutFile'), verifyAccessToken, (req, res) => {
    addFrieghtStation(req, res);
})

router.get('/:fsId/slots', verifyAccessToken, (req, res) => {
    getSlots(req, res);
});

router.patch('/:fsId/slots', (req, res) => {
    updateSlots(req, res);
});

router.post('/:fsId/slots/checkslots', (req, res) => {
    checkSlotAvailability(req, res);
});

module.exports = router
