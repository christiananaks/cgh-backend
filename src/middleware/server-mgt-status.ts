import ServerMnt from "../models/serv-mnt";
import { resolverErrorChecker, loginReqAccRole } from "../util/helper";


export default async (req: any, res: any, next: any) => {
    const mgtState = await ServerMnt.find();
    if (1 > mgtState.length) {
        return next();
    }
    const result = await loginReqAccRole(req, mgtState[0]);
    req.role = result.role || req.role;   // set the logged in request role. if null keep the existing.
    console.log('auth role: ', req.role, '. login request role: ', result.role, Date.now() >= mgtState[0].expireAt.getTime());
    try {
        resolverErrorChecker({ condition: !req.isAuth && !req.role, code: 500, message: `Server busy, try again later after ms: ${mgtState[0].expireAt.getTime()}` });
        resolverErrorChecker({
            condition: mgtState[0].level === 2 && req.role !== 'superuser',
            code: 500,
            message: `Server busy, try again later after ms: ${mgtState[0].expireAt.getTime()}`
        });

        resolverErrorChecker({
            condition: mgtState[0].level === 1 && !['admin', 'superuser'].includes(req.role),
            code: 500,
            message: `Server busy, try again later after ms: ${mgtState[0].expireAt.getTime()}`
        });

    } catch (err: any) {
        console.log(err);
        return res.status(err.statusCode).json({ error: true, message: err.message });
    }

    next();
};