import jwt from "jsonwebtoken";
import { Router } from "express";

import User from "../models/user";

const router = Router();

export default router.post('/refresh-token', async (req, res, next) => {

    const authHeader = req.get('Authorization');

    if (!authHeader) {
        return res.status(500).json({ error: true, message: "bad request, invalid request token" });
    }

    const rTkn = authHeader.split(' ')[1];

    const foundUser = await User.findOne({ refreshToken: rTkn });
    if (!foundUser) {
        return res.status(404).json({ error: true, message: "Error: bad request. " });
    }

    try {
        jwt.verify(rTkn, `${process.env.REFRESH_TOKEN_PRIVATE_KEY}`);
        const payload = {
            userId: foundUser.id,
            email: foundUser.email,
            userstats: foundUser.userstats,
            accType: foundUser.accInfo.accType
        };
        const accessToken = jwt.sign(payload, `${process.env.ACCESS_TOKEN_PRIVATE_KEY}`, { expiresIn: '1h' });
        const refreshToken = jwt.sign({
            userId: foundUser.id,  // in order to limit refresh token to be only used for requesting access token.
        }, `${process.env.REFRESH_TOKEN_PRIVATE_KEY}`, { expiresIn: '5h' });
        foundUser.refreshToken = refreshToken;
        foundUser.save();
        console.log('new access token: ', accessToken, '\n \nnew refresh token: ', refreshToken);

        return res.status(200).json({ accessToken, refreshToken });

    } catch (err: any) {
        return res.status(403).json({ message: err.message });
    }
});