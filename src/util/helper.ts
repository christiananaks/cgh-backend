import fs from 'fs';


import nodemailer from 'nodemailer';
import nodemailerSendgrid from 'nodemailer-sendgrid';
import { NextFunction, Request, Response } from 'express';




import User from '../models/user';
import { IServMnt } from '../models/serv-mnt';
import { ICurrency } from '../models/currency';


export let allGenre = new Set(['Action', 'Action-Adventure', 'Role-Playing Games (RPGs)', 'Simulation', 'Sports', 'Versus', 'Adventure', 'Racing']);
export const orderEnums = ['Pending', 'Confirmed Payment', 'Processing', 'Processed', 'Delivered', 'Completed'];
export const repairStatusEnum = ['Pending', 'Confirmed Payment', 'Processed', 'Received', 'Repair in progress', 'Repair succeeded', 'Repair failed', 'Sent', 'Delivered', 'Paid'];
export const activityReg = [
    'add-to-cart',
    'add-to-wishlist',
    'add-comment',
    'created-kyc',
    'kyc-success',
    'uploaded-profile-pic'
];

/** Checks if numbers after decimal point is greater than 2 */
export const validatePriceFormat = (price: number): boolean => {
    if (price.toString().includes('.') && price.toString().split('.')[1].length > 2) {
        // const error: {[key: string]: any} = new Error('Invalid price format.\nToo many numbers after decimal point :(');
        // error.statusCode = 422;
        // throw error;
        return true;
    }
    return false;
}

type TCalPrice = (price: number, currency: ICurrency) => number;
/** Helper function for calculating products price based on app currency settings */
export const calPrice: TCalPrice = (price: number, currency: ICurrency) => {
    if (currency.currency !== 'NGN') {
        return parseFloat((price * currency.rate).toFixed(2));
    }
    return Math.round(price * currency.rate);
}


export type ErrData = {
    condition: boolean;
    message?: string;
    code?: number;
}
/** error checker function  */
export function resolverErrorChecker(args: ErrData): void {
    if (args.condition) {
        const error: { [key: string]: any } = new Error(args.message || 'An error has occurred.');
        error.statusCode = args.code || 500;
        throw error;
    }
}

/**
 * Helper function for sending email to one recipient
 * @param email 
 * @param subject 
 * @param htmlBody 
 */
export async function sendEmail(email: string, subject: string, htmlBody: string): Promise<void> {
    const transport = nodemailer.createTransport(nodemailerSendgrid({
        apiKey: `${process.env.SENDGRID_KEY}`
    }));

    await transport.sendMail({
        from: `${process.env.COMPANY_EMAIL}`,
        to: email,
        subject: subject,
        html: htmlBody,
    });
}

/**
 * Helper function that is used to determine the user accType
 * from the login query.
 * @param req 
 * @param mgtState 
 * @returns 
 */
export async function loginReqAccType(req: any, mgtState: IServMnt) {
    if (req.body.operationName !== 'Login') {
        return { success: false, accType: null };
    }
    // get the email entered by the user from login page
    const reqQuery: string = req.body.query; // graphql query sent by client
    const start = reqQuery.indexOf('"');
    const enteredEmail = reqQuery.slice(reqQuery.indexOf('"', start) + 1, reqQuery.indexOf('"', start + 1));
    const user = await User.findOne({ email: enteredEmail });

    // success only returns true when user is found and accType is admin
    if (!user || user.accInfo.accType === 'standard' || user.accInfo.accType === 'admin' && mgtState.level === 2) {
        return { success: false, accType: null };
    }

    return { success: true, accType: user.accInfo.accType };
}


/** Custom middleware timeout */
export function mwTimeout(duration: number) {
    const timeoutMW = async (req: Request, res: Response, next: NextFunction) => {
        const timeout = setTimeout(() => {
            const error: any = new Error('request time out.');
            error.statusCode = 408;
            next(error);
        }, duration);

        res.on('finish', () => {
            clearTimeout(timeout);
            console.log('cleared timeout....');
        });
        next();
    }
    return timeoutMW;
}


