import jwt from "jsonwebtoken";
import { Router } from "express";

import User from "../models/user";
import { createTokens, resolverErrorChecker } from "../util/helper";



const router = Router();

export default router.get('/get-token', async (req, res, next) => {

    const authHeader = req.get('Authorization');


    if (!authHeader) {
        return res.status(401).json({ error: true, message: "Please sign in to continue." });
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
        return res.status(400).json({ error: true, message: "Error: bad request. " });
    }

    var newAccessToken: string | undefined;
    try {
        jwt.verify(foundUser.token, process.env!.REFRESH_TOKEN_PRIVATE_KEY!);
        const tokens = createTokens(foundUser!);
        newAccessToken = tokens.accessToken;
        foundUser.refreshToken = tokens.refreshToken;
        foundUser.save();
        console.log('renewed user refreshToken and issued new access token!');
    } catch (err: any) {
        console.log('refresh token failed verification. \n', err.message);
        return res.status(500).json({ error: true, message: 'token expired or invalid, please login.' });
    }

    res.status(200).json({ token: newAccessToken });
}
);