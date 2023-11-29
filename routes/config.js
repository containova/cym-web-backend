const router = require('express').Router();
const multer = require('multer');
const upload = multer();
const isodetails = require('../controllers/config');
const { verifyAccessToken } = require('../services/jwt.service');

const isoDetailsConfig = [{ name: 'isodetails', maxCount: 1 }];


router.post('/iso-codes',
    [upload.fields(isoDetailsConfig)],
    verifyAccessToken,
    (req, res) => {
        isodetails.isoDetailsSave(req, res);
    })

router.get('/iso-codes', verifyAccessToken, (req, res) => {
    isodetails.getISOCodes(req, res)
})

router.get("/iso-codes/:code", verifyAccessToken, (req, res) => {
    isodetails.getISOCode(req, res)
})


module.exports = router;
