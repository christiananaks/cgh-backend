import mongoose, { Types } from "mongoose";
import { NextFunction, Request, Response, Router } from "express";

import Order, { IProductOrder } from "../models/order.js";
import { ICheckoutInfo } from "./verify-payment.js";

const router = Router();

// USE CASES - 1.CREATE POD ORDER FOR PRODUCTS | 2.CREATE POD ORDER FOR SERVICE PRODUCT
// Request input for 1 -- body{ userData, orderData with POD }
// Request input for 2 --  body{ reference | undefined, userData, orderData with POD } 

export const createReqOrder = async (req: Request, res: Response, next: NextFunction) => {
    const { isAuth, user, userId }: any = req;
    if (!isAuth) {
        const error: { [key: string]: any } = new Error('Error: Please login to continue.');
        error.statusCode = 401;
        return next(error);
    }

    // `req.query.cname` would hold collection name for service products
    const params = !req.params.cname ? `${req.query.cname}` : req.params.cname;
    const dbCollections = ['products', 'gamedownloads', 'gamerents', 'gameswaps', 'gamerepairs']; // db collection names
    if (!dbCollections.includes(params) && !req.query.cname) {
        return next(new Error('Error: Invalid url params!'));
    }

    const confirmedOrderData: ICheckoutInfo = { ...req.body };  // if body has reference, we know inspection fee was paid
    const { fullname, email, phone, deliveryAddress } = confirmedOrderData.userData;
    let { payOnDelivery, prodId, items, inspectionFee, price, subTotal } = confirmedOrderData.orderData;

    const userInfo = {
        email: email,
        userId: userId,
        fullname: fullname,
        phone: phone,
        deliveryAddress: deliveryAddress
    };

    let pod = {
        status: payOnDelivery,
        totalAmount: subTotal?.toString() || price?.toString()
    };

    if (confirmedOrderData.reference) {
        console.log('found reference!');
        inspectionFee = 'Paid';
    }

    // if `items` is undefined then we know that `product` is NOT of shop product order kind
    if (!items) {

        const prodData: IProductOrder = {
            orderInfo: new Types.ObjectId(`${prodId}`),
            paymentStatus: 'Pending',
            inspectionFee: inspectionFee,
            toPay: price
        };

        const product = {
            orderTitle: params,
            orderData: prodData
        };

        const newOrder = new Order({
            userInfo: userInfo,
            payOnDelivery: pod,
            product: product,
            payment: null,
        });


        const doc = await mongoose.connection.db?.collection(params).findOne({ _id: prodData.orderInfo });
        if (!doc) {
            return next(new Error(`Product does not exist in ${params} db`));
        }



        const orderInfo = {
            orderNo: newOrder.id,
            product: { ...doc, price: price, id: doc._id.toString() },  // GET PROD INFO BUT SET SAME PRICE
            total: price
        };

        newOrder.save();

        res.status(201).json({ orderInfo });
    } else {
        // create shop products order
        const order = await Order.create({
            userInfo: userInfo,
            payOnDelivery: pod,
            items: items,
            payment: null
        });

        user.cart.splice(0);

        const orderInfo = {
            orderNo: order.id,
            products: items,
            subTotal: subTotal,
        };

        // user.save(); // TODO: re add

        res.status(200).json({ orderInfo });
    }
}

// pay on delivery (pod) orders // cname - Collection Name
router.post('/create-pod-order/:cname', createReqOrder);

export default router;