import mongoose, { Model, Types, Document, HydratedDocument } from "mongoose";
import { calPrice, resolverErrorChecker } from "../util/helper";
import { ICurrency } from "./currency";


const Schema = mongoose.Schema;

const orderSchema = new Schema<IOrder, IOrderModel, IOrderMethods>({
    userInfo: {
        email: {
            type: String,
            required: true
        },
        userId: {
            type: String,
            required: true,
        },
        fullname: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true
        },
        deliveryAddress: {
            type: String,
            required: true
        }
    },
    payOnDelivery: {
        type: {
            status: {
                type: Boolean,
                required: true
            },
            totalAmount: String
        },
    },
    items: {
        type: [
            {
                type: Object,
                required: true
            }
        ]
    },
    product: {
        type: {
            orderTitle: {
                type: String,
                required: true
            },
            orderData: {    // change to verbose type declaration if the undefined values path does not get deleted from the db
                type: Object,
                required: true
            }
        }
    },
    payment: {
        type: Object,
    },
    status: {
        type: String,
        default: 'Pending',
        required: true,
        enum: ['Pending',
            'Confirmed payment',
            'Processing',
            'Processed',
            'Delivered',
            'Completed',
            'Received',
            'Repair in progress',
            'Repair succeeded',
            'Repair failed',
            'Sent',
            'Paid', 'Order rejected'],
    },
    reason: String,
    toExpire: {
        type: Date,
        expires: 0
    }
}, { timestamps: true });


orderSchema.statics.getOrders = async function () {
    const orders = await this.find();
    if (orders.length > 0) {
        const userOrders = orders.map(doc => {
            return { orderId: doc.id, email: doc.userInfo.email, date: doc.createdAt.toISOString() };
        });
        return userOrders;
    }
    return [];
}

orderSchema.statics.getOrder = async function (orderId: string, currency: ICurrency) {
    let order = await this.findById(orderId).populate('userInfo.userId', 'firstName lastName');
    resolverErrorChecker({ condition: !order, message: 'Order not found :(', code: 404 });
    order = order!;

    const userData = {
        name: order.userInfo.fullname,
        email: order.userInfo.email,
        deliveryAddress: order.userInfo.deliveryAddress,
        phone: order.userInfo.phone
    };

    const products = order.items?.map((obj) => {

        return {
            title: obj.title,
            category: obj.category,
            imageUrl: obj.imageUrl,
            price: obj.price,
            qty: obj.qty
        };
    });

    const orderDetails = {
        orderId: order.id,
        orderNo: order.payment ? order.id + '-' + order.payment.transRef : order.id,
        user: userData,
        products: products,
        date: order.createdAt.toISOString(),
        status: order.status
    }

    return orderDetails;
}

orderSchema.statics.deleteOrder = async function (orderId: string) {
    try {
        const order = await this.findById(orderId);
        resolverErrorChecker({ condition: !order, message: 'Order not found :(', code: 404 });
        await order?.deleteOne();
    } catch (err: any) {
        console.log(err.message);
        throw err;
    }
    return { success: true, message: 'Order was deleted successfully.' };
}

interface IOrderModel extends Model<IOrder, {}, IOrderMethods> {
    // static type def here
    getOrders(): Promise<HydratedDocument<IOrder>[]> | Promise<[]>;
    getOrder(orderId: string, currency: ICurrency): Promise<object>;
    deleteOrder(orderId: string): Promise<object>;
}

interface IOrderMethods {
    // method type def here
}


export interface IOrder extends IOrderProps, IOrderMethods {
    userInfo: DBUserInfo;
    payOnDelivery?: { status: boolean, totalAmount: string | null };
    items: Types.Array<DBOrderedProds> | undefined;
    product: { orderTitle: string, orderData: IProductOrder } | undefined;
    payment: PaymentInfo | null;
    status: string;
    reason?: string;
    toExpire?: Date;
}

export interface IProductOrder {
    orderInfo: Types.ObjectId;
    inspectionFee?: string;
    paymentStatus: string;
    toPay?: string;
    _doc?: Omit<this, '_doc'>;
}

interface IOrderProps {
    _doc: Omit<this, '_doc'>;
    createdAt: Date;
    updatedAt: Date;
}

// get from payment verification result {data.reference, channel, currency, amount}
export type PaymentInfo = {
    gateway: string;
    transRef: string;
    method: string;     // channel
    currency: string;
    rate: number;
    amount: number;
    transReceipt?: string;
}

export type DBOrderedProds = {
    prodId: string;
    title: string;
    category: string;
    subcategory?: string;
    condition?: string;
    imageUrl: string | null;
    price: string;
    qty: number;
}

type DBUserInfo = {
    email: string;
    userId: string;
    fullname: string;
    deliveryAddress: string;
    phone: string;
}



const Order = mongoose.model<IOrder, IOrderModel>('Order', orderSchema);

export default Order;
