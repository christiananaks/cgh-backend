import path from 'path';
import fs from 'fs';
import { readdir } from 'fs/promises';

import validator from 'validator';
import mongoose, { HydratedDocument } from 'mongoose';

import { CtxArgs, InputArgs } from "../../../models/type-def.js";
import User, { UserData } from "../../../models/user.js";
import { resolverErrorChecker, orderEnums, validatePriceFormat, getDirname, isProductionEnv, GraphQLCustomError, checkUserRole } from "../../../util/helper.js";
import { paths } from '../../../util/helper.js';
import AdminKey from "../../../models/admin-keys.js";
import { Slide, slidesFilePath } from "../../../models/slide.js";
import { clearImage, s3DeleteObject } from "../../../util/file-storage.js";
import Product, { ProductData } from '../../../models/product.js';
import Categories from '../../../models/category.js';
import { AdminArgs } from './super-user-resolver.js';
import Post from '../../../models/post.js';
import Order, { orderProgressOptions } from '../../../models/order.js';
import TrendingGames from '../../../models/trending-games.js';
import Kyc from '../../../models/kyc.js';
import GameDownload from '../../../models/game-download.js';
import Currency, { ICurrency } from '../../../models/currency.js';
import Options, { IOptions } from '../../../models/options.js';
import GameRepair from '../../../models/game-repair.js';
import Refund from '../../../models/refund.js';
import GameSwap, { IGameSwap } from '../../../models/game-swap.js';
import GameRent from '../../../models/game-rent.js';
import Mailing from '../../../models/mailing.js';
import InAppNotice from '../../../models/in-app-notice.js';


