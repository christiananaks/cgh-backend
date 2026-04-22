import express, { Router } from "express";
import path from 'path';

import { getDirname } from "../util/helper.js";



const router = Router();

router.use('/images/:directory', (req, res, next) => {
    return express.static(path.join(getDirname(import.meta.url), '../../uploads/images', req.params.directory))(req, res, next);
});

router.use('/misc/:folderId', (req, res, next) => {
    return express.static(path.join(getDirname(import.meta.url), '../../uploads/misc', `${req.params.folderId}`))(req, res, next);
});


router.get('/images/product/:imageId/:image', (req, res, next) => {

    try {
        const foldername = req.params.imageId;
        const filename = req.params.image;
        res.sendFile(path.join(getDirname(import.meta.url), `../../uploads/images/product/${foldername}`, `${filename}`));
    } catch (err: any) {
        console.log(err.message);
        next(err);
    }
});

router.get('/documents/KYC/:userId/:file', (req, res, next) => {

    try {
        const foldername = req.params.userId;
        const filename = req.params.file;
        res.sendFile(path.join(getDirname(import.meta.url), `../../uploads/documents/KYC/${foldername}`, `${filename}`));
    } catch (err: any) {
        console.log(err.message);
        next(err);
    }
});


export default router;