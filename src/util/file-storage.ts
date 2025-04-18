import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

import multer from 'multer';

import { paths } from './path-linker';

export function clearImage(filePath: string) {
    filePath = path.join(__dirname, '../..', filePath);
    fs.unlink(filePath, err => {
        if (err) {
            console.log('error deleting image:', err?.message);
            return;
        }
        console.log('removed file: %s', filePath.substring(filePath.lastIndexOf('/') + 1));
    });
};

export function bulkImageStorage(req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void, folder: string) {

    // editing a product image
    if (req.query.imageId) {
        return fs.readdir(`uploads/images/products/${req.query.imageId}`, (err, images) => {
            if (err) {
                console.log(err.message);
                return cb(err, `uploads/images/products/${req.query.imageId}`);
            }
            // if file exists remove file before setting new file storage destination
            images.forEach(image => {
                if (image.startsWith(file.fieldname)) {
                    console.log(true, 'remove file: ', image);
                    fs.unlinkSync(`uploads/images/products/${req.query.imageId}/` + image);
                }
            });
            cb(null, `uploads/images/products/${req.query.imageId}`);
        });
    }
    //========================================================================//

    try {
        // process bulk image uploads from index 1 file in the array // ensures files from the req.files are stored at same folder as the first file.
        if (req.imageId && folder === 'products') {
            return cb(null, `uploads/images/products/${req.imageId}`);
        } else if (req.imageId && folder === 'guides') {
            return cb(null, `uploads/images/${folder}/${req.imageId}`);
        } else if (req.imageId && folder === 'misc') {
            return cb(null, `uploads/${folder}/${req.imageId}`);
        }
        //========================================================================//

        // sets new folder name for new image
        let foldername: string | undefined = undefined;
        switch (folder) {
            case "guides":
                foldername = req.query.subcategory;
                break;
            case "products":
                const genId = crypto.randomBytes(24);
                foldername = genId.toString('hex');
                break;
            case "misc":
                foldername = crypto.randomBytes(24).toString('hex');
                break;
        }
        //========================================================================//

        const folderPath = (folder === 'misc') ? paths.miscDir + `/${foldername}` : paths.imageDir + `/${folder}/${foldername}`;
        req.imageId = foldername;

        fs.mkdir(folderPath, { recursive: true }, (err) => {

            if (err) {
                console.log(err.message);
                return cb(err, `uploads/` + (folder === 'misc') ? `${folder}/${foldername}` : `images/${folder}/${foldername}`);
            }

            if (folder === 'misc') {
                return cb(null, `uploads/${folder}/${foldername}`);
            }

            cb(null, `uploads/images/${folder}/${foldername}`);
        });

    } catch (err: any) {
        console.log(err.message);
        cb(err, `uploads/images/${folder}/${req.imageId}`);
    }
}


export function bulkDocStorage(req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    const foldername = req.query.userId;
    const folderPath = paths.documentDir + `/KYC/${foldername}`;


    if (!fs.existsSync(folderPath)) {
        return fs.mkdir(folderPath, { recursive: true }, (err) => {
            if (err) {
                console.log(err.message);
                return cb(err, `uploads/documents/KYC/${foldername}`);
            }

            cb(null, `uploads/documents/KYC/${foldername}`);
        });
    }


    const existingDocs = fs.readdirSync(folderPath);
    existingDocs.forEach(doc => {
        if (doc.startsWith(file.fieldname)) {
            fs.unlinkSync(`uploads/documents/KYC/${foldername}/` + doc);
        }
    });

    return cb(null, `uploads/documents/KYC/${foldername}`);
}

export const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {

        // strip query parameters from request url endpoint  -> req.url.split('?')[0]
        switch (req.url.split('?')[0]) {

            case '/slide-image':
                cb(null, 'uploads/images/slides');
                break;
            case '/profile-image':
                cb(null, 'uploads/images/profiles');
                break;
            case '/product-image':
                cb(null, 'uploads/images/products');
                break;
            case '/product-images':
                bulkImageStorage(req, file, cb, 'products');
                break;
            case '/KYC-documents':
                bulkDocStorage(req, file, cb);
                break;
            case '/image-guides':
                bulkImageStorage(req, file, cb, 'guides');
                break;
            case '/game-image':
                cb(null, 'uploads/images/games');
                break;
            case '/post-refund-uploads':
                bulkImageStorage(req, file, cb, 'misc');
                break;
            default:
                cb(null, 'uploads/images');
        }
    },
    filename: (req, file, cb) => {

        switch (req.url) {
            case '/product-images':
                return cb(null, `${file.fieldname}-` + file.originalname);
            case `/product-images?imageId=${req.query[`${Object.keys(req.query)[0]}`]}`:
                return cb(null, `${file.fieldname}-` + file.originalname);
            case `/KYC-documents?userId=${req.query[`${Object.keys(req.query)[0]}`]}`:
                return cb(null, `${file.fieldname}-` + file.originalname);
            case `/image-guides?subcategory=${req.query[`${Object.keys(req.query)[0]}`]}`:
                return cb(null, `${file.fieldname}-` + file.originalname);
        }
        cb(null, new Date().toISOString() + '-' + file.originalname);
    }
});

export const fileFilter = (req: Request | any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {

    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
        cb(null, true);
    } else {
        const error = new Error('Unsupported file type!');
        cb(error);

        // remove empty folder that was created
        if (req.url.split('?')[0] === '/product-images' && fs.existsSync(paths.imageDir + `/products/${req.imageId}`)) {
            fs.rm(paths.imageDir + `/products/${req.imageId}`, { recursive: true }, (err) => {
                if (err) {
                    console.log('Error deleting empty dir: ', err.message);
                    cb(err);
                    return;
                }
            });
        }
    }
}

export const docFileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {

    if (file.fieldname === 'validId' && file.mimetype === 'application/pdf' ||
        file.fieldname === 'validId' && file.mimetype === 'image/png' ||
        file.fieldname === 'validId' && file.mimetype === 'image/jpg' ||
        file.fieldname === 'validId' && file.mimetype === 'image/jpeg') {
        return cb(null, true);
    }
    else if (file.fieldname === 'utilityBill' && file.mimetype === 'application/pdf') {
        return cb(null, true);
    } else if (file.fieldname === 'misc' && ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'].includes(file.mimetype)) {
        return cb(null, true);
    }
    else {
        const error = new Error('Unsupported file type!');
        cb(error);
    }
}