const Query = {
    getAdminUsers: async (parent: any, { }, { req }: CtxArgs) => {
        resolverErrorChecker({ condition: !req.isAuth, code: 401, message: 'Please sign-in to complete request' });
        resolverErrorChecker({ condition: !['admin', 'superuser'].includes(req.role), code: 403, message: 'Unauthorized request.' });
        const foundAdmins: UserData[] = await User.find({ 'accInfo.role': "admin" }).select('email username');


        return foundAdmins;
    },
    getAdminUserInfo: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {
        resolverErrorChecker({ condition: !req.isAuth, code: 401, message: 'Please sign-in to complete request' });
        resolverErrorChecker({ condition: !['admin', 'superuser'].includes(req.role), code: 403, message: 'Unauthorized request.' });
        const foundAdmin: UserData | null = await User.findById(id);

        if (!foundAdmin) {
            const error: any = new Error('User does not exist.');
            error.statusCode = 404;
            throw error;
        }
        // get the key
        const keys = await AdminKey.getAdminKeys();
        const index = keys.findIndex(data => data.user === foundAdmin.email);

        const adminAccessKey = index > -1 ? keys[index].access : null;

        return {
            id: foundAdmin.id,
            accessKey: adminAccessKey,
            firstName: foundAdmin.firstName,
            lastName: foundAdmin.lastName,
            username: foundAdmin.username,
            email: foundAdmin.email,
            role: foundAdmin.accInfo.role
        }
    },
    findUser: async (parent: any, { searchBy, value }: any, { req }: CtxArgs) => {
        const searchOption: string = searchBy.trim();
        const searchVal: string = value.trim();
        checkUserRole(req);

        resolverErrorChecker({ condition: !['userId', 'username', 'email'].includes(searchOption), message: 'Invalid search parameter.', code: 404 });
        resolverErrorChecker({ condition: validator.isEmpty(searchVal), message: `${searchOption} is required.`, code: 422 });

        resolverErrorChecker({
            condition: searchOption === 'userId' && searchVal.length !== 24 || searchOption === 'username' && 5 > searchVal.length || searchOption === 'email' && !validator.isEmail(searchVal),
            message: `Invalid ${searchOption}!`, code: 422
        });

        var user: UserData | null;
        switch (searchOption) {
            case 'userId':
                user = await User.findOne({ _id: searchVal });
                break;
            case 'username':
                user = await User.findOne({ username: searchVal });
                break;
            default:
                user = await User.findOne({ email: searchVal.toLowerCase() });
                break;
        }
        if (!user) {
            const error: { [key: string]: any } = new Error('User not found.');
            error.statusCode = 404;
            throw error;
        }

        const accessKeys = await AdminKey.getAdminKeys();
        const adminKeys = accessKeys.map(obj => obj.access);
        const hasKeys = user.accInfo.role!.includes('admin') && adminKeys.includes(user.username.slice(user.username.length - 5));

        return {
            id: user.id,
            accessKey: hasKeys ? true : undefined,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            email: user.email,
            role: user.accInfo.role,
            stats: user.stats
        }
    },
    fetchPosts: async (parent: any, args: any, { req }: CtxArgs) => {
        checkUserRole(req);

        let posts = await Post.find().select('postTitle');

        if (!posts) {
            return [];
        }

        const postDocs = posts.map((post) => {
            return { postId: post.id, ...post._doc }
        });

        return postDocs;
    },
    getOrders: async (parent: any, { }, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        checkUserRole(req);
        const orders = await Order.getOrders();
        return orders;
    },
    getOrder: async (parent: any, { orderId }: AdminArgs, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        const currency = req.currency as ICurrency;

        checkUserRole(req);
        const order = await Order.getOrder(orderId, currency);
        return order;
    },
    getOrderProgressOptions: async (parent: any, { }, { req }: CtxArgs) => {
        const { isAuth, role } = req;

        checkUserRole(req);
        return { ...orderProgressOptions };
    },
    trendingGamesList: async (parent: any, { }, { req }: CtxArgs) => {
        checkUserRole(req);

        const trendingGames = await TrendingGames.find().select('title rating');
        if (1 > trendingGames.length) {
            return [];
        }

        const games = trendingGames.map(game => {
            return { id: game.id, ...game._doc };
        });
        return games;
    },
    getUsersKyc: async (parent: any, { }, { req }: CtxArgs) => {
        checkUserRole(req);

        const kycArray = await Kyc.find();
        if (1 > kycArray.length) {
            return [];
        }

        const usersKycList = kycArray.map((data) => {
            return {
                id: data.id,
                userId: data.userId.toString(),
                fullname: data.fullname,
                status: data.status,
            };
        });

        return usersKycList;

    },
    viewUserKyc: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);

        const foundKyc: any = await Kyc.findById(id).populate('userId', '_id email');

        if (!foundKyc) {
            const error: { [key: string]: any } = new Error('KYC not found :(');
            error.statusCode = 404;
            throw error;
        }
        const kycDocs = [{ kind: foundKyc.validId.kind, file: foundKyc.validId.docUrl }, { kind: foundKyc.utilityBill.kind, file: foundKyc.utilityBill.docUrl }];
        return {
            id: foundKyc.id,
            userId: foundKyc.userId._id,
            fullname: foundKyc.fullname,
            email: foundKyc.userId.email as string,
            residence: foundKyc.residenceAddress,
            phone: foundKyc.phone,
            documents: kycDocs
        }
    },
    getCurrencyList: async (parent: any, { }, { req }: CtxArgs) => {

        checkUserRole(req);
        return await Currency.find();
    },
    getRefunds: async (parent: any, { }, { req }: CtxArgs) => {

        checkUserRole(req);
        return await Refund.refunds();
    },
    getRefundInfo: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {

        checkUserRole(req);
        try {
            return await Refund.usersRefundInfo(id);
        } catch (err: any) {
            err.statusCode = 404;
            throw err;
        }
    },
    getAllAppNotice: async (parent: any, { }, { req }: CtxArgs) => {

        checkUserRole(req);
        const docs = await InAppNotice.getAllDocs();

        return docs;
    }
};


