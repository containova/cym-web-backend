const router = require('express').Router();
// const { verifyAccessToken } = require('../controllers/user');
const {
	addMobile,
	getMobiles,
	getUniqueMobile,
	addProcessingUnit,
	getProcessingUnits,
	getUniqueProcessingUnit,
	addCamera,
	getCameras,
	getUniqueCamera,
	addGPS,
	getGPSs,
	getUniqueGPS,
	getActiveProcessingUnit,
	getActiveMobile,
	getActiveCamera,
	getActiveGPS
} = require('../controllers/devices');
const { verifyAccessToken } = require('../services/jwt.service');

router.post('/mobile', verifyAccessToken, (req, res) => {
	addMobile(req, res);
});

router.get('/mobile', verifyAccessToken, (req, res) => {
	getMobiles(req, res);
});

router.get('/mobile/:mobileNo', verifyAccessToken, (req, res) => {
	getUniqueMobile(req, res);
});

// router.patch('/mobile/:deviceId', (req, res) => {
// 	getUniqueMobile(req, res);
// });


router.post('/processing-unit', verifyAccessToken, (req, res) => {
	addProcessingUnit(req, res);
});

router.get('/processing-unit', verifyAccessToken, (req, res) => {
	getProcessingUnits(req, res);
});

router.get('/processing-unit/:deviceId', verifyAccessToken, (req, res) => {
	getUniqueProcessingUnit(req, res);
});

router.post('/camera', verifyAccessToken, (req, res) => {
	addCamera(req, res);
});

router.get('/camera', verifyAccessToken, (req, res) => {
	getCameras(req, res);
});

router.get('/camera/:deviceId', verifyAccessToken, (req, res) => {
	getUniqueCamera(req, res);
});


router.post('/gps', verifyAccessToken, (req, res) => {
	addGPS(req, res);
});

router.get('/gps', verifyAccessToken, (req, res) => {
	getGPSs(req, res);
});

router.get('/gps/:deviceId', verifyAccessToken, (req, res) => {
	getUniqueGPS(req, res);
});

router.get('/active/processing-unit', verifyAccessToken, (req, res) => {
	getActiveProcessingUnit(req, res);
});

router.get('/active/mobile', verifyAccessToken, (req, res) => {
	getActiveMobile(req, res);
});

router.get('/active/camera', verifyAccessToken, (req, res) => {
	getActiveCamera(req, res);
});

router.get('/active/gps', verifyAccessToken, (req, res) => {
	getActiveGPS(req, res);
});

module.exports = router;
