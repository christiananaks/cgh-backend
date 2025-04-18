import { Router } from "express";

import ServerMnt from "../models/serv-mnt";
import { resolverErrorChecker } from "../util/helper";
import User from "../models/user";



const router = Router();
// should come after auth & refreshT MW cos we want only authorized request to make it here.
router.post('/serv-management', async (req: any, res, next) => {
    const allowedUsers = ['admin', 'super_admin'];
    const mgtState = await ServerMnt.find();


    try {
        resolverErrorChecker({ condition: !req.isAuth, code: 401, message: 'Please login to continue.' });
        resolverErrorChecker({ condition: mgtState.length > 0, code: 409, message: "Can't complete your request until active management session ends." });
        resolverErrorChecker({ condition: !allowedUsers.includes(req.accType), code: 403, message: 'user is unauthorized.' });
        resolverErrorChecker({
            condition: req.body.minutes && req.body.minutes <= 10,
            message: 'Duration must be 11 minutes or more.',
            code: 422
        });


        // where the specific minutes may have been provided
        const minutes = req.body.minutes || 600000;

        const user = await User.findById(req.userId);

        // const verifiedRTkn: any = jwt.verify(user!.refreshToken!, `${process.env.REFRESH_TOKEN_PRIVATE_KEY}`);    // user would be logged in before this executes so there must be refresh token

        // 60,000ms = 1m   // so we calculate the total minutes and add to present time to get expireAt Date
        const date = Date.now() + (minutes * 60000);
        const isSuperAdmin = req.accType === 'super_admin';
        // const rTExpiryTime = new Date(new Date(verifiedRTkn.eTime).valueOf() + 18000000).valueOf();
        // resolverErrorChecker({ condition: Date.now() >= rTExpiryTime, code: 500, message: 'Please sign out and login again to start new session.' });

        const deductFromTime = 1000 * 60 * 10;  // 10m

        const duration = Date.now() + 600000;
        console.log(new Date(date - Date.now()).getMinutes(), 'minutes left');


        await ServerMnt.create({
            startedBy: req.user._id,
            status: true,
            access: isSuperAdmin ? 'super_admin' : 'admin',
            level: isSuperAdmin ? 2 : 1,
            expireAt: date
        });


        return res.status(201).json({ success: true, message: 'Server maintenance mode activated' });
    } catch (err: any) {
        console.log(err.message);
        return res.status(500).json({ success: false, message: err.message });
    }


});

export default router;