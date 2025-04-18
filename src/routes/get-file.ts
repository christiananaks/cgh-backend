import express, { Router } from "express";
import path from 'path';



const router = Router();
// nested router.get handlers matches the path after parent path from app.METHOD from start to end, in other words its strips off the parent path before matching string 
// thus slices the path after parent to end of url

router.use('/images/slides', express.static(path.join(__dirname, '../../uploads/images', `slides`)));

router.use('/images/profiles', express.static(path.join(__dirname, '../../uploads/images', `profiles`)));

router.use('/images/products', express.static(path.join(__dirname, '../../uploads/images', `products`)));

router.use('/images/games', express.static(path.join(__dirname, '../../uploads/images', `games`)));

router.use('/misc/:folderId', (req, res, next) => {
    return express.static(path.join(__dirname, '../../uploads/misc', `${req.params.folderId}`))(req, res, next);
});


router.get('/images/products/:imageId/:image', (req, res, next) => {

    try {
        const foldername = req.params.imageId;
        const filename = req.params.image;
        res.sendFile(path.join(__dirname, `../../uploads/images/products/${foldername}`, `${filename}`));
    } catch (err: any) {
        console.log(err.message);
        next(err);
    }
});

router.get('/documents/KYC/:userId/:file', (req, res, next) => {

    try {
        const foldername = req.params.userId;
        const filename = req.params.file;
        res.sendFile(path.join(__dirname, `../../uploads/documents/KYC/${foldername}`, `${filename}`));
    } catch (err: any) {
        console.log(err.message);
        next(err);
    }
});


export default router;