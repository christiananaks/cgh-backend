import jwt from 'jsonwebtoken';

import User from '../models/user';
import Options from '../models/options';
import Currency from '../models/currency';


export default async (req: any, res: any, next: any) => {
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
        const error = new Error('Error: Currency is not set in header and not found in DB!');
        return next(error);
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

    try {
        decodedToken = jwt.verify(token, `${process.env.ACCESS_TOKEN_PRIVATE_KEY}`);  // refreshToken would fail verification here cos we verify with a different key
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
    if (user && !user.refreshToken) {    // you came this far without a refresh token, better luck next time :0
        req.isAuth = false;
        return next();
    }


    req.user = user;
    req.userId = decodedToken.userId;
    req.userstats = decodedToken.userstats;
    req.accType = decodedToken.accType;
    req.eTime = decodedToken.eTime;
    req.isAuth = true;
    next();

};
