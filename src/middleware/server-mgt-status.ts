import ServerMnt from "../models/serv-mnt";
import { resolverErrorChecker, loginReqAccType } from "../util/helper";


export default async (req: any, res: any, next: any) => {
    const mgtState = await ServerMnt.find();
    if (1 > mgtState.length) {
        return next();
    }
    const result = await loginReqAccType(req, mgtState[0]);
    req.accType = result.accType || req.accType;   // set the logged in request acctype. if null keep the existing.
    console.log('auth accType: ', req.accType, '. login request accType: ', result.accType, Date.now() >= mgtState[0].expireAt.getTime());
    try {
        resolverErrorChecker({ condition: !req.isAuth && !req.accType, code: 500, message: `Server busy, try again later after ms: ${mgtState[0].expireAt.getTime()}` });
        resolverErrorChecker({
            condition: mgtState[0].level === 2 && req.accType !== 'super_admin',
            code: 500,
            message: `Server busy, try again later after ms: ${mgtState[0].expireAt.getTime()}`
        });

        resolverErrorChecker({
            condition: mgtState[0].level === 1 && !req.accType.endsWith('admin'),
            code: 500,
            message: `Server busy, try again later after ms: ${mgtState[0].expireAt.getTime()}`
        });

    } catch (err: any) {
        console.log(err);
        return res.status(err.statusCode).json({ error: true, message: err.message });
    }

    next();
};