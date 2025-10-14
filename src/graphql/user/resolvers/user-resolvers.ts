
import mongoose, { Types } from "mongoose";
import validator from 'validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import Post from "../../../models/post";
import ServerMnt from "../../../models/serv-mnt";
import { initializePayment } from "../../../util/order-payment";
import User, { TShopProduct } from "../../../models/user";
import { resolverErrorChecker, calPrice, createTokens, blacklistToken, resUserstats } from "../../../util/helper";
import { CtxArgs, ParentObjectData } from "../../../models/type-def";
import Product from '../../../models/product';
import Kyc from '../../../models/kyc';
import Order from "../../../models/order";
import Refund from "../../../models/refund";
import Mailing from "../../../models/mailing";



export default {
    getAuthUser: async ({ id }: ParentObjectData, { req }: CtxArgs) => {
        const authHeader = req.get('Authorization');
        resolverErrorChecker({ condition: !authHeader, message: 'Error: Auth error.', code: 401 });

        const user = await User.findById(id);
        resolverErrorChecker({ condition: !user, message: 'User not found :(', code: 404 });

        let tokens: { accessToken: string, refreshToken: string } | null;
        try {
            // jwt.verify() throws an error where token is expired.
            jwt.verify(user!.refreshToken!, `${process.env.REFRESH_TOKEN_PRIVATE_KEY}`);

            const userstats = resUserstats(user!.stats);
            tokens = createTokens(user!);

            user!.refreshToken = tokens.refreshToken;
            user!.save();

            return {
                accessToken: tokens!.accessToken, user: {
                    ...user!._doc, stats: userstats, id: user!.id
                }
            };

        } catch (err: any) {
            const isTokenError = err.toString().toLowerCase().includes('expired');
            if (isTokenError) {
                const error: { [key: string]: any } = new Error('Expired token!');
                error.statusCode = 401;
                throw error;
            }
            throw err;
        }
    },
    getRecommendedProducts: async ({ }, { req }: CtxArgs) => {
        const { isAuth, user, currency } = req;


        if (!isAuth || 1 > user.wishlist.length && 1 > user.purchaseHistory.length) {
            return [];
        }

        const allProducts = await Product.find();
        const purchaseCategories: { category: string, subcategory: string }[] = [];

        // get categories from user purchase history

        user.purchaseHistory.forEach((val) => {
            if (val.products.length && val.products.length > 0) {
                for (const obj of val.products as TShopProduct[]) {
                    purchaseCategories.push({ category: obj.category, subcategory: obj.subcategory });
                }
            }
        });

        const populatedUser = (await user.populate('wishlist.productId')).wishlist;

        // get categories from user wishlist
        populatedUser.forEach((e: any) => {
            const foundIndex = purchaseCategories.findIndex(obj => obj.category === e.productId.category && obj.subcategory === e.productId.subcategory);
            if (foundIndex < 0) {
                purchaseCategories.push({ category: e.productId.category, subcategory: e.productId.subcategory });
            }
        });

        const recProds = allProducts.filter((doc) => {
            const foundCatHistory = purchaseCategories.findIndex((obj) => obj.category === doc.category && obj.subcategory === doc.subcategory);
            if (foundCatHistory > -1) {
                doc.price = calPrice(+doc.price, currency);
                return true;

            }

            return false;
        });

        return recProds;
    },
    logout: async ({ }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth, role, user, userId } = req;
        resolverErrorChecker({ condition: !isAuth, message: 'You are not logged in!', code: 500 });
        await blacklistToken(req.token);
        user.refreshToken = undefined;

        await user.save();

        if (['admin', 'superuser'].includes(role)) {
            await ServerMnt.findOneAndDelete({ startedBy: new mongoose.Types.ObjectId(userId) });
        }
        return true;
    },
    addToCart: async ({ prodId }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth, userId, user } = req;
        resolverErrorChecker({ condition: !isAuth, message: 'Please login to add to cart.', code: 403 });

        // const findUser = await User.findById(userId);
        const findProd = await Product.findById(prodId);

        resolverErrorChecker({
            condition: !findProd,
            message: 'Product not found, please refresh page',
            code: 404
        });

        // const user = findUser as UserData;
        const prod = findProd!;


        // resolverErrorChecker({ condition: 1 > prod.stockQty, message: 'Product out of stock!' });
        const cartItemIndex = user.cart.findIndex(obj => obj.productId.toString() === prodId);

        // check if product already in user cart
        if (0 > cartItemIndex) {
            const item = {
                productId: prod._id,
                quantity: 1,
            }
            user.cart.push(item);
        } else {
            user.cart[cartItemIndex].quantity++;
        }

        if (user.accInfo.activityReg.includes('add-to-cart')) {
            // update stats xp // remove activity from user activityReg

            await user.updateOne({ 'stats.xp': user.stats.xp.value + 5 });
            user.accInfo.activityReg = user.accInfo.activityReg.filter(activity => activity !== 'add-to-cart');
        }

        user.save();

        return true;
    },
    removeFromCart: async ({ cartObjId }: ParentObjectData, { req }: CtxArgs) => {
        const { userId } = req;
        const user = await User.findById(userId);

        if (!user || !cartObjId) {
            const error: { [key: string]: any } = new Error(!user ? 'Unauthorized! please sign in again or refresh page.' : 'Cart item not found, please refresh page');
            error.statusCode = !user ? 403 : 404;
            throw error;
        }

        user.cart.pull(cartObjId);
        await user.save();

        return true;
    },
    showCart: async (parent: any, { req }: CtxArgs) => {
        const { isAuth, userId, currency } = req;
        resolverErrorChecker({ condition: !isAuth || !userId, code: 401, message: 'Please login to continue.' });
        const cart = await User.getUserCart(userId, currency);

        return cart;
    },
    getCheckout: async ({ }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth, user, userId, currency } = req;

        resolverErrorChecker({
            condition: !isAuth,
            code: 401,
            message: 'Please login to continue'
        });

        await user.populate('cart.productId', 'title category subcategory imageUrls condition price');
        let subTotal = 0;

        const prodDets = user.cart.map((cartObj: any) => {
            const price = calPrice(+cartObj.productId.price, currency);
            subTotal += price * cartObj.quantity;
            const coverImageUrl: string | undefined = (cartObj.productId.imageUrls as string[]).find(imageUrl => imageUrl.includes('slot0'));

            return {
                prodId: cartObj.productId._id.toString(),
                title: cartObj.productId.title,
                category: cartObj.productId.category,
                subcategory: cartObj.productId.subcategory,
                condition: cartObj.productId.condition,
                imageUrl: coverImageUrl,
                price: price,
                qty: cartObj.quantity
            };
        });


        var kycData;
        if (user.accInfo.kycStatus === 'Successful') {
            const kyc = await Kyc.findOne({ userId: userId });
            kycData = { address: kyc?.residenceAddress, phone: kyc?.phone };
        }

        return {
            products: prodDets,
            subTotal: subTotal,
            fullname: user.firstName + ' ' + user.lastName + ` (${user.username})`,
            email: user.email,
            phone: kycData?.phone || user.accInfo.phone,
            deliveryAddress: kycData?.address
        };
    },
    postCheckout: async ({ amount, email, deliveryAddress, phone }: ParentObjectData, { req }: CtxArgs) => {

        const { isAuth, user, guestUser } = req;


        resolverErrorChecker({
            condition: !guestUser && !isAuth || !guestUser && !user,
            message: !isAuth ? 'Please login to continue.' : 'Invalid request :(',
            code: 401
        });

        // const checkoutOrderTypes = ['shop', 'gameRepair', 'gameDownload', 'gameRent', 'gameSwap'];

        // for NGN payments via paystack we add '00' to amount
        const params = JSON.stringify({
            email: email,
            amount: amount + '00'
        });

        const options = {
            hostname: 'api.paystack.co',
            port: 443,
            path: '/transaction/initialize',
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${process.env.PAYSTACK_SK}`,
                "Content-Type": "application/json"
            },
        };


        // ADD OTHER PAYMENT GATEWAY - STRIPE   // CHECK SELECTED PAYMENT PARTNER THEN CHECK PAYMENT METHOD
        const res = await initializePayment(options, params);
        console.log(res);


        return {
            accessCode: res.data.access_code,
            reference: res.data.reference,
            deliveryAddress: deliveryAddress,
            phone: phone
        };
    },
    editWishlist: async ({ prodId }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth, user } = req;
        resolverErrorChecker({ condition: !isAuth || !user, code: 401, message: 'Please login to continue.' });
        const result = await user.editUserWishlist(prodId);
        if (result.addedToWishlist && user.accInfo.activityReg.includes('add-to-wishlist')) {
            user.accInfo.activityReg = user.accInfo.activityReg.filter(activity => activity !== 'add-to-wishlist');
            await user.updateOne({ 'stats.xp': user.stats.xp.value + 5, 'accInfo.activityReg': user.accInfo.activityReg });
        }
        return result;
    },
    getWishlist: async (parent: any, { req }: CtxArgs) => {
        const { isAuth, user, currency } = req;
        resolverErrorChecker({ condition: !isAuth || !user, code: 401, message: 'Please login to continue.' });
        return await user.getUserWishlist(currency);
    },
    postAddComment: async ({ postId, userComment }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth, userId, user } = req;
        resolverErrorChecker({ condition: !isAuth, code: 401, message: 'Please login to post comments.' });
        const post = await Post.findById(postId);
        resolverErrorChecker({ condition: !post, code: 404, message: 'Post not found :(' });

        const commentData = {
            userInfo: new mongoose.Types.ObjectId(userId),
            comment: userComment
        };

        // give user 1xp if its the user first comment on the post
        let findComment = await Post.find();
        const commentIndex = findComment[0].comments.findIndex((comm) => comm.userInfo.id.toString() === userId);
        if (0 > commentIndex) {
            user.stats.xp.value++;
            user.save();
        }

        await post?.pushComment(commentData);
        if (user.accInfo.activityReg.includes('add-comment')) {
            user.stats.xp.value = user.stats.xp.value + 5;
            user.accInfo.activityReg = user.accInfo.activityReg.filter(activity => activity !== 'add-comment');
            user.save();
        }

        return { success: true, message: 'Comment was added successfully' };
    },
    postEditComment: async ({ userComment, commentId, postId }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth } = req;
        resolverErrorChecker({ condition: !isAuth, code: 401, message: 'Please login to continue' });
        const post = await Post.findById(postId).populate('comments.userInfo', 'profilePic username');

        resolverErrorChecker({ condition: !post, code: 404, message: 'Post not found :(' });

        try {
            const result = await post?.editComment(commentId, userComment);
            return result;
        } catch (err: any) {
            console.log(err.message);
            throw err;
        }
    },
    getAccInfoSettings: async ({ }, { req }: CtxArgs) => {
        const { isAuth, user } = req;
        resolverErrorChecker({ condition: !isAuth, message: 'Please login to continue.', code: 401 });


        const accData = {
            profilePic: user.profilePic,
            firstname: user.firstName,
            lastname: user.lastName,
            username: user.username,
            email: user.email,
            phone: user.accInfo.phone,
            gamingId: user.accInfo.gamingId,
            myGames: user.myGames
        }

        return accData;
    },
    postEditAccInfoSettings: async ({ accData }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth, user } = req;
        resolverErrorChecker({ condition: !isAuth, message: 'Please login to continue.', code: 401 });
        if (accData.phone) {
            resolverErrorChecker({
                condition: !validator.isMobilePhone(accData.phone, "en-NG"),
                message: 'Invalid phone number',
                code: 422
            });
        }
        try {
            user.profilePic = accData.profilePic || user.profilePic;
            user.accInfo.phone = accData.phone || user.accInfo.phone;
            user.accInfo.gamingId = accData.gamingId || user.accInfo.gamingId;
            user.save();
        } catch (err: any) {
            console.log(err.message);
            return { success: false, message: 'Profile edit failed!' };
        }

        return { success: true, message: 'Profile edit succeeded.' };
    },
    userPasswordUpdate: async ({ userQueryInput }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth, user } = req;
        resolverErrorChecker({ condition: !isAuth, message: 'Please login to continue.', code: 401 });
        const oldPassword = userQueryInput.oldPassword;
        let newPassword = userQueryInput.newPassword;
        const confirmPassword = userQueryInput.confirmPassword;

        const verifyOldPw = await bcrypt.compare(oldPassword, user.password);
        resolverErrorChecker({ condition: !verifyOldPw, message: 'Error: Old password is incorrect!', code: 500 });

        resolverErrorChecker({
            condition: !validator.isStrongPassword(newPassword, {
                minLength: 6,
                minSymbols: 0,
                minUppercase: 1,
                minNumbers: 1,
            }),
            message: 'New password must contain atleast one uppercase letter, a number and should be greater than 5 characters.',
            code: 422
        });

        const isSameAsOldPW = await bcrypt.compare(newPassword, user.password);
        resolverErrorChecker({
            condition: isSameAsOldPW,
            message: 'The entered new password has been previously used by you. Please create a different password',
            code: 422
        });

        resolverErrorChecker({ condition: newPassword !== confirmPassword, message: 'Passwords do not match!', code: 422 });
        try {
            newPassword = await bcrypt.hash(newPassword, 12);
            await Mailing.sendEmail(user.email, 'Password Changed Successful', '<h1>Your password has been changed successfully!<h1/>');
            await user.updateOne({ password: newPassword });
        } catch (err: any) {
            console.log(err.message);
            return { success: false, message: 'Password update failed!' };
        }
        return { success: true, message: 'Password update succeeded.' };
    },

    deleteMyAcc: async ({ }, { req }: CtxArgs) => {
        resolverErrorChecker({ condition: !req.isAuth, message: 'Please login to continue.', code: 401 });

        try {
            await req.user.deleteOne();
        } catch (err: any) {
            console.log(err.message);
            return { success: false, message: 'Operation failed :(' };
        }
        return { success: true, message: 'Your account was deleted successfully.' };
    },
    getUserOrders: async ({ }, { req }: CtxArgs) => {
        const { isAuth, userId } = req;
        resolverErrorChecker({ condition: !isAuth, message: 'Please login to continue.', code: 401 });

        return await User.getUserOrders(userId);
    },
    getUserOrder: async ({ orderId }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth, userId } = req;
        resolverErrorChecker({ condition: !isAuth, message: 'Please login to continue.', code: 401 });
        const orderDetails = await User.getUserOrderDetails(orderId, userId);
        return orderDetails;
    },
    createKyc: async ({ userQueryInput }: ParentObjectData, { req }: CtxArgs) => {
        const { userId, isAuth, user } = req;

        resolverErrorChecker({ condition: !isAuth, message: 'Please login to continue.', code: 401 });
        const phone = userQueryInput.phone as string;
        const residenceAddress = userQueryInput.residenceAddress.trim();
        const validId = {
            kind: userQueryInput.validId.kind,
            docUrl: userQueryInput.validId.docUrl
        };
        const utilityBill = {
            kind: userQueryInput.utilityBill.kind,
            docUrl: userQueryInput.utilityBill.docUrl
        };

        const dateOfBirth = new Date(userQueryInput.dateOfBirth);

        resolverErrorChecker({ condition: Date.parse(dateOfBirth.toISOString()) < Date.parse("1945-01-01"), code: 422, message: 'Invalid date of birth!' });

        resolverErrorChecker({
            condition: !validator.isMobilePhone(phone, "en-NG"),
            message: 'Invalid phone number',
            code: 422
        });

        await Kyc.create({
            userId: user._id,
            fullname: `${user.firstName} ${user.lastName} (${user.username})`,
            dateOfBirth: dateOfBirth.toDateString(),
            phone: phone,
            residenceAddress: residenceAddress,
            validId: validId,
            utilityBill: utilityBill
        });

        if (user.accInfo.activityReg.includes('created-kyc')) {
            await user.updateOne({ 'stats.xp': user.stats.xp.value + 5, 'accInfo.kycStatus': 'Pending' });
            user.accInfo.activityReg = user.accInfo.activityReg.filter(activity => activity !== 'created-kyc');
        } else {
            await user.updateOne({ 'accInfo.kycStatus': 'Pending' });
        }

        user.save();
        return { success: true, message: 'kyc created successfully.' };

    },
    getOrderRefund: async ({ orderId }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth } = req;
        resolverErrorChecker({ condition: !isAuth, message: 'Please login to continue.', code: 401 });

        let foundOrder = await Order.findById(orderId);
        resolverErrorChecker({ condition: !foundOrder, message: 'Error: Order does not exists!', code: 404 });
        foundOrder = foundOrder!;


        let orderInfo = foundOrder.items || foundOrder.product;

        return {
            orderId: orderId,
            amount: foundOrder.payment?.amount.toString() + ` ${foundOrder.payment!.currency}`,
            orderInfo: JSON.stringify(orderInfo)
        };
    },
    postOrderRefund: async ({ orderId, prodId, userQueryInput, imageUrls, amount }: ParentObjectData, { req }: CtxArgs) => {

        const { isAuth, userId, user } = req;
        resolverErrorChecker({ condition: !isAuth, message: 'Please login to continue.', code: 401 });

        let foundOrder = await Order.findOne({ _id: new Types.ObjectId(orderId), "userInfo.userId": userId });

        resolverErrorChecker({ condition: !foundOrder, message: 'Error: No existing order for item/user!', code: 404 });
        foundOrder = foundOrder!;

        // validate other reason
        if (userQueryInput.otherReason) {
            resolverErrorChecker({ condition: !validator.isLength(userQueryInput.otherReason, { min: 20, max: 500 }), message: 'Description length too short :(', code: 422 });
        }

        const foundRefund = await Refund.findOne({ orderInfo: new Types.ObjectId(orderId), prodId: undefined });
        // if found then we know refund exist for the whole order
        resolverErrorChecker({ condition: foundRefund !== null, message: 'Refund already exist for this order.', code: 409 });

        await Refund.create({
            userInfo: { userId: userId, email: user.email, username: user.username },
            amount: amount,
            orderInfo: new Types.ObjectId(orderId),
            prodId: prodId,
            reason: userQueryInput.reason,
            otherReason: userQueryInput.otherReason,
            imageUrls: imageUrls
        });

        if (foundOrder.toExpire) {
            foundOrder.toExpire = undefined;
            foundOrder.save();
        };

        return { success: true, message: 'Refund request created successfully' };
    },
    getUserOrderRefundInfo: async ({ orderId }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth, userId } = req;
        resolverErrorChecker({ condition: !isAuth, message: 'Please login to continue.', code: 401 });

        console.log(new Types.ObjectId(orderId), userId);
        let foundRefund = await Refund.findOne({ orderInfo: new Types.ObjectId(orderId), 'userInfo.userId': userId }).populate('orderInfo', 'items product');

        resolverErrorChecker({ condition: !foundRefund, message: 'Error: Refund not available!', code: 404 });
        foundRefund = foundRefund!;

        return {
            amount: foundRefund.amount,
            orderInfo: foundRefund.orderInfo,
            prodId: foundRefund.prodId,
            reason: foundRefund.reason,
            otherReason: foundRefund.otherReason,
            imageUrls: foundRefund.imageUrls,
            progress: foundRefund.progress,
            status: foundRefund.status,
            createdAt: foundRefund.createdAt,
            updatedAt: foundRefund.updatedAt
        };
    }
};