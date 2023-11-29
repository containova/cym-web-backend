const { addOrganization, getOrganizations, getActiveOrganizations ,getUniqueOrganization } = require('../controllers/organization');

const router = require('express').Router();
const multer = require('multer');
const { verifyAccessToken } = require('../services/jwt.service');
const inMemoryStorage = multer.memoryStorage();
const uploadStrategy = multer({
    storage:inMemoryStorage,
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
}).single('organizationLogo');


router.post('/', uploadStrategy, verifyAccessToken, (req, res) => {
    addOrganization(req, res);
});

router.get('/', verifyAccessToken, (req, res) => {
    getOrganizations(req, res);
});

router.get('/active', verifyAccessToken, (req, res) => {
    getActiveOrganizations(req, res);
});

router.get('/:organizationId', verifyAccessToken, (req, res) => {
    getUniqueOrganization(req, res);
});

module.exports = router;
