const router = require('express').Router();
const { getSlotDetails, postBucket, updateBucket, getAllBuckets, getSpecificBucket, deleteBucket,sortBucket, updateslots } = require('../controllers/bucket');
const { verifyAccessToken } = require('../services/jwt.service');


router.get('/slots', verifyAccessToken, (req, res) => {
    getSlotDetails(req, res)
});

router.post('/',verifyAccessToken, (req, res) => {
    postBucket(req, res)
});

router.patch('/:bucketId', verifyAccessToken, (req, res) => {
    updateBucket(req, res)
});

router.get('/', verifyAccessToken, (req, res) => {
    if (!req.query.bucketId)
        getAllBuckets(req, res)
    else
        getSpecificBucket(req, res)
});

router.delete('/:bucketId', verifyAccessToken, (req, res) => {
    deleteBucket(req, res)
});

router.post('/sortBucket',verifyAccessToken, (req, res) => {
    sortBucket(req, res)
});

module.exports = router
