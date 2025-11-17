import https from 'https';

import mongoose, { Types } from 'mongoose';

import Order, { IOrder, IProductOrder, PaymentInfo } from '../models/order.js';
import { ICheckoutInfo } from '../routes/verify-payment.js';
import { ProductData } from '../models/product.js';

interface IPaystackInitPay {
    status: boolean;
    message: string;
    data: {
        authorization_url: string,
        access_code: string,
        reference: string
    };
}
export function initializePayment(options: object, params: string): Promise<IPaystackInitPay> {
    return new Promise((resolve, reject) => {
        try {
            const req = https.request(options, (res) => {
                let data = "";
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve(JSON.parse(data));
                })
            }).on('error', (error) => {
                reject(error);
            });
            req.write(params);
            req.end();


        } catch (err: any) {
            console.log(err.message);
            reject(err);
        }
    });
}


export async function paystackVerifyPayment(reference: string) {
    try {
        const verify = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SK}`
            },
        });

        const resData: any = await verify.json();

        // filter response data
        let data: { [key: string]: any } = {};
        for (let key in resData.data) {
            const keys = Object.keys(resData.data);
            const loopIndex = keys.indexOf(key);

            if (loopIndex <= keys.indexOf('metadata')) {
                data[key] = resData.data[key];
            }

            if (key === 'authorization' || key === 'customer') {
                data[key] = resData.data[key];
            }
        }

        const isSuccessful = resData.data.status === 'success';
        return { verified: resData.status, accepted: isSuccessful, data: data }
    } catch (err: any) {
        console.log(err.message);
        // throw new Error(err.message);
        const error: any = new Error(err.message);
        error.statusCode = 500;
        return { error: error };
    }
}

interface IOrderArgObject {
    userInfo: IOrder['userInfo'];
    orderCheckout: ICheckoutInfo;
    paymentData: PaymentInfo;
    collectionName: string;
    service?: Types.ObjectId;
    req: any;
}


export type TOrderInfo = {
    orderNo: string;
    productDetails: ProductData[] | any;
    total: number;
}

// POD is NOT needed here! A function thats creates orders for only paid products
export async function createOrder(orderArgObj: IOrderArgObject): Promise<TOrderInfo> {
    const { userInfo, orderCheckout, paymentData, collectionName, req } = orderArgObj;
    const { prodId, price, items, subTotal } = orderCheckout.orderData;

    var orderInfo;

    if (prodId) {

        const product: IProductOrder = {
            orderInfo: new Types.ObjectId(prodId),
            paymentStatus: 'Paid',
            // inspectionFee: inspectionFee
        };

        const newOrder = new Order({
            userInfo: userInfo,
            product: { orderTitle: collectionName, orderData: product },
            payment: paymentData
        });
        newOrder.items = undefined;  // prevent this `items` field from being included when doc is created in db.
        const productOrder = await mongoose.connection.collection(collectionName).findOne({ _id: new Types.ObjectId(prodId) });

        // send mail....

        orderInfo = {
            orderNo: newOrder.id + '-' + paymentData?.transRef,
            productDetails: {
                id: productOrder?._id.toString(),
                ...productOrder,
                price: price,
            },
            total: paymentData?.amount
        };
        newOrder.save();
        return orderInfo;
    } else {

        const order = await Order.create({
            userInfo: userInfo,
            items: items,
            payment: paymentData,
        });


        //SEND MAIL HERE.........order details and order No

        orderInfo = {
            orderNo: order.id + '-' + paymentData!.transRef,
            productDetails: items,
            total: paymentData!.amount
        };

        // req.user.cart.splice(0); // TODO uncomment line
        return orderInfo;
    }
}