const Mutation = {
    createProduct: async (parent: any, { adminQueryInput, prodId }: AdminArgs, { req }: CtxArgs) => {
        const { isAuth, userId, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            code: !isAuth ? 401 : 403,
            message: !isAuth ? 'Please login to continue.' : 'Error: Unauthorize request.'
        });


        const title = adminQueryInput.title.trim();
        const category = adminQueryInput.category;
        const subcategory = adminQueryInput.subcategory;
        const imageUrls = adminQueryInput.imageUrls;
        const desc = adminQueryInput.desc ? adminQueryInput.desc.trim() : null;
        const price = adminQueryInput.price;
        const condition = adminQueryInput.condition;
        const stockQty = adminQueryInput.stockQty || undefined;   // when undefined the schema sets the default value for creating new products
        let isCreated = true;
        let isUpdated = false;

        resolverErrorChecker({
            condition: validatePriceFormat(price),
            message: 'Invalid price format.\nToo many numbers after decimal point, expected two numbers or less :(',
            code: 422
        });

        const allCategories = await Categories.find();
        const foundCategory = allCategories.find((doc) => doc.title.toLowerCase() === category.toLowerCase());
        resolverErrorChecker({ condition: !foundCategory, message: 'Oops! That category does not exists.', code: 404 });
        resolverErrorChecker({ condition: !foundCategory!.subcategoryData.has(subcategory), message: 'Oops! That subcategory does not exists.', code: 404 });


        resolverErrorChecker({
            condition: validator.isEmpty(title) || !validator.isLength(title, { min: 5, max: 50 }),
            message: validator.isEmpty(title) ? 'Product title is required.' : 'Product title length must be between 5-80 characters',
            code: 422
        });

        if (desc) {
            resolverErrorChecker({
                condition: validator.isEmpty(desc) || !validator.isLength(desc, { max: 300 }),
                message: validator.isEmpty(desc) ? 'Product description is required.' : 'Description length must be below 300 characters',
                code: 422
            });
        }

        resolverErrorChecker({
            condition: 0 > price, message: 'Invalid price! Number must be positive.', code: 422
        });

        var product: HydratedDocument<ProductData> | null;
        if (!prodId) {
            product = new Product({
                title: title,
                category: category,
                subcategory: subcategory,
                imageUrls: imageUrls,
                desc: desc,
                price: price,
                condition: condition,
                stockQty: stockQty
            });

            // if prodId already exist update product data
        } else {
            product = await Product.findById(prodId);
            resolverErrorChecker({ condition: !product, message: 'Product was not found :(', code: 404 });

            product!.desc = desc || product!.desc;
            product!.price = price;
            product!.imageUrls = imageUrls.length > 0 ? imageUrls : product!.imageUrls;
            product!.stockQty = stockQty ? product!.stockQty + stockQty : product!.stockQty; // if set use the old + newInput, else keep the old data.
            isUpdated = true;
            isCreated = false;
        }

        const savedProduct = await product!.save();

        if (isUpdated === false) {
            await foundCategory!.addToCategory(savedProduct);
            foundCategory!.save();
        }

        return { product: { ...savedProduct._doc, id: savedProduct.id }, isCreated: isCreated, isUpdated: isUpdated };
    },
    deleteProduct: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {
        resolverErrorChecker({
            condition: !req.isAuth || !['admin', 'superuser'].includes(req.role),
            code: !req.isAuth ? 401 : 403,
            message: !req.isAuth ? 'Please login to continue.' : 'Error: Unauthorize request.'
        });

        const foundProduct = await Product.findOne({ _id: id });
        if (!foundProduct) {
            const error: any = new Error('Product does not exists');
            error.statusCode = 404;
            throw error;
        }
        await foundProduct.deleteOne();
        if (foundProduct.imageUrls.length > 0) {

            const fileKey = foundProduct!.imageUrls[0].split('.com/')[1];
            const prefix = fileKey.substring(0, fileKey.lastIndexOf("/")) + "/";
            if (isProductionEnv) {
                await s3DeleteObject(prefix);
            }
            else {
                const prodImageDir = foundProduct.imageUrls[0].substring(0, foundProduct.imageUrls[0].lastIndexOf('/'));
                fs.rm(`${prodImageDir}`, { recursive: true, force: true }, (err) => {
                    if (err) {
                        console.log(err.message);
                    }
                });
            }
        }

        const foundCategory = await Categories.findOne({ title: foundProduct.category });
        const subcategoryProducts = foundCategory?.subcategoryData.get(foundProduct.subcategory);

        if (foundCategory && subcategoryProducts && subcategoryProducts.length > 0) {
            const index = subcategoryProducts.indexOf(foundProduct._id) as number;
            foundCategory?.subcategoryData.get(foundProduct.subcategory)?.splice(index, 1);

        }

        foundCategory?.save();

        return { success: true, message: `Product: ${foundProduct.title} was successfully deleted.` };
    },
    createOrEditCategory: async (parent: any, { id, categoryTitle, subcategoryTitles }: AdminArgs, { req }: CtxArgs) => {

        checkUserRole(req);

        resolverErrorChecker({ condition: 1 > subcategoryTitles.length, message: 'Subcategory Titles cannot be empty!', code: 422 });

        const subCatData: Map<string, object[]> = new Map();
        subcategoryTitles.forEach(subcategoryTitle => {
            // the `subcategoryTitles` list is not mutated here we just adjust the elements to the desired form for the subCatData Map.
            subcategoryTitle = (subcategoryTitle[0].toUpperCase() + subcategoryTitle.substring(1)).trim();
            subCatData.set(subcategoryTitle, []);
        });


        if (!id) {
            await Categories.create({ title: (categoryTitle![0].toUpperCase() + categoryTitle!.substring(1)).trim(), subcategoryData: subCatData });
            return { success: true, message: `${categoryTitle} has been created.` };
        }

        const category = await Categories.findById(id);
        resolverErrorChecker({ condition: !category, message: 'Category not found :(', code: 404 });

        subcategoryTitles.forEach(subcategoryTitle => {
            subcategoryTitle = subcategoryTitle.toUpperCase();
            category!.subcategoryData.set(subcategoryTitle, []);
        });

        await category!.save();

        return { success: true, message: `Updated subcategories of ${category?.title}` };
    },
    addProductToCategory: async (parent: any, { id, categoryTitle, subcategoryTitle }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);

        resolverErrorChecker({ condition: !id, message: 'Product ID must be provided!', code: 422 });

        if (!categoryTitle) {
            const error: { [key: string]: any } = new Error('Category must be provided');
            error.statusCode = 422;
            throw error;
        }

        if (categoryTitle && subcategoryTitle) {
            let foundCategory = await Categories.findOne({ title: categoryTitle });
            resolverErrorChecker({ condition: !foundCategory, message: 'Category not found :(', code: 404 });
            foundCategory = foundCategory!;
            let foundSubcategory = foundCategory.subcategoryData.get(subcategoryTitle);
            resolverErrorChecker({ condition: !foundSubcategory, message: `Subcategory: ${subcategoryTitle} does not exist!`, code: 404 });
            foundSubcategory = foundSubcategory!;

            const isExistingProd = foundSubcategory.findIndex((obj) => String(obj.id) === id);

            if (isExistingProd > -1) {
                throw new Error(`The added product already exists in ${subcategoryTitle} products list`);
            }
            foundSubcategory.push(new mongoose.Types.ObjectId(id!));

            foundCategory.save();
            return { success: true, message: `Product added to ${categoryTitle} > ${subcategoryTitle}` };

        } else {
            const error: { [key: string]: any } = new Error(!categoryTitle ? 'Category title must be provided!' : 'Subcategory title must be provided!');
            error.statusCode = 422;
            throw error;
        }
    },
    deleteCategory: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {

        checkUserRole(req);

        const foundCategory = await Categories.findById(id);

        resolverErrorChecker({
            condition: !foundCategory,
            code: 404,
            message: 'Category does not exist :('
        });


        if ([...foundCategory!.subcategoryData.values()].length > 0) {
            console.log([...foundCategory!.subcategoryData.values()]);

            for (const [key, val] of foundCategory!.subcategoryData) {
                if (val.length > 0) {
                    throw new Error(`Error: There are live products in this Category! Subcategory: ${key} has products.`);
                }
            }
        } else {
            await foundCategory!.deleteOne();
        }

        return { success: true, message: 'Category has been successfully deleted.' };

    },
    createSlide: async (parent: any, { adminQueryInput }: AdminArgs, { req }: CtxArgs) => {
        const { user } = req;

        checkUserRole(req);

        const title = adminQueryInput.title.trim();
        const image = adminQueryInput.imageUrl;
        const description = adminQueryInput.desc?.trim() || null;
        const creator = user.username;

        resolverErrorChecker({
            condition: validator.isEmpty(title) || !validator.isLength(title, { min: 5, max: 50 }),
            message: validator.isEmpty(title) ? 'Slide title is required.' : 'Slide title must be between 5-50 characters',
            code: 422
        });

        if (description) {
            resolverErrorChecker({
                condition: !validator.isLength(description, { min: 5, max: 300 }),
                message: 'Description length must be between 5-300 characters',
                code: 422
            });
        }


        const slides = await Slide.fetchSlides();
        if (slides.length > 0) {
            slides.forEach((slide) => {
                if (slide.title === title) {
                    const error: { [key: string]: any } = new Error('Slide already exists!');
                    error.statusCode = 409;
                    throw error;
                }
            })
        }

        const slide = new Slide(title, description, image, creator);

        await slide.save();

        return { ...slide };
    },
    deleteSlide: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {

        let savedSlides = await Slide.fetchSlides();

        // BULK DELETE WHEN ID === 'all'
        let isBulkDelete = savedSlides.length > 0 && id === 'all';
        if (isProductionEnv && isBulkDelete) {
            const slideImageDir = savedSlides[0].imageUrl.split('.com/')[1];
            const folderName = slideImageDir.slice(0, slideImageDir.lastIndexOf('/'));
            await s3DeleteObject(`${folderName}/`);
            Slide.clearSlidesFile().catch(err => console.log(err.message));
            return true;
        } else if (!isProductionEnv && isBulkDelete) {
            const files = await readdir(`${paths.imageDir}/slide/`);
            for (const filename of files) {
                await clearImage(`uploads/images/slide/${filename}`);
            }
            Slide.clearSlidesFile().catch(err => console.log(err.message));
            return true;
        }
        //===================================================================


        const imageUrl = savedSlides.find((s) => s.id == id)?.imageUrl;

        if (imageUrl) {
            const fileKey = isProductionEnv && imageUrl.split('.com/')[1];
            isProductionEnv ? await s3DeleteObject(fileKey as string) : await clearImage(imageUrl);
        } else {
            throw new GraphQLCustomError('Error: Object does not exist in slides.json', 404);
        }

        savedSlides = savedSlides.filter((s) => s.id !== id);

        // write the modified file data
        fs.writeFile(slidesFilePath, JSON.stringify(savedSlides), err => err ? console.log('write error after deleting image file: ', err.message) : '');

        return true;

    },
    deleteUser: async (parent: any, { searchBy, value }: any, { req }: CtxArgs) => {
        const field: string = searchBy;
        const data: string = value;

        checkUserRole(req);

        var foundUser: UserData | null;
        switch (field) {
            case 'username':
                foundUser = await User.findOne({ username: data });
                break;
            default:
                foundUser = await User.findOne({ email: data });
                break;
        }

        if (!foundUser) {
            const error: any = new Error('User does not exist.');
            error.statusCode = 404;
            throw error;
        }

        resolverErrorChecker({ condition: foundUser.accInfo.role === 'superuser', code: 500, message: 'This user cannot be deleted. nkiti ta gbuo gi!' });
        await foundUser.deleteOne();


        const foundKyc = await Kyc.findOne({ userId: foundUser.id });
        if (foundKyc) {
            console.log('found his KYC!')
            await foundKyc.deleteOne();
        }

        if (foundUser.profilePic && isProductionEnv) {
            const fileKey = foundUser.profilePic.split('.com/')[1];
            await s3DeleteObject(fileKey);
        } else if (foundUser.profilePic && !isProductionEnv) {
            await clearImage(foundUser.profilePic);
        }

        return {
            success: true,
            message: `${foundUser.username} has been successfully deleted.`
        }
    },
    createPost: async (parent: any, { postTitle }: AdminArgs, { req }: CtxArgs) => {

        checkUserRole(req);

        const title = postTitle.trim();
        resolverErrorChecker({
            condition: validator.isEmpty(title) || !validator.isLength(title, { min: 10, max: 300 }),
            message: validator.isEmpty(title) ? 'Post title is required' : 'Post title length should be between 10-300 characters',
            code: 422
        });

        const post = new Post({ postTitle: title });
        await post.save();
        return { success: true, message: 'Post created successfully.' };
    },
    deletePost: async (parent: any, { postId }: InputArgs, { req }: CtxArgs) => {

        checkUserRole(req);

        try {
            await Post.deleteFeedPost(postId);
            return { success: true, message: 'Post deleted successfully.' };
        } catch (err: any) {
            console.log(err.message);
            return { success: false, message: 'Operation failed!' };
        }
    },
    deleteComment: async (parent: any, { postId, commentId }: InputArgs, { req }: CtxArgs) => {

        checkUserRole(req);
        const post = await Post.findById(postId).populate('comments.userInfo', 'profilePic username');
        if (!post) {
            const error: { [key: string]: any } = new Error('Post not found :(');
            error.statusCode = 404;
            throw error;
        }
        try {
            post.comments.pull(new mongoose.Types.ObjectId(commentId));
            await post.save();
            return { success: true, message: 'Comment has been deleted.' };
        } catch (err: any) {
            console.log(err.message);
            return { success: false, message: 'Operation failed!' };
        }
    },
    deleteOrder: async (parent: any, { orderId }: AdminArgs, { req }: CtxArgs) => {

        checkUserRole(req);
        return await Order.deleteOrder(orderId);
    },
    updateOrderStatus: async (parent: any, { orderId, orderProgress }: AdminArgs, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        checkUserRole(req);

        try {
            const order = await Order.findById(orderId);

            if (!order) {
                const error: { [key: string]: any } = new Error('Order was not found :(');
                error.statusCode = 404;
                throw error;
            }

            const orderStatus = orderEnums.find(progress => progress.toLowerCase() === (orderProgress = orderProgress.toLowerCase().trim()));
            resolverErrorChecker({ condition: !orderStatus, message: `ERROR: Invalid input! [${orderProgress}]`, code: 422 });

            await order.updateOrderDoc(orderProgress, orderStatus);

        } catch (err: any) {
            console.log(err.message);
            throw err;
        }
        return { success: true, message: 'Order status updated' };
    },
    createTrendingGame: async (parent: any, { trendingGameInput }: AdminArgs, { req }: CtxArgs) => {

        checkUserRole(req);

        const title = trendingGameInput.title.trim()[0].toUpperCase() + trendingGameInput.title.trim().substring(1);
        const imageUrl = trendingGameInput.imageUrl;
        const desc = trendingGameInput.desc;
        const rating = trendingGameInput.rating;
        const platform = trendingGameInput.platform?.trim().toUpperCase();
        const genre = trendingGameInput.genre

        const existing = await TrendingGames.exists({ title: title });
        resolverErrorChecker({ condition: existing !== null, message: 'Game already exists!', code: 409 });

        let platformData: string[] | undefined;
        if (platform) {
            const platformCategories = ['PS5', 'PS4', 'NINTENDO SWITCH', 'XBOX SERIES', 'XBOX ONE', 'MICROSOFT WINDOWS'];
            platformData = platform.split(', ').map(str => str.trim()).filter(str => platformCategories.includes(str));
            resolverErrorChecker({ condition: 1 > platformData.length, message: 'Invalid input: Please enter a valid platform', code: 422 });
        }

        await TrendingGames.create({
            title: title,
            imageUrl: imageUrl,
            desc: desc,
            rating: rating,
            platform: platformData ? platformData.join(" | ").toUpperCase() : undefined,
            genre: genre
        });

        return { success: true, message: 'content created successfully' };
    },
    deleteTrendingGame: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);
        try {
            const foundGame = await TrendingGames.findByIdAndDelete(id);
            if (foundGame?.$isDeleted()) {
                // delete pics
            }
            console.log(foundGame?.$isDeleted(true));
            return { success: true, message: 'Game has been deleted successfully.' };
        } catch (err: any) {
            throw err;
        }
    },
    deleteKyc: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {

        checkUserRole(req);
        const kyc = await Kyc.findById(id);
        const path = paths.documentDir + `/KYC/${kyc?.userId.toString()}`;
        if (fs.existsSync(path)) {
            fs.rm(path, { recursive: true }, async (err) => {
                if (err) {
                    console.log(err.message);
                    throw err;
                }
                await kyc?.deleteOne();
                await User.findByIdAndUpdate(kyc?.userId.toString(), { 'accInfo.kycStatus': 'not initialized' });
            });
            return { success: true, message: 'kyc deleted successfully.' };
        } else {
            throw new Error('Path does not exist :(');
        }
    },
    confirmKyc: async (parent: any, { id, userId, action }: AdminArgs, { req }: CtxArgs) => {

        checkUserRole(req);
        const user = await User.findById(userId);
        resolverErrorChecker({
            condition: !user || user!.accInfo.kycStatus !== 'pending',
            message: !user ? 'User not found :(' : 'KYC has already been reviewed.',
            code: !user ? 404 : 500
        });


        const kyc = await Kyc.findById(id);
        resolverErrorChecker({ condition: !kyc, message: 'KYC not found :(', code: 404 });
        if (action === 'Reject') {
            user!.accInfo.kycStatus = 'Unsuccessful';
            kyc!.status = 'Unsuccessful';
        } else if (action === 'Approve') {
            user!.accInfo.kycStatus = 'Approved';
            kyc!.status = 'Successful';
            // send mail
            const body = `<section>
            <h1>Dear ${user!.firstName},</h1>
            <h1>Congratulations your KYC has been application has been verified and approved. </h1>
            </section>`
            Mailing.sendEmail(user!.email, 'KYC Application Review', body).catch(err => console.log(err.toString()));
        }

        user!.save();
        kyc!.save();

        return { success: true, message: 'KYC application reviewed' };
    },
    createGameDownload: async (parent: any, { adminQueryInput }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);

        const title = adminQueryInput.title[0].toUpperCase() + adminQueryInput.title.substring(1);
        const platform = adminQueryInput.platform;
        const desc = adminQueryInput.desc;
        const gameList = adminQueryInput.gameList;
        const installType = adminQueryInput.installType;
        const installDuration = adminQueryInput.installDuration;
        const price = adminQueryInput.price;
        const homeService = adminQueryInput.homeService;

        resolverErrorChecker({
            condition: validatePriceFormat(price),
            message: 'Invalid price format.\nToo many numbers after decimal point, expected two numbers or less :(',
            code: 422
        });

        resolverErrorChecker({
            condition: !validator.isLength(title, { min: 8 }),
            message: 'Title length too short; Must be greater than 7 characters',
            code: 422
        });

        resolverErrorChecker({ condition: 1 > gameList.length, message: 'Game list cannot be empty.', code: 422 });

        resolverErrorChecker({
            condition: desc != null && !validator.isLength(desc, { min: 12, max: 800 }),
            message: (desc || '').length < 12 ? "Description is too short!" : "Description must be between 12-800 characters long.",
            code: 422
        });
        const foundGameDownload = await GameDownload.findOne({ title: title });
        resolverErrorChecker({ condition: foundGameDownload !== null, message: 'Game Download already exists!', code: 409 });

        await GameDownload.create({
            title: title,
            platform: platform,
            desc: desc,
            gameList: gameList,
            installType: installType,
            installDuration: installDuration,
            price: price,
            homeService: homeService
        });

        return { success: true, message: 'Game Download created successfully.' }
    },
    deleteGameDownload: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);
        try {
            const res = await GameDownload.findByIdAndDelete(id);

        } catch (err: any) {
            console.log(err.message);
            throw err;
        }

        return { success: true, message: 'Deleted successfully.' };
    },
    createOrEditCurrency: async (parent: any, { id, adminQueryInput }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);

        if (id) {
            await Currency.findByIdAndUpdate(id, { rate: adminQueryInput.rate });

            return { success: true, message: 'Currency rate updated successfully.' };
        }


        await Currency.create({
            country: adminQueryInput.country,
            currency: adminQueryInput.currency.toUpperCase(),
            rate: adminQueryInput.rate
        });

        return { success: true, message: 'Currency created successfully.' };
    },
    deleteCurrency: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);

        try {
            await Currency.findByIdAndDelete(id);
        } catch (err: any) {
            console.log(err.message);
            throw err;
        }

        return { success: true, message: 'Currency deleted successfully.' };
    },
    setDefaultCurrency: async (parent: any, { currencyOption }: AdminArgs, { req }: CtxArgs) => {

        checkUserRole(req);

        // update currency if exists else create
        const foundCurrency = await Currency.findOne({ currency: currencyOption });
        resolverErrorChecker({ condition: !foundCurrency, message: 'Currency does not exist in database!', code: 404 });

        const currencyData: IOptions['defaultCurrency'] = { currencyTitle: currencyOption, currency: foundCurrency!._id };

        const foundOptions = await Options.find();
        if (foundOptions.length > 0) {
            await foundOptions[0].updateOne({ defaultCurrency: currencyData });

            return { success: true, message: `Default currency is now set to ${currencyOption.toUpperCase()}.` };

        } else {
            await Options.create({
                defaultCurrency: currencyData
            });

            return { success: true, message: `Default currency option created successfully! Default currency is now set to ${currencyOption.toUpperCase()}.` };
        }
    },
    createGameRepair: async (parent: any, { adminQueryInput }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);

        const title = (adminQueryInput.title[0].toUpperCase() + adminQueryInput.title.substring(1)).trim();
        const imageUrl = adminQueryInput.imageUrl;
        const category = adminQueryInput.category;
        const game = adminQueryInput.game;
        const desc = adminQueryInput.desc;
        const price = adminQueryInput.price;
        const duration = adminQueryInput.duration;

        resolverErrorChecker({
            condition: !validator.isLength(title, { min: 6 }),
            message: 'Title length is too short!',
            code: 422
        });

        resolverErrorChecker({
            condition: validatePriceFormat(price),
            message: 'Invalid price format.\nToo many numbers after decimal point, expected two numbers or less :(',
            code: 422
        });

        await GameRepair.create({
            title: title,
            imageUrl: imageUrl,
            category: category,
            game: game.join(' | ').toUpperCase(),
            desc: desc,
            price: price,
            duration: duration
        });

        return { success: true, message: 'Game repair service created successfully.' };
    },
    deleteGameRepair: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);

        try {
            const gameRepair = await GameRepair.findByIdAndDelete(id);
            if (gameRepair?.imageUrl && isProductionEnv) {
                const fileKey = gameRepair.imageUrl.split('.com/')[1];
                await s3DeleteObject(fileKey);
            } else if (gameRepair && gameRepair.imageUrl) {
                await clearImage(gameRepair.imageUrl);
            }

        } catch (err: any) {
            console.log(err.message);
            throw err;
        }

        return { success: true, message: 'Game repair service deleted successfully.' };

    },
    updateRefundProgress: async (parent: any, { id, progress }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);

        const foundRefund = await Refund.findById(id);
        if (!foundRefund) throw new Error('ERROR: Refund not found!');

        foundRefund.progress = progress;

        try {
            if (progress === 'Succeeded') {
                await foundRefund.updateOne({ status: 'Completed' });
                const foundOrder = await Order.findById(foundRefund.orderInfo.toString());
                foundOrder!.toExpire = new Date();
                foundOrder?.save();
            }

            await foundRefund.save();
        } catch (err: any) {
            console.log(err.message);
            throw err;
        }

        return { success: true, message: 'Refund progress updated successfully!' };
    },
    createGameSwap: async (parent: any, { adminQueryInput }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);


        try {

            return await GameSwap.newGameSwap({ ...adminQueryInput } as IGameSwap);


        } catch (err: any) {
            err.data = err;
            throw err;
        }
    },
    deleteGameSwap: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);

        return await GameSwap.delGameSwap(id);

    },
    createGameRent: async (parent: any, { adminQueryInput }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);

        return await GameRent.newGameRent(adminQueryInput);
    },
    deleteGameRent: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {
        checkUserRole(req);

        return await GameRent.delGameRent(id);
    },
    createInAppNotice: async (parent: any, { adminQueryInput }: AdminArgs, { req }: CtxArgs) => {

        checkUserRole(req);

        await InAppNotice.createDoc({ title: adminQueryInput.title, content: adminQueryInput.content, imageUrl: adminQueryInput.imageUrl || null });

        return { success: true, message: 'In-App Notice created successully' };
    },
    deleteAppNotice: async (parent: any, { id }: AdminArgs, { req }: CtxArgs) => {

        checkUserRole(req);
        await InAppNotice.deleteDoc(id);

        return { success: true, message: 'In-App Notice deleted successully' };
    }
};

export default { Query, Mutation };