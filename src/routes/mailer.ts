
import express from 'express';

import { CustomError, resolverErrorChecker } from '../util/helper.js';
import { CtxArgs } from '../models/type-def.js';
import Mailing from '../models/mailing.js';

const router = express.Router();


router.post('/send/all-users', async (req: any, res, next) => {

    const { subject, content, kind } = req.body as { subject: string, content: string, kind: string };

    try {
        resolverErrorChecker({ condition: !content.includes('<!DOCTYPE html>'), code: 422, message: 'Please enter a valid html content.' });

        resolverErrorChecker({ condition: !req.isAuth, code: 401, message: 'Please login to continue.' });

        resolverErrorChecker({ condition: !['admin', 'superuser'].includes(req.role), code: 403, message: 'user is unauthorized.' });

        const emailProps = { subject, content, kind };

        const isSent = await Mailing.sendBulkEmail({ emailProps });

        if (!isSent) return res.json({ 'success': true, 'message': 'Some Emails failed to deliver.' });

        return res.json({ 'success': true, 'message': 'Emails were sent successfully.' });

    } catch (err: any) {
        console.log(err.message);
        next(err);
    }
},);

router.post('/send/:mailId', async (req: any, res, next) => {

    try {
        const mailId = req.params.mailId;

        resolverErrorChecker({ condition: !req.isAuth, code: 401, message: 'Please sign-in to continue.' });
        resolverErrorChecker({ condition: !['admin', 'superuser'].includes(req.role), code: 403, message: 'Unauthorized request.' });

        const queryRes = await Mailing.findById(mailId);
        if (!queryRes) {
            throw new CustomError('Email not found!', 404);
        }
        const mailDoc = queryRes;
        const emailProps = { kind: mailDoc.info.kind, subject: mailDoc.info.subject, content: mailDoc.info.body };

        const isSent = await Mailing.sendBulkEmail({ emailProps, mailDoc });

        if (!isSent) return res.json({ success: true, message: 'Some Emails failed to deliver.' });

        return res.json({ success: true, message: 'Emails were sent successfully.' });

    } catch (err: any) {
        console.log(err.toString());
        next(err);
    }
});

router.get('/get/failed-mails', async (req: any, res, next) => {
    try {
        resolverErrorChecker({ condition: !req.isAuth, code: 401, message: 'Please sign-in to continue.' });
        resolverErrorChecker({ condition: !['admin', 'superuser'].includes(req.role), code: 403, message: 'Unauthorized request.' });
        const queryRes = await Mailing.find();
        if (queryRes.length < 1) {
            return res.json([]);
        }

        const mailRecords = queryRes.map(doc => {
            return { ...doc._doc, id: doc.id };
        });

        return res.json(mailRecords);
    } catch (err: any) {
        console.log(err.toString());
        next(err);
    }
});


router.post('/clear-mail-history', async (req: any, res, next) => {

    try {
        resolverErrorChecker({ condition: !req.isAuth, code: 401, message: 'Please sign-in to continue.' });
        resolverErrorChecker({ condition: !['admin', 'superuser'].includes(req.role), code: 403, message: 'Unauthorized request.' });

        await Mailing.deleteMany({});

        return res.json({ success: true, message: 'All mails were deleted successfully.' });

    } catch (err: any) {
        console.log(err.toString());
        next(err);
    }
});

export default router;