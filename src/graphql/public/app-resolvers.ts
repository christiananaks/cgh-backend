import fs from 'fs';
import crypto from 'crypto';

import bcrypt from 'bcrypt';
import validator from 'validator';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';


//@ts-ignore
import tldList from 'tld-list';

import Product, { ProductData } from "../../models/product.js";
import { CtxArgs, InputArgs } from "../../models/type-def.js";
import Category from "../../models/category.js";
import Post from "../../models/post.js";
import User, { AccountInfo } from "../../models/user.js";
import AdminKey, { AccessData, accessKeysFile } from '../../models/admin-keys.js';
import { GraphQLCustomError, activityReg, calPrice, createTokens, isProductionEnv, resUserstats, errorChecker } from '../../util/helper.js';
import ResetPassword from '../../models/reset-password.js';
import TrendingGames from '../../models/trending-games.js';
import GameDownload from '../../models/game-download.js';
import { ICurrency } from '../../models/currency.js';
import GameRent from '../../models/game-rent.js';
import GameSwap from '../../models/game-swap.js';
import Mailing, { primarySender } from '../../models/mailing.js';
import { paths } from '../../util/helper.js';
import Kyc from '../../models/kyc.js';
import { localUpload, s3UploadObject } from '../../util/file-storage.js';
import InAppNotice from '../../models/in-app-notice.js';
import { Slide } from '../../models/slide.js';



interface CatParentData {
    catTitle: string;
}


