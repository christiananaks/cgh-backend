import fs from 'fs';
import crypto from 'crypto';

import bcrypt from 'bcrypt';
import validator from 'validator';

//@ts-ignore
import tldList from 'tld-list';

import Product, { ProductData } from "../../models/product";
import { CtxArgs, ParentObjectData } from "../../models/type-def";
import Categories from "../../models/category";
import Post from "../../models/post";
import User, { AccountInfo, UserStats } from "../../models/user";
import AdminKey, { AccessData, accessKeysFile } from '../../models/admin-keys';
import { activityReg, calPrice, createTokens, resUserstats, resolverErrorChecker } from '../../util/helper';
import ResetPassword from '../../models/reset-password';
import TrendingGames from '../../models/trending-games';
import GameDownload from '../../models/game-download';
import { ICurrency } from '../../models/currency';
import GameRepair from '../../models/game-repair';
import GameRent from '../../models/game-rent';
import GameSwap from '../../models/game-swap';
import Mailing from '../../models/mailing';



interface CatParentData {
    catTitle: string;
}

export default {
    createUser: async ({ userQueryInput }: ParentObjectData, { req }: CtxArgs) => {
        const firstName = userQueryInput.firstName.trim()[0].toUpperCase() + userQueryInput.firstName.trim().substring(1).toLowerCase();
        const lastName = userQueryInput.lastName.trim()[0].toUpperCase() + userQueryInput.lastName.trim().substring(1).toLowerCase();
        const username = userQueryInput.username?.trim() || firstName.at(0)! + lastName.at(0) + new Date().toISOString().split('.')[1];
        const email = userQueryInput.email.trim().toLowerCase();
        const phone = userQueryInput.phone?.trim();
        const password = userQueryInput?.password;
        const profilePic = userQueryInput.profilePic;
        const gamingId = userQueryInput.gamingIdHandle ? { gamingIdHandle: userQueryInput.gamingIdHandle, platform: userQueryInput.platform } : null;
        const myGames = userQueryInput.myGames || [];

        resolverErrorChecker({
            condition: !validator.isAlpha(firstName[0]) || !validator.isLength(firstName, { min: 3, max: 16 }),
            message: "Invalid input: 'Firstname'",
            code: 422
        });


        resolverErrorChecker({
            condition: !validator.isAlpha(lastName[0]) || !validator.isLength(lastName, { min: 3, max: 16 }),
            message: "Invalid input: 'Lastname'",
            code: 422
        });

        resolverErrorChecker({
            condition: username.includes(' ') || !validator.isLength(username, { min: 5, max: 16 }),
            message: username.includes(' ') ? 'Invalid username: blankspace(s) detected!' : 'Invalid input: No of characters must between 5-16 letters.',
            code: 422
        });

        resolverErrorChecker({
            condition: !validator.isEmail(email, {
                allow_underscores: true,
            }) || !tldList.includes(email.split('.').pop()),
            message: 'Please enter a valid email address.',
            code: 422
        });

        if (phone) {
            resolverErrorChecker({
                condition: !validator.isMobilePhone(phone, "en-NG"),
                message: 'Invalid phone number.',
                code: 422
            });
        }

        resolverErrorChecker({
            condition: !validator.isStrongPassword(password, {
                minLength: 6,
                minSymbols: 0,
                minUppercase: 1,
                minNumbers: 1,
            }),
            message: 'Password must contain atleast one uppercase letter, a number and should be greater than 5 characters.',
            code: 422
        });

        const existingUser = await User.findOne({ $or: [{ email: email }, { 'accInfo.phone': phone || '1234567890' }] });

        try {
            if (existingUser) {
                const isSameEmail = existingUser.email === email;
                const err = new Error(isSameEmail ? 'User already exists!' : 'Phone number already exists!');
                Object.assign(err, { statusCode: 422 });
                throw err;
            }

            if (password !== userQueryInput.confirmPassword) {
                const err = new Error('Passwords do not match!');
                Object.assign(err, { statusCode: 422 });
                throw err;
            }

            const hashedPw = await bcrypt.hash(password, 12);


            const accessData: AccessData[] = await AdminKey.getAdminKeys();
            const matchedKeyIndex = accessData.findIndex(data => data.access === username.slice(username.length - 5));
            const isSuperUser = req.role === 'superuser' && req.isSuperReq === true;     // if req.super is true the function was called from superuser
            console.log('isSuperReq: ', req.isSuperReq, 'req.role: ', req.role);

            // set here cos we pass this via req in input args for createAdminUser() args resolver
            let accInfo: AccountInfo = {
                role: isSuperUser ? 'admin' : undefined,    // we set fallback value to undefined inorder to force the schema to use the default value we set in our schema
                creator: isSuperUser ? 'superuser' : undefined,
                phone: phone,
                gamingId: gamingId,
                activityReg: activityReg
            };

            if (!isSuperUser && username.length > 9 && matchedKeyIndex > -1 && !accessData[matchedKeyIndex].user) {
                accInfo.role = 'admin';
            }

            Mailing.sendEmail(email, 'Sign Up Succeeded', '<h1>Thank You for joining the Classified Gamers, you successfully signed up!<h1/>').catch(err => console.log(err.toString()));

            let user = new User({
                firstName: firstName,
                lastName: lastName,
                username: username,
                profilePic: profilePic,
                email: email,
                password: hashedPw,
                accInfo: accInfo,
                myGames: myGames
            });

            user = await user.save();

            if (matchedKeyIndex > -1 && !accessData[matchedKeyIndex].user) {
                accessData[matchedKeyIndex].user = email;
                fs.writeFile(accessKeysFile, JSON.stringify(accessData), err => {
                    if (err) console.log(err);
                });
            }

            return { success: true, message: 'Account created successfully' };

        } catch (err: any) {
            var error: any;
            // for mongodb database conflict error
            if (err.errorResponse && err.code == 11000) {
                const errRes = err.errorResponse;
                const field = Object.keys(errRes.keyValue)[0];

                error = new Error(`${field} already exists`);
                error.statusCode = 409;
                throw error;

            } else if (err.errorResponse) {  // other mongodb database error
                error = new Error(`An error occurred. Info: ${err.message}`);
                error.statusCode = 500;
                throw error;
            }
            // console.log('original mongoose error:', '\n\r', err._message, err.errors[Object.keys(err.errors)[0]]['properties']['message'], '\n');

            err.statusCode = err.statusCode || 500;
            throw err;
        }
    },

    login: async ({ email, password }: ParentObjectData, { req }: CtxArgs) => {

        const enteredEmail = email.trim().toLowerCase();
        const enteredPassword = password;

        resolverErrorChecker({
            condition: !validator.isEmail(enteredEmail) || !tldList.includes(enteredEmail.split('.').pop()),
            message: 'Email address is invalid.',
            code: 422
        });

        resolverErrorChecker({ condition: validator.isEmpty(enteredPassword) || !validator.isLength(enteredPassword, { min: 6 }), message: 'Password too short.', code: 422 });
        let foundUser = await User.findOne({ email: enteredEmail });

        if (!foundUser) {
            const error = new Error('The entered email or password is incorrect.');
            Object.assign(error, { statusCode: 401 });
            throw error;
        }

        const matchPw = await bcrypt.compare(enteredPassword, foundUser!.password);

        if (!matchPw) {
            const error: { [key: string]: any } = new Error('The entered username or password is incorrect.');
            error.statusCode = 401;
            throw error;
        }
        const accessData = await AdminKey.getAdminKeys();
        const matchedKeyIndex = accessData.findIndex(data => data.access === foundUser!.username.slice(foundUser!.username.length - 5));
        const creator = foundUser.accInfo.creator === 'superuser';

        const userAccCheck = !creator && foundUser.accInfo.role === 'admin';
        if (userAccCheck && 0 > matchedKeyIndex || userAccCheck && accessData[matchedKeyIndex].user !== foundUser.email) {
            foundUser.accInfo.role = 'standard';
        }

        const { stats } = foundUser;

        const userstatsData = resUserstats(stats);

        const tokens = createTokens(foundUser!);
        foundUser.refreshToken = tokens.refreshToken;

        foundUser = await foundUser.save();

        console.log('AccessToken: ', tokens.accessToken);


        return {
            userId: foundUser.id, ...foundUser._doc, stats: userstatsData, purchaseHistory: JSON.stringify(foundUser.purchaseHistory),
            accessToken: tokens.accessToken,
        };

    },
    resetPassword: async ({ email }: ParentObjectData, { }: CtxArgs,) => {
        const userEmail = email.trim().toLowerCase();
        resolverErrorChecker({
            condition: !validator.isEmail(userEmail, {
                allow_underscores: true,
            }) || !tldList.includes(email.split('.').pop()),
            message: 'Please enter a valid email address.',
            code: 422
        });
        const foundUser = await User.findOne({ email: userEmail });
        resolverErrorChecker({ condition: !foundUser, message: `Sorry we could not find an account linked to the entered email: ${userEmail}.`, code: 404 });

        var token;
        try {
            const genToken = crypto.randomBytes(32);
            token = genToken.toString('hex');

            const passwordReset = new ResetPassword({
                userId: foundUser!.id,
                token: token
            });

            passwordReset.save();
        } catch (err: any) {
            console.log(err.message);
            return { success: false, message: 'Password reset not successful :(' };
        }

        // to add frontend password reset page deep link. // the frontend initState would then take that token and use it to send a request to `/get-new-password/token`
        const mailBody = `
        <p>You requested a password reset</p>
        <p>Click the <a href=http://app-deep-link/${token}>link</a> to set a new password.</p>
        `;

        try {
            await Mailing.sendEmail(foundUser!.email, 'Password Reset', mailBody);
        } catch (err: any) {
            console.log(err);
            return { success: false, message: 'Password reset not successful :(' };
        }
        return { success: true, message: 'Password reset link have been sent to your email.' };
    },
    postNewPassword: async ({ userQueryInput }: ParentObjectData, { }: CtxArgs) => {
        // token is reset password token received in user email.
        const { userId, token, newPassword, confirmPassword } = userQueryInput;
        const foundToken = await ResetPassword.findOne({ token: token });
        resolverErrorChecker({ condition: !foundToken, message: 'Reset password token expired. Please go back to Reset Password page to attempt the process again.', code: 404 });

        const foundUser = await User.findById(userId);
        if (!foundUser) {
            const error: { [key: string]: any } = new Error('User not found  :(');
            error.statusCode = 404;
            throw error;
        }

        resolverErrorChecker({
            condition: !validator.isStrongPassword(newPassword, {
                minLength: 6,
                minSymbols: 0,
                minUppercase: 1,
                minNumbers: 1,
            }),
            message: 'Password must contain atleast one uppercase letter, a number and should be greater than 5 characters.',
            code: 422
        });
        resolverErrorChecker({ condition: newPassword !== confirmPassword, message: 'Passwords do NOT match', code: 422 });

        const isSamePW = await bcrypt.compare(newPassword, foundUser.password);
        resolverErrorChecker({ condition: isSamePW, message: 'This password is compromised. Please create another password.', code: 422 });

        const enteredPassword = await bcrypt.hash(newPassword, 12);
        foundUser.password = enteredPassword;
        const mailBody = `
            <p>Dear ${foundUser.lastName},</p>
            <p>Your password have been successfully changed</p>.
        `;
        Mailing.sendEmail(foundUser.email, 'Password Reset Successful', mailBody).catch(err => console.log(err.toString()));
        foundUser.save();
        // await foundToken?.deleteOne();
        await ResetPassword.deleteMany({ userId: userId });
        return { success: true, message: 'Password reset succeeded.' };
    },
    getUsernames: async () => {
        const usernames = await User.find().select('username');

        return usernames.map((user) => user.username);
    },
    getAllCategories: async ({ }: ParentObjectData,) => {
        return await Categories.getDbCategories();
    },
    getAllProducts: async ({ }: ParentObjectData, { req }: CtxArgs) => {
        const currency = req.currency as ICurrency;

        let products = await Product.getProducts();
        if (currency.currency === 'USD') {
            return products;

        } else {
            products = products.map((prod) => {
                const price = calPrice(+prod.price, currency);
                return { ...prod, price: price.toString() };

            });

            return products;
        }
    },
    getProduct: async ({ prodId }: ParentObjectData, { req }: CtxArgs) => {

        return await Product.getProduct(prodId, req.currency);
    },
    getCatProducts: async ({ catTitle }: CatParentData, { req }: CtxArgs) => {
        const currency = req.currency as ICurrency;
        let catProducts = await Categories.getCategoryProds(catTitle, currency);


        return catProducts;
    },
    getPost: async () => {

        return await Post.getPost();
    },
    getTrendingGames: async () => {
        const trendingGames = await TrendingGames.getTrendingGames();
        return trendingGames;
    },
    getTopRatedGames: async ({ }, { req }: CtxArgs) => {
        const currency = req.currency;
        const gameDiscProds = await Categories.getCategoryProds('Game Disc', currency);
        const topRatedGames = await TrendingGames.find({ rating: { $gt: 3 } });

        if (1 > gameDiscProds.length && 1 > topRatedGames.length) {
            return [];
        }

        let result = gameDiscProds.filter((disc: any) => {
            const foundGameIdx = topRatedGames.findIndex((game) => game.title.toLowerCase() === disc.title.toLowerCase());

            return foundGameIdx > -1;

        });

        return result;
    },
    getTodayDeals: async ({ }, { req }: CtxArgs) => {
        const currency = req.currency;
        const categoryProducts = await Categories.find().populate('subcategoryData.$*');

        const filteredProds: ProductData[] = [];
        categoryProducts.forEach((doc) => {
            const subcategoryProducts = Array.from(doc.subcategoryData.values());

            subcategoryProducts.forEach((objArr: unknown[]) => {
                const products = objArr as ProductData[];

                if (products.length > 0) {
                    products.sort((prod1, prod2) => +prod1.price - +prod2.price);
                    products[0].price = calPrice(+products[0].price, currency);
                    filteredProds.push(products[0]);

                }
            });
        });

        return filteredProds;
    },
    getPopularOffers: async ({ }, { req }: CtxArgs) => {
        const currency = req.currency;
        let popularProd = await Categories.getCategoryProds('Popular', currency);

        return popularProd;
    },
    getGameDownloads: async ({ }, { req }: CtxArgs) => {
        let gameDownloads = await GameDownload.find();

        if (1 > gameDownloads.length) {
            return [];
        }

        gameDownloads.forEach((dl) => {
            dl.price = calPrice(dl.price, req.currency);
        });

        return gameDownloads;
    },
    getGameDownloadPackage: async ({ platform, version, serialNumber }: ParentObjectData, { req }: CtxArgs) => {

        let dlBundles = [];
        if (platform === "NINTENDO SWITCH" && serialNumber) {
            const validSN = ['XAW', 'XAJ'];

            resolverErrorChecker({ condition: !validator.isLength(serialNumber, { min: 14, max: 14 }), message: 'Incorrect serial number!', code: 422 });

            resolverErrorChecker({ condition: !validSN.includes(serialNumber.slice(0, 3).toUpperCase()), message: 'Unsupported Model.', code: 500 });

            const snData: Map<string, number> = new Map([['XAW1', 1007800], ['XAW4', 4001100], ['XAW7', 7001780], ['XAJ1', 1003000], ['XAJ4', 4005000], ['XAJ7', 7004000]]);
            serialNumber = serialNumber.slice(0, 10);   // shortened serialNumber to 10 chars 
            const sn = +serialNumber.substring(3);  // extract 7 digit numbers after the starting word `XA(X)` of entered serialNumber 

            resolverErrorChecker({ condition: sn > snData.get(serialNumber.slice(0, 4).toUpperCase())!, message: 'Not hackable.', code: 500 });

            dlBundles = await GameDownload.find({ platform: platform });

            if (1 > dlBundles.length) {
                return [];
            }

            dlBundles.forEach(dl => {
                dl.price = calPrice(dl.price, req.currency);
            });

            return dlBundles;
        }


        if (platform === 'PS4' && version && version > 11.00) {
            dlBundles = await GameDownload.find({ platform: platform, installType: 'PACKAGE COLLECTION' });
            if (1 > dlBundles.length) {
                return [];
            }
            dlBundles.forEach(dl => {
                dl.price = calPrice(dl.price, req.currency);
            });

            return dlBundles;
        }

        dlBundles = await GameDownload.find({ platform: platform });
        if (1 > dlBundles.length) {
            return [];
        }
        dlBundles.forEach(dl => {
            dl.price = calPrice(dl.price, req.currency);
        });

        return dlBundles;
    },
    getRepairs: async ({ }: ParentObjectData, { req }: CtxArgs) => {
        const repairs = await GameRepair.find();
        if (1 > repairs.length) {
            return [];
        }
        repairs.forEach((obj) => {
            obj.price = calPrice(obj.price, req.currency);
        });

        return repairs;
    },
    getGameSwap: async ({ }, { req }: CtxArgs) => {

        const swapDeals = await GameSwap.find();

        if (1 > swapDeals.length) return [];

        swapDeals.forEach((doc) => {
            doc.swapFee = calPrice(doc.swapFee, req.currency);
        });

        return swapDeals;
    },
    gameSwapInfo: async ({ id }: ParentObjectData, { req }: CtxArgs) => {

        const swapDeal = await GameSwap.findById(id);
        if (!swapDeal) {
            const error: { [key: string]: any } = new Error('Error: Content not found!');
            error.statusCode = 404;
            throw error;
        }

        return { ...swapDeal._doc, swapFee: calPrice(swapDeal.swapFee, req.currency), id: swapDeal.id };
    },
    getGameRent: async ({ }, { req }: CtxArgs) => {
        const allGameRent = await GameRent.find();

        if (1 > allGameRent.length) return [];


        const res = allGameRent.map((doc) => {
            return { ...doc._doc, rate: calPrice(doc.rate, req.currency), id: doc.id };
        });

        return res;
    },
    gameRentInfo: async ({ id }: ParentObjectData, { req }: CtxArgs) => {
        const foundGameRent = await GameRent.findById(id);

        resolverErrorChecker({ condition: !foundGameRent, message: 'Game Rent not found :(', code: 404 });

        return { ...foundGameRent!._doc, rate: calPrice(foundGameRent!.rate, req.currency), id: foundGameRent!.id }

    }
}