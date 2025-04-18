import jwt from "jsonwebtoken";
import { Router } from "express";

import User from "../models/user";
import { resolverErrorChecker } from "../util/helper";



const router = Router();

export default router.get('/get-token', async (req, res, next) => {

    // this function responds with a token, if the received access token is still valid it will use it. 
    // else the users refresh token would be verified and used to issue a new access token.
    const authHeader = req.get('Authorization');


    if (!authHeader) {
        return res.status(403).json({ error: true, message: "Please sign in to continue." });
    }
    const decodedToken: any = jwt.decode(authHeader.split(' ')[1]);
    if (!decodedToken) {
        const error: { message: string, statusCode?: number } = new Error('Please sign in to continue');
        error.statusCode = 403;
        return next(error);
    }
    // decode token and use the userid to get that users refreshToken
    const foundUser: any = await User.findById(decodedToken.userId);

    if (!foundUser) {
        return res.status(404).json({ error: true, message: "Error: bad request. " });
    }

    const tokens = [
        { token: authHeader.split(' ')[1], key: `${process.env.ACCESS_TOKEN_PRIVATE_KEY}`, type: 'Bearer access token' },
        { token: foundUser.refreshToken || 'null', key: `${process.env.REFRESH_TOKEN_PRIVATE_KEY}`, type: 'Bearer refresh token' }
    ];

    var accessToken: string | undefined;
    var newRefreshTk: string | undefined;
    for (let obj of tokens) {
        try {
            jwt.verify(obj.token, obj.key);
            if (obj.type.includes('refresh')) {
                // executes when only refresh token passes verification
                accessToken = jwt.sign({
                    userId: foundUser.id,
                    email: foundUser.email,
                    userstats: foundUser.userstats,
                    accType: foundUser.accInfo.accType
                }, `${process.env.ACCESS_TOKEN_PRIVATE_KEY}`, { expiresIn: '3h' });
                newRefreshTk = jwt.sign({
                    userId: foundUser.id,
                }, `${process.env.REFRESH_TOKEN_PRIVATE_KEY}`, { expiresIn: '5h' });
                foundUser.refreshToken = newRefreshTk;
                foundUser.save();
                console.log('renewed user refreshToken and issued new access token!');
                break;
            } else {
                // we enter the else block if the auth header access token is still valid
                accessToken = authHeader.split(' ')[1]; // return back existing valid access token
                console.log('using: %s', obj.type);
                break;
            }
        } catch (err: any) {
            console.log(obj.type, 'failed verification.', err.message);
            if (obj.type.includes('refresh')) {
                return res.status(500).json({ error: true, message: 'token expired or invalid, please login.' });
            }
        }
    }

    res.status(200).json({ token: accessToken });
}
);