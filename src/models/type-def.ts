import { ReadStream } from 'fs';

import { HydratedDocument } from 'mongoose';
import { Request, Response } from 'express';

import { Slide } from "./slide.js";
import { UserData, CartObject, TypeGamingId, UserDocProps } from './user.js';
import { TypeUtilityBill, TypeValidId } from './kyc.js';
import { ICurrency } from './currency.js';



export interface CtxArgs {
    req: ReqObj;
    res: Response;
}


export interface InputArgs {
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
    files: TFile[];
    uploadPathName: string;
}

export type TFile = {
    promise: Promise<{ createReadStream(): ReadStream; filename: string; mimetype: string; encoding: string; }>
};

type ReqObj = {
    token: string;
    guestUser: boolean;
    userId: string;
    isAuth: boolean;
    role: string;
    user: HydratedDocument<UserData>;
    currency: ICurrency;
    get(header: string): string | undefined;
    isSuperReq: boolean | undefined;
} & Request;


type AccData = {
    profilePic: string | null;
    phone: string | null;
    gamingId: TypeGamingId;
    myGames: UserDocProps['myGames']
}


type UserQueryInput = {
    dateOfBirth: string;
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
    phone: string | undefined;
    gamingIdHandle: string | null;
    platform: string;
    myGames: UserDocProps['myGames'];
    reason: string;
    otherReason: string | undefined;
};

export type TActionStatus = { success: boolean, message: string };

export interface IDocProps {
    _doc: Omit<this, '_doc'>;
    createdAt: Date;
    updatedAt: Date;
};

export type TBlacklist = {
    token: string;
    date: string;
};

export type FileStorageArgs = {
    uploadedFiles: Awaited<TFile['promise']>[],
    id: string | false,
    folderName: string,
    pathName?: string,
    filesURLPath: string[]
};