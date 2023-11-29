const router = require('express').Router();
const {createJobCard, getAssignedJobCards, updateJobCard, getJobCardDetails, getSingleJobCardDetails} = require('../controllers/jobcard');
const { verifyAccessToken } = require('../services/jwt.service');

router.post('/', verifyAccessToken, (req,res)=>{
    createJobCard(req,res)
})

router.get('/', verifyAccessToken, (req,res)=>{
    getJobCardDetails(req,res)
})

router.get('/:jobCardId', verifyAccessToken, (req,res)=>{
    getSingleJobCardDetails(req,res)
})

router.get('/machines/:machineId', verifyAccessToken, (req,res)=>{
    getAssignedJobCards(req,res)
})

router.delete('/:machineId', verifyAccessToken, (req,res)=>{
    updateJobCard(req,res)
})
module.exports = router