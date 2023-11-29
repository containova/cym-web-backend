const router = require('express').Router();
const multer = require('multer');
const upload = multer();
const { getContainersDetails, postContainerDetailsManually, igmDetailsSave, renderContainerPdf, renderContainersPdf, renderContainersExcel, renderContainerExcel, updateContainerDetails, getMasterData, locateContainer, postGateOutDetailsManually, suggestLocation, getContainerLocation, getUniqueContainerDetails, getSingleContainerDetailsWithISOCode } = require('../controllers/container');
const { verifyAccessToken } = require('../services/jwt.service');
const igmDetailsConfig = [{ name: 'igmdetails', maxCount: 1 }];
const inMemoryStorage = multer.memoryStorage();
const uploadStrategy = multer({
    storage: inMemoryStorage,
    // limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype == "image/png" || file.mimetype == "image/jpg" || file.mimetype == "image/jpeg") {
            cb(null, true);
        } else {
            cb(null, false);
            const err = new Error('Only .png, .jpg and .jpeg format allowed!')
            err.name = 'ExtensionError'
            return cb(err);
        }
    },
}).array('images', 10);

router.get('/', verifyAccessToken, (req, res) => {
    if (!req.query.collectionName)
        getContainersDetails(req, res);
    else
        getMasterData(req, res);
});

router.get("/singleContainerDetailsISOCode", verifyAccessToken, (req, res) => {
    getSingleContainerDetailsWithISOCode(req, res)
})

router.get('/:containerId', verifyAccessToken, (req, res) => {
    getUniqueContainerDetails(req, res);
});

router.post('/', verifyAccessToken, (req, res) => {
    postContainerDetailsManually(req, res);
});

router.post('/gateout', verifyAccessToken, (req, res) => {
    postGateOutDetailsManually(req, res);
});

router.post('/file',
    [upload.fields(igmDetailsConfig)], verifyAccessToken,
    (req, res) => {
        igmDetailsSave(req, res);
    });


router.get("/download/:fileType", verifyAccessToken, (req, res) => {
    if (req.params.fileType == 'pdf')
        renderContainersPdf(req, res);
    else if (req.params.fileType == 'xlsx')
        renderContainersExcel(req, res);
});

router.get('/:containerId/download/:fileType', verifyAccessToken, (req, res) => {
    if (req.params.fileType == 'pdf')
        renderContainerPdf(req, res);
    else if (req.params.fileType == 'xlsx')
        renderContainerExcel(req, res);
});

router.patch('/:containerId', uploadStrategy, (req, res) => {
    updateContainerDetails(req, res);
});

router.post('/slots/locate-container', verifyAccessToken, (req, res) => {
    locateContainer(req, res);
});

router.get('/slots/getcontainerlocation', verifyAccessToken, (req, res) => {
    getContainerLocation(req, res);
});

router.get('/slots/suggestlocation', verifyAccessToken, (req, res) => {
    suggestLocation(req, res);
});

module.exports = router
