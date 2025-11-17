import mongoose, { Model, Types, Document, Schema, HydratedDocument } from 'mongoose';

import { ProductData } from './product.js';
import Order, { PaymentInfo } from './order.js';
import { calPrice, epochTime, resolverErrorChecker } from '../util/helper.js';
import { ICurrency } from './currency.js';
import Post, { IPost } from './post.js';
import { IDocProps } from './type-def.js';


// for registering static(s) method type to our custom Schema model
interface UserModel extends Model<UserData, {}, IUserMethods> {
    getUserCart(userId: string, currency: ICurrency): Promise<CartData[]>;
    getUserOrders(userId: string): Promise<object[]>;
    getUserOrderDetails(orderId: string, userId: string): Promise<object[]>;
    updateUserStats(user: HydratedDocument<UserData>): Promise<void>;
}

interface IUserMethods {
    getUserWishlist(currency: ICurrency): Promise<ProductData[]>;
    editUserWishlist(prodId: string): Promise<wishlistActionResult>;
}


// if there are methods pass the interface as the 3rd generic parameter type to the Schema
const userSchema = new Schema<UserData, UserModel, IUserMethods>({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    username: {
        type: String,
        unique: true,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    profilePic: {
        type: String,
    },
    stats: {
        type: {
            sp: {
                type: Number,
                default: 1,
                required: true
            },
            day: { type: { requiredDays: { type: Number, required: true }, date: { type: Date, required: true }, }, },
            xp: {
                type: { value: { type: Number, required: true }, max: { type: Number, required: true }, date: { type: Date, required: true } },
                required: true
            },
            level: {
                type: Number,
                default: 1,
                required: true
            },
            date: {
                type: Date,
                default: Date.now(),
                required: true
            }
        },
        default: { day: { requiredDays: 7, date: new Date() }, xp: { value: 0, max: 100, date: new Date() } },
        required: true
    },
    refreshToken: {
        type: String,
    },
    accInfo: {
        type: {
            role: {
                type: String,
                default: 'standard',
                required: true,
            },
            creator: {
                type: String,
                default: 'user',
                required: true,
            },
            phone: {
                type: String,
            },
            gamingId: {
                type: {
                    gamingIdHandle: {
                        type: String,
                        required: true
                    },
                    platform: {
                        type: String,
                        required: true
                    }
                }
            },
            activityReg: [
                { type: String }
            ],
            kycStatus: {
                type: String,
                default: 'Not Initialized',
                required: true,
                enum: ['Not Initialized', 'Unsuccessful', 'Approved', 'Pending']
            }
        },
        required: true
    },
    myGames: [
        {
            type: {
                category: {
                    type: String,
                    required: true,
                    enum: ['Console', 'Gaming PC', 'Handheld/Portable']
                },
                names: {
                    type: Array<String>,
                    required: true
                }
            },
            required: true

        }
    ],
    purchaseHistory: [
        {
            type: {
                date: {
                    type: Date,
                    required: true
                },
                products: {
                    type: Array<{
                        prodId: String,
                        title: String,
                        category: String,
                        subcategory: string,
                        price: String,
                        qty: Number
                    }>,
                    required: true
                },
                totalAmount: {
                    type: String,
                    required: true
                }
            },
            required: true

        }
    ],
    wishlist: [
        {
            productId: {
                type: Schema.Types.ObjectId,
                ref: "Product",
                required: true
            }
        }
    ],
    cart: [
        {
            productId: {
                type: Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },
            quantity: {
                type: Number,
                required: true
            }
        }
    ]
},
    {
        timestamps: true,
        statics: {
            getUserCart: async function (userId: string, currency: ICurrency): Promise<CartData[]> {
                const user: UserData | null = await this.findById(userId).populate('cart.productId', 'title imageUrls price');

                if (!user) {
                    const error: { [key: string]: any } = new Error('Please login to view your cart.');
                    error.statusCode = 403;
                    throw error;
                }

                if (1 > user.cart.length) {
                    return [];
                }

                const cart = user.cart.map((obj: any) => {
                    const price = calPrice(+obj.productId.price, currency);

                    return {
                        cartObjId: obj._id.toString(),
                        prodId: obj.productId.id,
                        prodTitle: obj.productId.title,
                        imageUrl: obj.productId.imageUrls[0],
                        qty: obj.quantity,
                        price: price * obj.quantity
                    }
                });
                return cart;
            },
            getUserOrders: async function (userId: string): Promise<object[]> {
                const orders = await Order.find({ 'userInfo.userId': userId });
                if (1 > orders.length) {
                    return [];
                }
                const userOrders = orders.map(order => {

                    var orderStatus;
                    switch (order.status.toLowerCase()) {
                        case 'completed':
                            orderStatus = 'Completed';
                            break;
                        case 'delivered':
                            orderStatus = 'Delivered';
                            break;
                        case 'processed':
                            orderStatus = 'On its way!';
                            break;
                        case 'processing':
                            orderStatus = 'Processing';
                            break;
                        case 'confirmed payment':
                            orderStatus = 'Received';
                            break;
                        default:
                            orderStatus = 'Pending';
                            break;
                    }

                    const paymentInfo = order.payment as PaymentInfo;
                    return {
                        orderNo: order.id + '-' + paymentInfo.transRef,
                        date: order.createdAt.toDateString(),
                        status: orderStatus
                    };
                });

                return userOrders;
            },
            getUserOrderDetails: async (orderId: string, userId: string) => {
                const order = await Order.findById(orderId);
                resolverErrorChecker({
                    condition: !order || order.userInfo.userId !== userId,
                    message: !order ? 'Order not found' : 'Unauthorized request!',
                    code: !order ? 404 : 403
                });

                const paymentInfo = order!.payment as PaymentInfo;
                const orderDetails = {
                    orderNo: orderId + '-' + paymentInfo.transRef,
                    totalAmount: paymentInfo.amount.toString(),
                    orderStatus: order?.status,
                    products: order?.items
                }
                return orderDetails;
            },
            updateUserStats: async (user: HydratedDocument<UserData>) => {
                const presentDay = new Date();
                const lastUpdated = user.stats.date;
                const oneDay = epochTime.milliseconds.oneDay;    // in milliseconds

                if (lastUpdated.toDateString() !== presentDay.toDateString() && presentDay.valueOf() - lastUpdated.valueOf() <= oneDay) {
                    user.stats.sp += 1;
                    if ((presentDay.valueOf() - user.stats.day.date.valueOf()) / oneDay >= 28) {
                        const value = user.stats.day.requiredDays;
                        user.stats.day.requiredDays -= value - 1 === 0 ? 0 : 1; // deduct nothing unless `value` - 1 is greater than 0
                        user.stats.day.date = presentDay;
                    }

                    if ((presentDay.valueOf() - user.stats.xp.date.valueOf()) / oneDay >= user.stats.day.requiredDays) {
                        user.stats.xp.value += 1;
                        user.stats.xp.date = presentDay;
                    }

                    if (user.stats.xp.value >= user.stats.xp.max) {
                        user.stats.level += 1;
                        user.stats.xp.value = 0;
                        user.stats.xp.max += 100;
                    }

                    user.stats.date = presentDay;
                    await user.save();
                } else if (lastUpdated.toDateString() !== presentDay.toDateString()) {
                    user.stats.sp = 1;
                    user.stats.day.requiredDays = 7;
                    user.stats.day.date = presentDay;
                    user.stats.xp.date = presentDay;
                    user.stats.date = presentDay;
                    await user.save();
                }
            }
        },
    });



userSchema.method('editUserWishlist', async function (prodId: string): Promise<wishlistActionResult> {
    const foundProd = this.wishlist.find(obj => obj.productId.toString() === prodId);
    let confirmEditStatus;
    if (foundProd) {
        this.wishlist.pull(foundProd._id);
        confirmEditStatus = false;
    } else {
        this.wishlist.push({ productId: new Types.ObjectId(prodId) });
        confirmEditStatus = true;
    }

    await this.save();

    const result: wishlistActionResult = {
        addedToWishlist: confirmEditStatus,
        actionStatus: confirmEditStatus ? 'Added to wishlist.' : 'Removed from wishlist.'
    }
    return result;
});

userSchema.method('getUserWishlist', async function (currency: ICurrency): Promise<ProductData[]> {

    const itemsLength = this.wishlist.length;
    const populated: UserData = await this.populate('wishlist.productId', 'title category subcategory imageUrls desc condition price stockQty');
    const filteredWishlist = populated.wishlist.filter((pObj) => {
        if (pObj.productId) {
            return true;
        }

        this.wishlist.pull(pObj._id);   // removes the item from user wishlist when it was not found while populating
    });

    let wishlist = [];
    if (filteredWishlist.length > 0) {
        wishlist = filteredWishlist.map((pObj: any) => {
            const price = calPrice(+pObj.productId.price, currency);
            return { ...pObj.productId._doc, id: pObj.id, price: price };
        });
    }


    if (itemsLength !== this.wishlist.length) {
        this.save();
    }

    return wishlist as ProductData[];
});


userSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    try {

        const userId = this.id;
        if (!userId) {
            return next();
        }

        const postsToSave: mongoose.Document<unknown, {}, IPost>[] = [];
        const posts = await Post.find({ comments: { $ne: [] } });  // finds all comments that are not empty

        // where no post was found
        if (1 > posts.length) {
            return next();
        }
        posts.forEach((post) => {
            post.comments.forEach((comm) => {

                if (comm.userInfo.toString() === userId) {
                    post.comments.pull(comm._id);
                    postsToSave.push(post);
                }
            });
        });
        await Post.bulkSave(postsToSave);
    } catch (err: any) {
        console.log('user prehook Error: ', err.message);
        next(new Error('An error occurred processing deletion of related objects'));
    }
});

