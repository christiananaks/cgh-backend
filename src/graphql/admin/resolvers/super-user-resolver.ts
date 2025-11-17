import fs from 'fs';


import AdminKey, { accessKeysFile } from "../../../models/admin-keys.js";
import { Slide } from "../../../models/slide.js";
import { resolverErrorChecker } from "../../../util/helper.js";
import appResolvers from '../../public/app-resolvers.js';
import { CtxArgs, InputArgs } from '../../../models/type-def.js';



export interface AdminArgs {
    id: string;
    categoryTitle?: string;
    subcategoryTitle: string;
    subcategoryTitles: string[];
    prodId: string | null;
    email: string;
    password: string;
    orderProgress: string;
    userId: string;
    token: string;
    slideInput: Slide;
    keyword: string;
    postTitle: string;
    adminQueryInput: AdminQueryInput;
    action: string;
    orderId: string;
    trendingGameInput: TrendingGameData;
    currencyOption: string;
    progress: string;
}


type AdminQueryInput = {
    title: string;
    duration: string;
    game: string[];
    platform: string;
    subCategory: string;
    gameList: string[];
    installType: string;
    installDuration: string | null;
    homeService: string | undefined;
    desc: string | null;
    info: string;
    genre: string[];
    acceptedTitles: string[] | null;
    swapFee: number;
    yearOfRelease: string;
    imageUrl: string;
    imageUrls: string[];
    condition: string | null;
    category: string;
    subcategory: string;
    price: number;
    stockQty: number | null;
    country: string;
    currency: string;
    rate: number;
}

type TrendingGameData = {
    title: string;
    imageUrl: string;
    desc: string | null;
    rating: number;
    platform: string | undefined;
    genre: string;
}


export default {
    Query: {
        getAccessKeys: async (parent: any,) => {
            const adminKeys = await AdminKey.getAdminKeys();
            const usableKeys = adminKeys.filter(key => !key.user);
            return { allAccessKeys: adminKeys, freeAccessKeys: usableKeys };
        },

        generateAccessKey: async (parent: any, { }, args: any, { req }: CtxArgs) => {
            resolverErrorChecker({
                condition: req.role !== 'superuser',
                code: 403,
                message: 'Error: Unauthorized access.'
            });
            const accessKeys = await AdminKey.getAdminKeys();
            const keysArray = accessKeys.map(obj => obj.access);
            return AdminKey.genKey(keysArray);
        },
    },
    Mutation: {
        createAdminUser: async (parent: any, { userQueryInput }: InputArgs, { req }: any) => {
            resolverErrorChecker({
                condition: !req.isAuth || req.role !== 'superuser',
                code: !req.isAuth ? 401 : 403,
                message: !req.isAuth ? 'Please login to continue.' : 'Forbidden request.'
            });
            req.isSuperReq = true; // check the state in createUser. if undefined then reset accInfo
            const dataArgs: any = [{ userQueryInput }, { req }];

            return appResolvers.Mutation.createUser(undefined, dataArgs[0], dataArgs[1]);

        },
        createAdminAccKeyword: async (parent: any, { keyword }: AdminArgs, args: any, { req }: CtxArgs) => {

            if (req.role !== 'superuser') {
                const error = new Error('User is not authorized');
                Object.assign(error, { statusCode: 403 });
                throw error;
            }

            const accessKeys = await AdminKey.getAdminKeys();
            if (accessKeys.length > 4) {
                const error: { [key: string]: any } = new Error('Keys list full :(');   // we can also handle this situation on the frontend
                error.statusCode = 500;
                throw error;
            }

            const enteredKeyword = keyword.trim();
            let isPresent = accessKeys.map(data => data.access).includes(enteredKeyword);
            const inputPattern = /^\d{2}\W{3}$/;
            if (enteredKeyword.length != 5 || !inputPattern.test(enteredKeyword) || isPresent) {
                const error: { [key: string]: any } = new Error(isPresent ? `"${enteredKeyword}" already exists!` : 'Entered word is invalid.');
                error.statusCode = 422;
                throw error;
            }

            const adminKey = new AdminKey({ user: null, access: enteredKeyword });

            await adminKey.save();
            accessKeys.push(adminKey.accessData);


            return accessKeys;
        },

        deleteAdminAccKeyword: async (parent: any, { keyword }: AdminArgs, args: any, { req }: CtxArgs) => {
            let accessKeys = await AdminKey.getAdminKeys();
            let isPresent = accessKeys.map(data => data.access).includes(keyword);

            if (!isPresent) {
                const error: { [key: string]: any } = new Error('Keyword not found!');
                error.statusCode = 404;
                throw error;
            }

            accessKeys = accessKeys.filter(data => data.access !== keyword);

            fs.writeFile(accessKeysFile, JSON.stringify(accessKeys), err => {
                if (err) console.log(err);
            });
            return true;
        },
        clearAccessKeys: async (parent: any, { }, args: any, { req }: CtxArgs) => {
            resolverErrorChecker({ condition: req.role !== 'superuser', code: 403, message: 'Error: Unauthorized user.' });
            fs.writeFile(accessKeysFile, JSON.stringify([]), (err: any) => {
                if (err) {
                    throw new Error(err.message);
                }
            });
            return [];
        },
    },

}