const Query = {
    login: async (parent: any, { email, password }: InputArgs, { req, res }: CtxArgs, { }) => {

        const enteredEmail = email.trim().toLowerCase();
        const enteredPassword = password;

        errorChecker({
            condition: !validator.isEmail(enteredEmail) || !tldList.includes(enteredEmail.split('.').pop()),
            message: 'Email address is invalid.',
            code: 422
        });

        errorChecker({ condition: validator.isEmpty(enteredPassword) || !validator.isLength(enteredPassword, { min: 6 }), message: 'Password too short.', code: 422 });
        let foundUser = await User.findOne({ email: enteredEmail });


        errorChecker({ condition: !foundUser, message: 'The entered email or password is incorrect.', code: 401 });
        foundUser = foundUser!;

        const matchPw = await bcrypt.compare(enteredPassword, foundUser.password);

        errorChecker({ condition: !matchPw, message: 'The entered username or password is incorrect.', code: 401 });
        const accessData = await AdminKey.getAdminKeys();
        const matchedKeyIndex = accessData.findIndex(data => data.access === foundUser!.username.slice(foundUser!.username.length - 5));
        const creator = foundUser.accInfo.creator === 'superuser';

        const userAccCheck = !creator && foundUser.accInfo.role === 'admin';
        if (userAccCheck && 0 > matchedKeyIndex || userAccCheck && accessData[matchedKeyIndex].user !== foundUser.email) {
            foundUser.accInfo.role = 'standard';
        }

        const tokens = createTokens(foundUser!);

        foundUser.refreshToken = tokens.refreshToken;

        foundUser.stats = User.updateUserStats(foundUser!.stats).stats;

        const updatedUserData = await foundUser.save();
        const userstatsData = resUserstats(updatedUserData.stats);

        return {
            userId: updatedUserData.id, ...updatedUserData._doc, stats: userstatsData, purchaseHistory: JSON.stringify(updatedUserData.purchaseHistory),
            accessToken: tokens.accessToken, refreshToken: tokens.refreshToken
        };

    },
    getToken: async (parent: any, { }, { req }: CtxArgs) => {
        const authHeader = req.get('Authorization');

        errorChecker({ condition: !authHeader, message: 'Error: Invalid token!', code: 401 });
        const refreshToken = authHeader!.split(' ')[1];
        console.log('token from device---', refreshToken.slice(refreshToken.length - 10));
        const foundUser = await User.findOne({ refreshToken: refreshToken });
        errorChecker({ condition: !foundUser, message: 'Error: Invalid token!', code: 401 });
        try {
            jwt.verify(foundUser!.refreshToken!, process.env!.REFRESH_TOKEN_PRIVATE_KEY!);
        } catch (err: any) {
            foundUser!.refreshToken = undefined;
            await foundUser!.save();
            throw new GraphQLCustomError('Error: Expired token', 401);
        }

        const tokens = createTokens(foundUser!);
        foundUser!.refreshToken = tokens.refreshToken;
        await foundUser!.save();
        console.log('renewed user refreshToken and issued new access token!');

        return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };

    },

    resetPassword: async (parent: any, { email }: InputArgs, { }: CtxArgs) => {
        const userEmail = email.trim().toLowerCase();
        errorChecker({
            condition: !validator.isEmail(userEmail, {
                allow_underscores: true,
            }) || !tldList.includes(email.split('.').pop()),
            message: 'Please enter a valid email address.',
            code: 422
        });
        const foundUser = await User.findOne({ email: userEmail });
        errorChecker({ condition: !foundUser, message: `Sorry we could not find an account linked to the entered email: ${userEmail}.`, code: 404 });

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
            await Mailing.sendEmail(primarySender, foundUser!.email, 'Password Reset', mailBody);
        } catch (err: any) {
            console.log(err);
            return { success: false, message: 'Password reset not successful :(' };
        }
        return { success: true, message: 'Password reset link have been sent to your email.' };
    },

    getUsernames: async (parent: any,) => {
        const usernames = await User.find().select('username');

        return usernames.map((user) => user.username);
    },
    getAllCategories: async (parent: any, { }: InputArgs) => {

        return await Category.getDbCategories();
    },

    getAllProducts: async (parent: any, { }, { req }: CtxArgs) => {
        const currency = req.currency as ICurrency;
        let products = await Product.getProducts(currency);
        return products;
    },
    getRecommendedProducts: async (parent: any, { prodId }: InputArgs, { req }: CtxArgs) => {
        const { currency } = req;

        let foundProd = await Product.findById(prodId);
        errorChecker({ condition: !foundProd, message: 'Product was not found!', code: 404 });
        foundProd = foundProd!;

        let foundCategory = await Category.findOne({ title: foundProd.category, [`subcategoryData.${foundProd.subcategory}`]: { $exists: true } })
            .populate(`subcategoryData.${foundProd.subcategory}`);
        errorChecker({ condition: !foundCategory, message: 'Category/Subcategory not found!', code: 404 });

        foundCategory = foundCategory!;
        let products: ProductData[] = (foundCategory.subcategoryData.get(foundProd.subcategory)! as any);

        // return all product except the product the user is viewing
        products = products.filter((prod) => prod.id !== prodId);

        const result = products.map((prod) => {

            const price = calPrice(+prod.price, currency);
            return { id: (prod as any)._id.toString(), ...prod._doc, price: price.toString() };
        });

        return result;
    },
    getProduct: async (parent: any, { prodId }: InputArgs, { req }: CtxArgs) => {

        return await Product.getProduct(prodId, req.currency);
    },
    getCatProducts: async (parent: any, { catTitle }: CatParentData, { req }: CtxArgs) => {
        const currency = req.currency as ICurrency;
        let catProducts = await Category.getCategoryProds(catTitle, currency);


        return catProducts;
    },
    getPost: async (parent: any,) => {

        return await Post.getPost();
    },
    getTrendingGames: async (parent: any,) => {
        const trendingGames = await TrendingGames.getTrendingGames();
        return trendingGames;
    },
    getTopRatedGames: async (parent: any, args: InputArgs, { req }: CtxArgs) => {
        const currency = req.currency;
        const gameDiscProds = await Category.getCategoryProds('Game Disc', currency);
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
    getTodayDeals: async (parent: any, { }, { req }: CtxArgs) => {
        const currency = req.currency;
        const categoryProducts = await Category.find().populate('subcategoryData.$*');

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
    filterProductsByTag: async (parent: any, { tag }: InputArgs, { req }: CtxArgs) => {
        const currency = req.currency;
        let products = await Product.getProducts(currency, tag.toLowerCase());

        return products;
    },
    getGameDownloads: async (parent: any, { }, { req }: CtxArgs) => {
        let gameDownloads = await GameDownload.find();

        if (1 > gameDownloads.length) {
            return [];
        }

        gameDownloads.forEach((dl) => {
            dl.price = calPrice(dl.price, req.currency);
        });

        return gameDownloads;
    },
    getGameDownloadPackage: async (parent: any, { platform, version, serialNumber }: InputArgs, { req }: CtxArgs) => {

        let dlBundles = [];
        if (platform === "NINTENDO SWITCH" && serialNumber) {
            const validSN = ['XAW', 'XAJ'];

            errorChecker({ condition: !validator.isLength(serialNumber, { min: 14, max: 14 }), message: 'Incorrect serial number!', code: 422 });

            errorChecker({ condition: !validSN.includes(serialNumber.slice(0, 3).toUpperCase()), message: 'Unsupported Model.', code: 500 });

            const snData: Map<string, number> = new Map([['XAW1', 1007800], ['XAW4', 4001100], ['XAW7', 7001780], ['XAJ1', 1003000], ['XAJ4', 4005000], ['XAJ7', 7004000]]);
            serialNumber = serialNumber.slice(0, 10);   // shortened serialNumber to 10 chars 
            const sn = +serialNumber.substring(3);  // extract 7 digit numbers after the starting word `XA(X)` of entered serialNumber 

            errorChecker({ condition: sn > snData.get(serialNumber.slice(0, 4).toUpperCase())!, message: 'Not hackable.', code: 500 });

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
    getGameSwap: async (parent: any, { }, { req }: CtxArgs) => {

        const swapDeals = await GameSwap.find();

        if (1 > swapDeals.length) return [];

        swapDeals.forEach((doc) => {
            doc.swapFee = calPrice(doc.swapFee, req.currency);
        });

        return swapDeals;
    },
    gameSwapInfo: async (parent: any, { id }: InputArgs, { req }: CtxArgs) => {

        const swapDeal = await GameSwap.findById(id);
        if (!swapDeal) {
            throw new GraphQLCustomError('Error: Content not found!', 404);
        }

        return { ...swapDeal._doc, swapFee: calPrice(swapDeal.swapFee, req.currency), id: swapDeal.id };
    },
    getGameRent: async (parent: any, { }, { req }: CtxArgs) => {
        const allGameRent = await GameRent.find();

        if (1 > allGameRent.length) return [];


        const res = allGameRent.map((doc) => {
            return { ...doc._doc, rate: calPrice(doc.rate, req.currency), id: doc.id };
        });

        return res;
    },
    gameRentInfo: async (parent: any, { id }: InputArgs, { req }: CtxArgs) => {
        const foundGameRent = await GameRent.findById(id);

        errorChecker({ condition: !foundGameRent, message: 'Game Rent not found :(', code: 404 });

        return { ...foundGameRent!._doc, rate: calPrice(foundGameRent!.rate, req.currency), id: foundGameRent!.id }

    },
    getInAppNotice: async (parent: any, { }) => {
        const docs = await InAppNotice.getAllDocs();

        return docs.pop();
    },
    slides: async (parent: any, { }, { req }: CtxArgs) => {

        const slides = await Slide.fetchSlides();

        return slides;
    }
};



const Mutation = {
    createUser: async (parent: any, { userQueryInput }: InputArgs, { req }: CtxArgs) => {
        const firstName = userQueryInput.firstName.trim()[0].toUpperCase() + userQueryInput.firstName.trim().substring(1).toLowerCase();
        const lastName = userQueryInput.lastName.trim()[0].toUpperCase() + userQueryInput.lastName.trim().substring(1).toLowerCase();
        const username = userQueryInput.username?.trim() || firstName.at(0)! + lastName.at(0) + new Date().toISOString().split('.')[1];
        const email = userQueryInput.email.trim().toLowerCase();
        const phone = userQueryInput.phone?.trim();
        const password = userQueryInput?.password;
        const profilePic = userQueryInput.profilePic;
        const gamingId = userQueryInput.gamingIdHandle ? { gamingIdHandle: userQueryInput.gamingIdHandle, platform: userQueryInput.platform } : null;
        const myGames = userQueryInput.myGames || [];

        errorChecker({
            condition: !validator.isAlpha(firstName[0]) || !validator.isLength(firstName, { min: 3, max: 16 }),
            message: "Invalid input: 'Firstname'",
            code: 422
        });


        errorChecker({
            condition: !validator.isAlpha(lastName[0]) || !validator.isLength(lastName, { min: 3, max: 16 }),
            message: "Invalid input: 'Lastname'",
            code: 422
        });

        errorChecker({
            condition: username.includes(' ') || !validator.isLength(username, { min: 5, max: 16 }),
            message: username.includes(' ') ? 'Invalid username: blankspace(s) detected!' : 'Invalid input: No of characters must between 5-16 letters.',
            code: 422
        });

        errorChecker({
            condition: !validator.isEmail(email, {
                allow_underscores: true,
            }) || !tldList.includes(email.split('.').pop()),
            message: 'Please enter a valid email address.',
            code: 422
        });

        if (phone) {
            errorChecker({
                condition: !validator.isMobilePhone(phone, "en-NG"),
                message: 'Invalid phone number.',
                code: 422
            });
        }

        errorChecker({
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
                throw new GraphQLCustomError(isSameEmail ? 'User already exists!' : 'Phone number already exists!', 422);
            }

            errorChecker({ condition: password !== userQueryInput.confirmPassword, message: 'Passwords do not match!', code: 422 });

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

            Mailing.sendEmail(primarySender, email, 'Sign Up Succeeded', '<h1>Thank You for joining the Classified Gamers, you successfully signed up!<h1/>').catch(err => console.log(err.toString()));

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

                throw new GraphQLCustomError(`${field} already exists`, 409);

            } else if (err.errorResponse) {  // other mongodb database error
                throw new GraphQLCustomError(`An error occurred. Info: ${err.message}`);
            }

            err.statusCode = err.statusCode || 500;
            throw err;
        }
    },
    postNewPassword: async (parent: any, { userQueryInput }: InputArgs, { }: CtxArgs) => {
        // token is reset password token received in user email.
        const { userId, token, newPassword, confirmPassword } = userQueryInput;
        const foundToken = await ResetPassword.findOne({ token: token });
        errorChecker({ condition: !foundToken, message: 'Reset password token expired. Please go back to Reset Password page to attempt the process again.', code: 404 });

        const foundUser = await User.findById(userId);
        if (!foundUser) {
            throw new GraphQLCustomError('User not found  :(', 404);
        }

        errorChecker({
            condition: !validator.isStrongPassword(newPassword, {
                minLength: 6,
                minSymbols: 0,
                minUppercase: 1,
                minNumbers: 1,
            }),
            message: 'Password must contain atleast one uppercase letter, a number and should be greater than 5 characters.',
            code: 422
        });
        errorChecker({ condition: newPassword !== confirmPassword, message: 'Passwords do NOT match', code: 422 });

        const isSamePW = await bcrypt.compare(newPassword, foundUser.password);
        errorChecker({ condition: isSamePW, message: 'This password is compromised. Please create another password.', code: 422 });

        const enteredPassword = await bcrypt.hash(newPassword, 12);
        foundUser.password = enteredPassword;
        const mailBody = `
            <p>Dear ${foundUser.lastName},</p>
            <p>Your password have been successfully changed</p>.
        `;
        Mailing.sendEmail(primarySender, foundUser.email, 'Password Reset Successful', mailBody).catch(err => console.log(err.toString()));
        foundUser.save();

        await ResetPassword.deleteMany({ userId: userId });
        return { success: true, message: 'Password reset succeeded.' };
    },
    postFilesUpload: async (parent: any, { uploadPathName, files }: InputArgs, { req }: CtxArgs) => {

        const imageNameArray = [
            'game', 'guide', 'product',
            'profile', 'slide', 'notice',
            'post', 'game-rent', 'game-swap',
            'game-repair', 'game-download'
        ];
        const validPaths = new Map([
            ['documents', { name: ['KYC'], mimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg'], dir: paths.documentDir }],
            ['images', {
                name: imageNameArray, mimeTypes: ['image/jpeg', 'image/jpg', 'image/png'], dir: paths.imageDir
            }],
            ['misc', { name: ['refund', 'in-app-notice', 'others'], mimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg'], dir: paths.miscDir }]
        ]);

        // uploadPathName example => images/product/<ID> // ID can be present if the doc was created before making upload query request
        const fileKind = uploadPathName.split('/')[0];
        const folderName = uploadPathName.split('/')[1]; // or Key part for s3

        // prodId or KYCId
        const id = uploadPathName.split('/').length > 2 && uploadPathName.split('/')[2];

        errorChecker({ condition: !validPaths.get(fileKind) || !validPaths.get(fileKind)!.name.includes(folderName), message: 'Error: Invalid "uploadPathName"!' });
        const pathName = validPaths.get(fileKind)!.dir;

        const uploadedFiles = await Promise.all(files.map(async (file) => {
            errorChecker({ condition: !validPaths.get(fileKind)!.mimeTypes.includes((await file.promise).mimetype), message: 'Error: Invalid file mimetype!' });
            return file.promise
        }));

        const filesURLPath: string[] = [];


        // process files and store them
        if (!isProductionEnv) {
            await localUpload({ id, pathName, folderName, filesURLPath, uploadedFiles });
        } else {
            await s3UploadObject({ id, folderName, filesURLPath, uploadedFiles });
        }

        // for uploads that receive ID in <uploadPathName> query input, we update the respective documents in DB with uploaded file url path
        switch (folderName) {
            case 'KYC':
                await Kyc.findOneAndUpdate({ userId: new Types.ObjectId(id as string) }, { validId: filesURLPath[0], utilityBill: filesURLPath[1] });
                break;
            case 'product':
                await Product.findByIdAndUpdate(id, { imageUrls: filesURLPath });
                break;
        }
        return { success: true, message: 'Files uploaded successfully.', filesURLPath: filesURLPath };
    },
};

export default { Query, Mutation };

