const router = require('express').Router();
const multer = require('multer');
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
}).array('images', 10);

const excelUploadStrategy = multer({
    storage:inMemoryStorage,
   // limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
    // fileFilter: (req, file, cb) => {
    //     if (file.mimetype == "file/xlsx") {
    //         cb(null, true);
    //     } else {
    //         cb(null, false);
    //         const err = new Error('Only .xlsx format allowed!')
    //         err.name = 'ExtensionError'
    //         return cb(err);
    //     }
    // },
}).single('file');;

const { uploadToAzureBlob, deleteFromAzureBlob, downloadBase64FromAzureBlob, generateColFromExcel } = require('../controllers/file');
const { verifyAccessToken } = require('../services/jwt.service');

router.post('/', uploadStrategy, (req, res) => {
    uploadToAzureBlob(req, res)
});

router.delete('/delete', (req,res)=>{
    deleteFromAzureBlob(req,res)
});

router.get("/download", (req,res)=>{
    downloadBase64FromAzureBlob(req, res)
});

router.post("/locationgeneration", excelUploadStrategy, (req, res)=>{
    generateColFromExcel(req,res);
});

module.exports = router