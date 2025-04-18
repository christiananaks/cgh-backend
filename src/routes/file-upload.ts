import { Router } from "express";

const router = Router();

router.put('/slide-image', (req, res, next) => {
    if (!req.file) {
        return res.status(422).json({ message: 'Image file must be provided!' });
    }
    console.log('stored slide image file path: ', req.file.path);

    return res.status(201).json({ message: 'slide image stored successfully.', filePath: req.file.path });    // file.path made available by multer
});


router.put('/profile-image', (req, res, next) => {
    if (!req.file) {
        return res.status(422).json({ message: 'Profile picture must be an image file.' });
    }

    return res.status(201).json({ message: 'Profile picture stored successfully.', filePath: req.file.path });
});

// GameDownloads | GameRepair
router.put('/product-image', (req, res, next) => {
    if (!req.file) {
        return res.status(422).json({ message: 'Product picture must be an image file.' });
    }

    return res.status(201).json({ message: 'Picture stored successfully.', filePath: req.file.path });
});

// GameSwap | GameRent
router.put('/game-image', (req, res, next) => {

    if (!req.file) {
        return res.status(422).json({ message: 'Game picture must be an image file.' });
    }

    return res.status(201).json({ message: 'Picture stored successfully.', filePath: req.file.path });
});


router.put('/KYC-documents', (req, res, next) => {
    if (!req.files) {
        const error: { [key: string]: any } = new Error('Invalid File :(');
        error.statusCode = 422;
        next(error);
    }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const savedFilePaths = [];
    for (const fieldname in files) {
        savedFilePaths.push(files[`${fieldname}`][0].path);
    }

    res.status(201).json({ success: true, message: 'Files upload successful.', filePath: savedFilePaths });
});

// multiple images upload
router.put('/:uploads', (req, res, next) => {
    try {
        if (!req.files) {
            const error: { [key: string]: any } = new Error('Invalid File :(');
            error.statusCode = 422;
            next(error);
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const savedFilePaths = [];
        for (const fieldname in files) {
            savedFilePaths.push(files[`${fieldname}`][0].path);
        }

        res.status(201).json({ success: true, message: 'Files uploaded successfully.', filePath: savedFilePaths });

    } catch (err: any) {
        console.log(err.message);
        next(err);
    }
});

router.put('/post-refund-uploads', (req, res, next) => {
    try {
        if (!req.files) {
            const error: { [key: string]: any } = new Error('Invalid File :(');
            error.statusCode = 422;
            next(error);
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const savedFilePaths = [];
        for (const fieldname in files) {
            savedFilePaths.push(files[`${fieldname}`][0].path);
        }

        res.status(201).json({ success: true, message: 'Files uploaded successfully.', filePath: savedFilePaths });

    } catch (err: any) {
        console.log(err.message);
        next(err);
    }
});

export default router;
