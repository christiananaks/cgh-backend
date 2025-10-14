import { NextFunction, Response } from "express";



import { paystackVerifyPayment, createOrder, TOrderInfo } from "../util/order-payment";
import Order, { IOrder, PaymentInfo } from "../models/order";
import Product from "../models/product";
import mongoose, { HydratedDocument, Types } from "mongoose";


type OrderedProd = {
    prodId: string,
    title: string,
    category: string,
    subcategory?: string,
    imageUrl: string,
    price: number,
    condition: string,
    qty: number
}


type TUserInfo = {
    fullname: string,
    email: string,
    phone: string,
    deliveryAddress: string,
}

type TOrderData = {
    subTotal: number,
    price?: string, // for services // take the present offer 
    prodId?: string, // for services
    inspectionFee?: string,
    payOnDelivery: boolean,
    items?: OrderedProd[],
    orderId?: string    // for verifying orders pending payment i.e POD orders
}

export interface ICheckoutInfo {
    reference: string,
    paymentMethod: string,
    userData: TUserInfo,
    orderData: TOrderData,
}

// USE CASES - 1.PAYMENT VERIFICATION + NEW ORDER CREATION | 2.PAYMENT VERIFICATION FOR EXISTING POD ORDER | 3.PAYMENT VERIFICATION FOR INSPECTION FEE  **`cname` -> Collection Name**
// Request input for Use Case 1 -- req.query.cname=[dbcollection] & body{ reference, userData, orderData }
// Request input for Use Case 2 -- body{ reference, orderData.orderId }
// Request input for Use Case 3 -- body{ reference, userData, orderData containing inspectionFee or paymentFee }
export default async function verifyPayment(req: any, res: Response, next: NextFunction) {
    // resolverErrorChecker({ condition: !req.isAuth, message: 'Expired auth token! Please login again to continue.', code: 401 }); // wrap with try catch in classic route middlewares
    if (!req.isAuth) {
        const error: { [key: string]: any } = new Error('Error: Please login to continue.');
        error.statusCode = 401;
        return next(error);
    }

    const confirmedOrderData: ICheckoutInfo = { ...req.body };
    const reference = confirmedOrderData.reference;
    const { orderId, inspectionFee, items } = confirmedOrderData.orderData;

    // the conditional expression handles the case of undefined destructured elements
    const { fullname, email, phone, deliveryAddress } = orderId ? ({} as ICheckoutInfo['userData']) : confirmedOrderData.userData;

    const collectionName: string = req.query.cname;  // pass dbcollection name as query parameter // for service products

    if (!reference) {
        const error = new Error('Failed: invalid transaction reference.');
        return next(error);
    }


    type TransInfo = { verified: any, accepted: boolean, data: { [key: string]: any } };
    type TransError = { error: { [key: string]: any } };
    let transInfo: TransInfo | TransError = await paystackVerifyPayment(reference);

    // if transaction was not successful we return response and do not create order
    if (!(transInfo as TransInfo).accepted) {
        return res.status(500).json(transInfo);
    }
    if ((transInfo as TransError).error) {
        return next((transInfo as TransError).error);
    }

    transInfo = transInfo as TransInfo;
    if (inspectionFee) {
        req.transInfo = transInfo;
        return next();
    }

    const userInfo: IOrder['userInfo'] = {
        email: email,
        fullname: fullname,
        userId: req.userId,
        deliveryAddress: deliveryAddress,
        phone: phone
    };

    const actualAmount = Math.round(transInfo.data.amount / 100);
    const paymentData = {
        gateway: 'Paystack',
        transRef: reference,
        amount: actualAmount,
        currency: transInfo.data.currency,
        rate: req.currency.rate,
        method: transInfo.data.channel
    };


    var orderInfo: TOrderInfo;
    // if order is not existing in db as (POD) or regular order
    if (!orderId) {

        // check req body   // DEBUG PURPOSE
        const requiredFields = ['fullname', 'email', 'deliveryAddress', 'phone'];
        const keys = Object.keys({ ...confirmedOrderData.userData, ...confirmedOrderData.orderData });

        if (!keys.includes('items') && !keys.includes('prodId')) return next(new Error(`Error: 'items' or 'prodId' must be provided!`));
        if (keys.includes('items')) {
            requiredFields.push('items', 'subTotal');
        } else {
            requiredFields.push('prodId', 'price');
        }

        for (const field of requiredFields) {
            if (!keys.includes(field)) return next(new Error(`Error: ${field} absent from request body :(`));
        }
        /********************************************************************************************************************** */

        try {
            orderInfo = await createOrder({ userInfo: userInfo, orderCheckout: confirmedOrderData, paymentData: paymentData, collectionName: collectionName, req: req });
        } catch (err: any) {
            console.log(err.message);
            return next(err);
        }

        res.status(200).json({ orderInfo, transInfo });

        await req.user.updateOne({ 'stats.xp': req.user.stats.xp + 5 });

    } else {
        // when order was already created from /create-pod-order // when customer pays we verify payment and update orderstatus

        let foundOrder = await Order.findById(orderId);
        foundOrder = foundOrder!;

        await foundOrder.updateOne({ status: 'Completed' });

        var products: any; // service product or shop products 
        /** when `foundOrder.items` is undefined then the product is NOT a shop product but a service product */
        if (!foundOrder.items) {
            const price = foundOrder.product?.orderData.toPay;
            foundOrder.product!.orderData!.toPay = undefined;
            foundOrder.product!.orderData!.paymentStatus = 'Paid';

            const product = await (mongoose.connection.db?.collection(foundOrder.product?.orderTitle as string))?.findOne({ _id: foundOrder.product?.orderData.orderInfo });
            products = { ...product, price: price, id: product?._id.toString() };
        } else {
            products = foundOrder.items;
            foundOrder.payOnDelivery = undefined;
            foundOrder.payment = paymentData;
        }

        orderInfo = {
            orderNo: orderId + '-' + reference,
            productDetails: products,
            total: actualAmount
        };
        console.log(orderInfo.productDetails, foundOrder.product?.orderTitle);
        req.foundOrder = await foundOrder.save();   // bind to request object in order to make foundOrder value available for use when updating user purchase history

        res.status(200).json({ orderInfo, transInfo });
        await req.user.updateOne({ 'stats.xp': req.user.stats.xp + 5 });
    }

    // const order: HydratedDocument<IOrder> = req.foundOrder || orderInfo;

    // update user purchase history should be a separate function
    // if order.items is not undefined, `products` would be an array else it would be an Object
    // ==================== UPDATE USER PURCHASE HISTORY======================
    let prodData;
    // organising purchaseInfo for new order
    if (!req.foundOrder) {

        // where req.foundOrder is undefined we use orderInfo to populate prodData
        // get product info from orderInfo.productDetails returned by `createOrder` function
        prodData = {
            ...orderInfo.productDetails
        };

    } else {
        const order: HydratedDocument<IOrder> = req.foundOrder;
        prodData = order.items ? products.map((prod: any) => {
            return {
                prodId: prod._id.toString(),
                title: prod.title,
                category: prod.category,
                subcategory: prod.subcategory!,
                imageUrl: prod?.imageUrls[0],
                condition: prod.condition,
                price: prod.price
            };
        }) : {
            ...order.product?.orderData
        };
    }

    const purchaseInfo = {
        date: new Date(),
        products: prodData as any,
        totalAmount: paymentData.amount.toString()
    };


    req.user.purchaseHistory.push(purchaseInfo);
    //=========================================================================

    req.user.save();

    // balance stock quantity
    if (items && items.length > 0) {
        try {
            let operations = [];
            const prodIds = items.map(item => new mongoose.Types.ObjectId(item.prodId));
            const queryRes = await Product.find({ _id: { $in: prodIds } });
            for (const prod of queryRes) {
                const orderedQty = items.find(item => item.prodId === prod.id)?.qty;
                operations.push({
                    updateOne: {
                        filter: { _id: prod._id },
                        update: { $set: { stockQty: prod.stockQty -= orderedQty || 0 } }
                    }
                });
            }
            await Product.bulkWrite(operations);

        } catch (err: any) {
            console.log(err.message);
            next(err);
        }
    }
};

