const { addRoles, getRoles, getUniqueRole } = require('../controllers/role');
const { verifyAccessToken } = require('../services/jwt.service');

const router = require('express').Router();

router.post('/', verifyAccessToken, (req,res)=>{
    addRoles(req,res);
});

router.get('/', verifyAccessToken, (req,res)=>{
    getRoles(req,res);
});

router.get('/:roleId', verifyAccessToken, (req,res)=>{
    getUniqueRole(req,res);
});

module.exports = router;
