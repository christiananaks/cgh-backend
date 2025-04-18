import { Router } from "express";

import Order from "../models/order";
import { HydratedDocument } from "mongoose";
import { UserData } from "../models/user";
import mongoose from "mongoose";

const router = Router();

router.post('/verify-offline-payment', async (req, res, next) => {

    const reqObj: any = req;
    if (!reqObj.isAuth) {
        const error: { [key: string]: any } = new Error('Error: Please login to continue.');
        error.statusCode = 401;
        return next(error);
    }

    const orderId: string = req.body.orderId;
    const transReceipt = req.body.receipt;
    const total = req.body.total;

    try {
        const foundOrder = await Order.findById(orderId);
        if (!foundOrder) {
            const error: { [key: string]: any } = new Error('Error: Order was not found!');
            error.statusCode = 404;
            return next(error);
        }

        const paymentInfo = {
            transReceipt: transReceipt,
            currency: 'NGN',
            method: 'transfer',
            amount: total
        }

        await foundOrder.updateOne({ 'product.orderData.toPay': undefined, 'product.orderData.paymentStatus': 'Paid', payment: paymentInfo, status: 'Completed' });

        foundOrder.save();

        res.status(200).json({ success: true, message: 'Order completed successfully.' });

        const user: HydratedDocument<UserData> = reqObj.user;

        let prodData;
        if (foundOrder.product) {
            prodData = await mongoose.connection.db?.collection(foundOrder.product.orderTitle).findOne({ _id: foundOrder.product.orderData.orderInfo });
            prodData = { ...foundOrder.product };

        } else if (foundOrder.items) {
            prodData = foundOrder.items.map(prod => {
                return {
                    prodId: prod.prodId,
                    title: prod.title,
                    category: prod.category,
                    subcategory: prod.subcategory!,
                    price: prod.price,
                    qty: prod.qty,
                };
            });
        }
        const purchaseInfo = {
            date: new Date(),
            products: prodData as any,
            totalAmount: paymentInfo ? paymentInfo.amount.toString() : 'N/A'
        }
        user.purchaseHistory.push(purchaseInfo);
        await user.updateOne({ 'userstats.xp': user.userstats.xp + 5 });
    } catch (err: any) {
        console.log(err.message);
        next(new Error('Error: Payment verification failed!'));
    }
});

export default router;