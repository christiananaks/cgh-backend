import jwt from 'jsonwebtoken';

import User from '../models/user';
import Options from '../models/options';
import Currency from '../models/currency';
import { blacklistToken } from '../util/helper';


export default async (req: any, res: any, next: any) => {
    try {
        const authHeader = req.get('Authorization');

        // currency header is added to request on client-side
        let currency = req.get('Currency');
        if (!currency) {
            const defaultCurrency = await Options.find().populate('defaultCurrency.currency', 'currency rate');
            currency = defaultCurrency[0].defaultCurrency.currency;

        } else {
            currency = await Currency.findOne({ currency: currency });
        }

        if (!currency) {
            throw new Error('Error: Currency is not set in header and not found in DB!');
        }

        req.currency = currency;

        // special case where we want non registered user to be able to make payment
        if (req.body.query && (req.body.query as string).includes('postCheckout')) {
            req.guestUser = true;
            return next();
        }

        if (!authHeader) {
            req.isAuth = false;
            return next();
        }

        let decodedToken: any;

        const token = authHeader.split(' ')[1];
        await blacklistToken(token, true);  // checks if access token is blacklisted

        try {
            decodedToken = jwt.verify(token, `${process.env.ACCESS_TOKEN_PRIVATE_KEY}`);
        } catch (err: any) {
            console.log(err);
            req.isAuth = false;
            return next();
        }

        if (!decodedToken) {
            req.isAuth = false;
            return next();
        }

        const user = await User.findById(decodedToken.userId);
        if (user && !user.refreshToken) {    // you came this far without a refresh token, better luck next time ;)
            req.isAuth = false;
            return next();
        }

        req.token = token;
        req.user = user;
        req.userId = decodedToken.userId;
        req.role = decodedToken.role;
        req.isAuth = true;
        next();

    } catch (err) {
        next(err);
    }
};
