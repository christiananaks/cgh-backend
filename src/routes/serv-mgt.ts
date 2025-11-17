import { Router } from "express";

import ServerMnt from "../models/serv-mnt.js";
import { resolverErrorChecker } from "../util/helper.js";
import User from "../models/user.js";



const router = Router();
// should come after auth & refreshT MW cos we want only authorized request to make it here.
router.post('/serv-management', async (req: any, res, next) => {
    const allowedUsers = ['admin', 'superuser'];
    const mgtState = await ServerMnt.find();


    try {
        resolverErrorChecker({ condition: !req.isAuth, code: 401, message: 'Please login to continue.' });
        resolverErrorChecker({ condition: mgtState.length > 0, code: 409, message: "Can't complete your request until active management session ends." });
        resolverErrorChecker({ condition: !allowedUsers.includes(req.role), code: 403, message: 'user is unauthorized.' });
        resolverErrorChecker({
            condition: req.body.minutes && req.body.minutes <= 10,
            message: 'Duration must be 11 minutes or more.',
            code: 422
        });


        const minutes = req.body.minutes || 600000;


        // 60,000ms = 1m   // so we calculate the total minutes and add to present time to get expireAt Date
        const date = Date.now() + (minutes * 60000);
        const isSuperUser = req.role === 'superuser';

        console.log(new Date(date - Date.now()).getMinutes(), 'minutes left');


        await ServerMnt.create({
            startedBy: req.user._id,
            status: true,
            access: isSuperUser ? 'superuser' : 'admin',
            level: isSuperUser ? 2 : 1,
            expireAt: date
        });


        return res.status(201).json({ success: true, message: 'Server maintenance mode activated' });
    } catch (err: any) {
        console.log(err.message);
        return res.status(500).json({ success: false, message: err.message });
    }


});

export default router;