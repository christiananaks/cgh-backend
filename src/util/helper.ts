import fs from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';


import User, { UserData, UserStats } from '../models/user.js';
import { IServMnt } from '../models/serv-mnt.js';
import { ICurrency } from '../models/currency.js';
import { TBlacklist } from '../models/type-def.js';
import { GraphQLError } from 'graphql';

export const epochTime = { seconds: { oneDay: 86400 }, milliseconds: { oneDay: 86400000 } };
export let allGenre = new Set(['Action', 'Action-Adventure', 'Role-Playing Games (RPGs)', 'Simulation', 'Sports', 'Versus', 'Adventure', 'Racing']);
export const orderEnums = ['Pending', 'Confirmed Payment', 'Processing', 'Processed', 'Delivered', 'Completed'];
export const activityReg = [
    'add-to-cart',
    'add-to-wishlist',
    'add-comment',
    'created-kyc',
    'kyc-success',
    'uploaded-profile-pic'
];


export const getDirname = (fileUrl: string) => dirname(fileURLToPath(fileUrl));
export const isProductionEnv = process.env.NODE_ENV === 'production';
export const paths = {
    imageDir: path.join(getDirname(import.meta.url), '../../uploads/images'),
    documentDir: path.join(getDirname(import.meta.url), '../../uploads/documents'),
    miscDir: path.join(getDirname(import.meta.url), '../../uploads/misc'),
    data: path.join(getDirname(import.meta.url), '../../data')
}

export const tokenDuration = { access: isProductionEnv ? '24h' : '3h', refresh: isProductionEnv ? '7d' : '5h' };
/**
 * Generates accessToken and refreshToken for auth user.
 * @param user 
 * @returns { accessToken: string, refreshToken: string } 
 */
export function createTokens(user: UserData): { accessToken: string, refreshToken: string } {

    const accessToken = jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.accInfo.role,
    }, `${process.env.ACCESS_TOKEN_PRIVATE_KEY}`, { expiresIn: tokenDuration.access });

    const refreshToken = jwt.sign({
        expires: new Date(getExpiryTime(tokenDuration.refresh))
    }, `${process.env.REFRESH_TOKEN_PRIVATE_KEY}`, { expiresIn: tokenDuration.refresh });


    return { accessToken, refreshToken };
}

export function getExpiryTime(duration: string) {

    const options = new Map([['d', 86400000], ['m', 60000], ['h', 3600000]]);
    const period = duration[duration.length - 1];
    const result = Date.now() + parseInt(duration) * options.get(period)!;
    return result;
}


export async function blacklistToken(token: string, verify = false) {
    const filePath = paths.data + '/token-blacklist.json';
    const buffer = await fs.readFile(filePath);
    let blacklist: TBlacklist[] = JSON.parse(buffer.toString());

    if (verify) {
        const foundToken = blacklist.find(data => data.token === token);
        if (foundToken) {
            throw new CustomError('Invalid token!', 400);
        }
        return;
    }

    const oneDay = 86400000;   // in milliseconds
    // where the latest token date is at least 24hrs old and array contains over 999 tokens we clear array
    if (blacklist.length > 999 && new Date(blacklist[blacklist.length - 1].date).valueOf() + oneDay < Date.now()) {
        blacklist = [];
    }

    blacklist.push({ token: token, date: new Date().toISOString() });
    await fs.writeFile(filePath, JSON.stringify(blacklist));
    return;

}


/** Checks if numbers length after decimal point is greater than 2 */
export const validatePriceFormat = (price: number): boolean => {
    if (price.toString().includes('.') && price.toString().split('.')[1].length > 2) {
        return true;
    }
    return false;
}


/** Helper function for calculating products price based on app currency settings */
export const calPrice = (price: number, currency: ICurrency): number => {
    if (currency.currency !== 'NGN') {
        return parseFloat((price * currency.rate).toFixed(2));
    }
    return Math.round(price * currency.rate);
}


export class GraphQLCustomError extends GraphQLError {
    constructor(message: string, httpStatus = 500) {
        super(message, { extensions: { httpStatus } });
    }
}

export class CustomError extends Error {
    statusCode: number;
    constructor(message?: string, statusCode?: number) {
        super(message || 'An error ocurred.');
        this.statusCode = statusCode || 500;
    }
}

export type ErrData = {
    condition: boolean;
    message?: string;
    code?: number;
}
/** error checker function  */
export function resolverErrorChecker(args: ErrData): void {
    if (args.condition) {
        throw new GraphQLCustomError(args.message || 'An error occurred!', args.code);
    }
}


/**
 * Helper function that is used to determine the user role
 * from the login query.
 * @param req 
 * @param mgtState 
 * @returns 
 */
export async function loginReqAccRole(req: any, mgtState: IServMnt) {
    if (req.body.operationName !== 'Login') {
        return { success: false, role: null };
    }
    // get the email entered by the user from login page
    const reqQuery: string = req.body.query; // graphql query sent by client
    const start = reqQuery.indexOf('"');
    const enteredEmail = reqQuery.slice(reqQuery.indexOf('"', start) + 1, reqQuery.indexOf('"', start + 1));
    const user = await User.findOne({ email: enteredEmail });

    // success is `true` only when user is found and role is admin
    if (!user || user.accInfo.role === 'standard' || user.accInfo.role === 'admin' && mgtState.level === 2) {
        return { success: false, role: null };
    }

    return { success: true, role: user.accInfo.role };
}



export async function createSuperUser(password: string) {
    const hashPw = await bcrypt.hash(password, 12);
    const date = new Date();
    const user = new User({
        firstName: process.env.FIRST_NAME || 'super',
        lastName: process.env.LAST_NAME || 'user',
        username: 'superuser' + date.toISOString().split('.')[1],
        email: process.env.SU_EMAIL,
        password: hashPw,
        accInfo: {
            role: 'superuser',
            phone: '09055544422',
            activityReg: activityReg
        }
    });
    return user.save();
}

export function resUserstats(stats: UserStats) {
    return { sp: stats.sp, xp: stats.xp.value, maxXp: stats.xp.max, level: stats.level, date: stats.date.toISOString() };;
}