type wishlistObj = {
    productId: Types.ObjectId;
    _id?: Types.ObjectId;
};

type wishlistActionResult = {
    addedToWishlist: boolean;
    actionStatus: string;
}

export type CartObject = {
    productId: mongoose.Types.ObjectId;
    quantity: number;
    _id?: Types.ObjectId;
};
export type CartData = {
    cartObjId: string;
    prodId: string;
    prodTitle: string;
    imageUrl: string | undefined;
    qty: number;
    price: number;
};

export type UserStats = {
    sp: number;
    day: { requiredDays: number; date: Date; }  // date must be be updated whenever we update day field or reset sp
    xp: { value: number; max: number; date: Date; }; // date must be updated whenever we update xp field or reset sp
    level: number;
    date: Date;
}


export type TypeGamingId = { gamingIdHandle: string | null, platform: string };
export type AccountInfo = {
    role: string | undefined;
    creator: string | undefined;
    phone: string | undefined;
    gamingId: TypeGamingId | null;
    activityReg: string[];
    kycStatus?: string;
}

export type TShopProduct = {
    title: string,
    category: string,
    subcategory: string,
    condition: string,
    price: string
};

export type TypePurchaseHistory = {
    date: Date,
    products: TShopProduct[] | { [key: string]: any },
    totalAmount: string
};

export interface UserDocProps {
    refreshToken?: string;
    profilePic: string | null;
    myGames: { category: string, names: string[] }[];
    purchaseHistory: TypePurchaseHistory[];
    wishlist: Types.Array<wishlistObj>;
    cart: Types.Array<CartObject>;
}

export interface UserData extends UserDocProps, IDocProps, Document, IUserMethods {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
    stats: UserStats;
    accInfo: AccountInfo;
};

export default mongoose.model<UserData, UserModel>("User", userSchema);

