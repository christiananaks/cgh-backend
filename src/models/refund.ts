import mongoose, { Schema, Model } from "mongoose";
import { IOrder } from "./order";


const refundSchema = new Schema<IRefund, TRefundModel>({
    userInfo: {
        type: {
            userId: {
                type: String,
                required: true
            },
            email: {
                type: String,
                required: true
            },
            username: {
                type: String,
                required: true
            }
        },
        required: true
    },
    amount: {
        type: String,
        required: true
    },
    orderInfo: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "Order",
        unique: true
    },
    reason: {
        type: String,
        required: true,
        enum: [
            'Package not received',
            'Package was damaged',
            'Others'
        ]
    },
    otherReason: String,
    imageUrls: {
        type: [
            {
                type: String,
                required: true
            }
        ]
    },
    progress: {
        type: String,
        default: "Refund request in review",
        enum: ["Refund request in review", "Processing", "Succeeded", "Rejected", "Failed"],
        required: true
    },
    status: {
        type: String,
        default: "Incomplete",
        enum: ["Incomplete", "Completed"]
    }
}, { timestamps: true },);

refundSchema.index({ createdAt: 1 }, { partialFilterExpression: { status: 'Completed' }, expireAfterSeconds: 480 })     // 480s => 8 minutes

refundSchema.static('refunds', async function (): Promise<object[]> {
    let refunds = await this.find().populate('orderInfo', 'payment');
    if (1 > refunds.length) return [];

    refunds = refunds.map(data => {

        return {
            id: data.id,
            username: data.userInfo.username,
            amount: data.amount,
            currency: data.orderInfo.payment.currency,
            status: data.status,
            createdAt: data.createdAt?.toISOString()
        };
    }) as any;
    console.log(refunds);

    return refunds;
});

refundSchema.static('usersRefundInfo', async function (id: string): Promise<object> {

    const refundInfo = await this.findById(id).populate('orderInfo', 'items product payment');
    if (!refundInfo) throw new Error('Error: Refund not found');

    const orderInfo: { [key: string]: any } = {};
    if (refundInfo.orderInfo.items) {
        orderInfo.items = refundInfo.orderInfo.items;
    } else {
        orderInfo.product = refundInfo.orderInfo.product;
    }

    return {
        id: refundInfo.id,
        email: refundInfo.userInfo.email,
        username: refundInfo.userInfo.username,
        amount: refundInfo.amount,
        currency: refundInfo.orderInfo.payment.currency,
        orderInfo: JSON.stringify(orderInfo),
        reason: refundInfo.reason,
        otherReason: refundInfo.otherReason,
        imageUrls: refundInfo.imageUrls,
        progress: refundInfo.progress,
        status: refundInfo.status,
        createdAt: refundInfo.createdAt?.toISOString(),
        updatedAt: refundInfo.updatedAt?.toISOString()
    };
});

const Refund = mongoose.model<IRefund, TRefundModel>('refund', refundSchema);

export default Refund;

type TProdType = {
    prodId: string;
    title: string;
    imageUrl?: string;
    desc?: string;
    platform?: string;
    category: string;
    game?: string;
    price: string;
    duration?: string;
    installType?: string;
    installDuration?: string;
    gameList?: string[];
    homeService?: string;
}

interface TRefundModel extends Model<IRefund> {
    refunds(): Promise<object[]>;
    usersRefundInfo(id: string): Promise<object>;
}


interface IRefund {
    userInfo: { userId: string, email: string; username: string; };
    amount: string;
    orderInfo: any;
    reason: string;
    otherReason: string | undefined;
    imageUrls: string[];
    progress: string;
    status: string;
    createdAt?: Date;
    updatedAt?: Date;
}
