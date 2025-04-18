import { HydratedDocument } from 'mongoose';

import { Slide } from "../models/slide";
import { UserData, CartObject, TypeGamingId, UserDocProps } from '../models/user';
import { TypeUtilityBill, TypeValidId } from '../models/kyc';
import { Request } from 'express';
import { ICurrency } from '../models/currency';





export interface CtxArgs {
    req: Request & ReqObj;
}

export interface ParentObjectData {
    id: string;
    checkoutOrderType: string;
    payOnDelivery: { status: boolean, totalAmount: string | null };
    orderId: string;
    postId: string;
    commentId: string;
    email: string;
    deliveryAddress: string;
    phone: string;
    password: string;
    accData: AccData;
    token: string;
    slideInput: Slide;
    prodId: string;
    cartObjId: string;
    cartObj: CartObject;
    userComment: string;
    amount: string;
    version: number | null;
    platform: string;
    serialNumber: string | null;
    userQueryInput: UserQueryInput;
    imageUrls: string[];
}

type ReqObj = {
    timedout: boolean;
    guestUser: boolean;
    // guestUser: { email: string, phone: string, address: string, cart: any[] };
    userId: string;
    isAuth: boolean;
    accType: string;
    user: HydratedDocument<UserData>;
    currency: ICurrency;
    get(header: string): string | undefined;
    isSuperReq: boolean | undefined;
}

type AccData = {
    profilePic: string | null;
    phone: string | null;
    gamingId: TypeGamingId;
    myGames: UserDocProps['myGames']
}


type UserQueryInput = {
    validId: TypeValidId;
    payOnDelivery: { status: boolean, totalAmount: string | null };
    deliveryAddress: string;
    utilityBill: TypeUtilityBill;
    residenceAddress: string;
    status: string;
    password: string;
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
    userId: string;
    token: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePic: string | null;
    email: string;
    phone: string | null;
    gamingIdHandle: string | null;
    platform: string;
    myGames: UserDocProps['myGames'];
    reason: string;
    otherReason: string | undefined;
};

export type TActionStatus = { success: boolean, message: string };
