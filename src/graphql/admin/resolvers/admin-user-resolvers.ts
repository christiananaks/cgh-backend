import path from 'path';
import fs from 'fs';

import validator from 'validator';
import mongoose, { HydratedDocument } from 'mongoose';

import { CtxArgs, ParentObjectData } from "../../../models/type-def";
import User, { UserData } from "../../../models/user";
import { resolverErrorChecker, orderEnums, validatePriceFormat } from "../../../util/helper";
import { paths } from '../../../util/path-linker';
import AdminKey from "../../../models/admin-keys";
import { NewSlide, getSlidesFromFile } from "../../../models/slide";
import { clearImage } from "../../../util/file-storage";
import Product, { ProductData } from '../../../models/product';
import Categories from '../../../models/category';
import { AdminParentObj } from './super-user-resolver';
import Post from '../../../models/post';
import Order, { orderProgressOptions } from '../../../models/order';
import TrendingGames from '../../../models/trending-games';
import Kyc from '../../../models/kyc';
import GameDownload from '../../../models/game-download';
import Currency, { ICurrency } from '../../../models/currency';
import Options, { IOptions } from '../../../models/options';
import GameRepair from '../../../models/game-repair';
import Refund from '../../../models/refund';
import GameSwap, { IGameSwap } from '../../../models/game-swap';
import GameRent from '../../../models/game-rent';
import Mailing from '../../../models/mailing';




export default {
    createProduct: async ({ adminQueryInput, prodId }: AdminParentObj, { req }: CtxArgs) => {
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

        // TODO: uncomment after testing!
        // if (desc) { 
        //     resolverErrorChecker({
        //         condition: validator.isEmpty(desc) || !validator.isLength(desc, { max: 300 }),
        //         message: validator.isEmpty(desc) ? 'Product description is required.' : 'Description length must be below 300 characters',
        //         code: 422
        //     });
        // }

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
    deleteProduct: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
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
            // clearImage(foundProduct.imageUrls[0]);
            const prodImageDir = foundProduct.imageUrls[0].substring(0, foundProduct.imageUrls[0].lastIndexOf('/'));
            fs.rm(`${prodImageDir}`, { recursive: true, force: true }, (err) => {
                if (err) {
                    console.log(err.message);
                }
            })
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
    createOrEditCategory: async ({ id, categoryTitle, subcategoryTitles }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;

        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            code: !isAuth ? 401 : 403,
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :('
        });

        resolverErrorChecker({ condition: 1 > subcategoryTitles.length, message: 'Subcategory Titles cannot be empty!', code: 422 });

        const foundCategory = await Categories.findOne({ title: categoryTitle });

        resolverErrorChecker({
            condition: foundCategory !== null,
            message: 'Category already exists!',
            code: 409
        });

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

        category!.save();

        return { success: true, message: `Updated subcategories of ${category?.title}` };
    },
    addProductToCategory: async ({ id, categoryTitle, subcategoryTitle }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;

        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

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
    deleteCategory: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;

        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            code: !isAuth ? 401 : 403,
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :('
        });

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

    createSlide: async ({ adminQueryInput }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, userId, role, user } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            code: !isAuth ? 401 : 403,
            message: !isAuth ? 'Please login to continue.' : 'Error: Unauthorize request.'
        });


        // temporary check, for keep path compliant to the general imageUrl path structure
        let adjustedImagePath = '';
        if (!adminQueryInput.imageUrl!.startsWith('images/slides')) {
            adjustedImagePath = 'images/slides/' + adminQueryInput.imageUrl;
        } else {
            adjustedImagePath = adminQueryInput.imageUrl!;
        }


        const title = adminQueryInput.title.trim();
        const image = adjustedImagePath;
        const description = adminQueryInput.desc ? adminQueryInput.desc.trim() : null;
        const creator = user.username; // set the name of logged in req.user

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


        const slides = await NewSlide.fetchSlides();
        if (slides.length > 0) {
            // for (const slide of slides) {
            //     if (slide.title === title || slide.desc === description) {
            //         const error: {[key:string]: any} = new Error('Slide already exists!');
            //         error.statusCode = 409;
            //         throw error;
            //     }
            // }
            slides.forEach((slide) => {
                if (slide.title === title || slide.desc === description) {
                    const error: { [key: string]: any } = new Error('Slide already exists!');
                    error.statusCode = 409;
                    throw error;
                }
            })
        }


        const slide = new NewSlide(title, description, image, creator);

        await slide.save();

        return { ...slide };
    },

    slides: async (parent: any, { req }: CtxArgs) => {
        resolverErrorChecker({
            condition: !req.isAuth || !['admin', 'superuser'].includes(req.role),
            code: !req.isAuth ? 401 : 403,
            message: !req.isAuth ? 'Please login to continue.' : 'Error: Unauthorize request.'
        });

        const slides = await NewSlide.fetchSlides(); // convert to promise

        return slides;
    },

    deleteSlide: async ({ id }: AdminParentObj, { req }: CtxArgs) => {

        const file = path.join(__dirname, '../../../data', 'slides.json');

        let savedSlides = await getSlidesFromFile();
        // find the imageUrl
        const imageFile = savedSlides.find((s) => s.id == id)?.imageUrl;

        if (imageFile) {
            clearImage(imageFile);
        } else {
            console.log('image path arg is invalid!');
            return false; // only delete successfully if imageUrl exists in the file
        }

        // delete entry from fileDB
        savedSlides = savedSlides.filter((s) => s.id !== id);

        // write the modified file data
        fs.writeFile(file, JSON.stringify(savedSlides), err => console.log('write after deleting: ', err));

        return true;

    },
    getAdminUsers: async ({ }: AdminParentObj, { req }: CtxArgs) => {
        resolverErrorChecker({ condition: !req.isAuth, code: 401, message: 'Please sign-in to complete request' });
        resolverErrorChecker({ condition: !['admin', 'superuser'].includes(req.role), code: 403, message: 'Unauthorized request.' });
        const foundAdmins: UserData[] = await User.find({ 'accInfo.role': "admin" }).select('email username');


        return foundAdmins;
    },
    getAdminUserInfo: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
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
    deleteUser: async ({ searchBy, value }: any, { req }: CtxArgs) => {
        const field: string = searchBy;
        const data: string = value;


        resolverErrorChecker({
            condition: !req.isAuth || !['admin', 'superuser'].includes(req.role),
            code: !req.isAuth ? 401 : 403, message: !req.isAuth ? 'Please sign-in to complete request' : 'Unauthorized request.',
        });

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

        if (foundUser.profilePic) {
            clearImage(foundUser.profilePic);
        }

        return {
            success: true,
            message: `${foundUser.username} has been successfully deleted.`
        }
    },
    findUser: async ({ searchBy, value }: any, { req }: CtxArgs) => {
        const searchOption: string = searchBy.trim();
        const searchVal: string = value.trim();
        resolverErrorChecker({
            condition: !req.isAuth || !req.role.includes('admin'),
            code: !req.isAuth ? 401 : 403,
            message: !req.isAuth ? 'Please login to continue' : 'Forbidden requeest :('
        });

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
    createPost: async ({ postTitle }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            code: !isAuth ? 401 : 403,
            message: !isAuth ? 'Please login to continue.' : 'Unauthorized request :('
        });

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
    fetchPosts: async ({ }, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            code: !isAuth ? 401 : 403,
            message: !isAuth ? 'Please login to continue.' : 'Unauthorized request :('
        });

        let posts = await Post.find().select('postTitle');

        if (!posts) {
            return [];
        }

        const postDocs = posts.map((post) => {
            return { postId: post.id, ...post._doc }
        });

        return postDocs;
    },
    deletePost: async ({ postId }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            code: !isAuth ? 401 : 403,
            message: !isAuth ? 'Please login to continue.' : 'Unauthorized request :('
        });
        // do solid input validation for postId length 
        try {
            await Post.deleteFeedPost(postId);
            return { success: true, message: 'Post deleted successfully.' };
        } catch (err: any) {
            console.log(err.message);
            return { success: false, message: 'Operation failed!' };
        }
    },
    deleteComment: async ({ postId, commentId }: ParentObjectData, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            code: !isAuth ? 401 : 403,
            message: !isAuth ? 'Please login to continue.' : 'Unauthorized request :('
        });
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
    getOrders: async ({ }, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({ condition: !isAuth || !['admin', 'superuser'].includes(role), message: !isAuth ? 'Please login to continue.' : 'Forbidden request', code: !isAuth ? 401 : 403 });
        const orders = await Order.getOrders();
        return orders;
    },
    getOrder: async ({ orderId }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        const currency = req.currency as ICurrency;

        resolverErrorChecker({ condition: !isAuth || !['admin', 'superuser'].includes(role), message: !isAuth ? 'Please login to continue.' : 'Forbidden request', code: !isAuth ? 401 : 403 });
        const order = await Order.getOrder(orderId, currency);
        return order;
    },
    getOrderProgressOptions: async ({ }, { req }: CtxArgs) => {
        const { isAuth, role } = req;

        resolverErrorChecker({ condition: !isAuth || !['admin', 'superuser'].includes(role), message: !isAuth ? 'Please login to continue.' : 'Forbidden request', code: !isAuth ? 401 : 403 });
        return { ...orderProgressOptions };
    },
    deleteOrder: async ({ orderId }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({ condition: !isAuth || !['admin', 'superuser'].includes(role), message: !isAuth ? 'Please login to continue.' : 'Forbidden request', code: !isAuth ? 401 : 403 });
        return await Order.deleteOrder(orderId);
    },
    updateOrderStatus: async ({ orderId, orderProgress }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({ condition: !isAuth || !['admin', 'superuser'].includes(role), message: !isAuth ? 'Please login to continue.' : 'Forbidden request', code: !isAuth ? 401 : 403 });

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
    createTrendingGame: async ({ trendingGameInput }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });


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
    trendingGamesList: async ({ }, { req }: CtxArgs) => {
        const { isAuth, role } = req;

        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

        const trendingGames = await TrendingGames.find().select('title rating');
        if (1 > trendingGames.length) {
            return [];
        }

        const games = trendingGames.map(game => {
            return { id: game.id, ...game._doc };
        });
        return games;
    },
    deleteTrendingGame: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;

        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });
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
    getUsersKyc: async ({ }, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });
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
    deleteKyc: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

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
    viewUserKyc: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

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
    confirmKyc: async ({ id, userId, action }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

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
    createGameDownload: async ({ adminQueryInput }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

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
    deleteGameDownload: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });
        try {
            const res = await GameDownload.findByIdAndDelete(id);

        } catch (err: any) {
            console.log(err.message);
            throw err;
        }

        return { success: true, message: 'Deleted successfully.' };
    },
    createOrEditCurrency: async ({ id, adminQueryInput }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

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
    getCurrencyList: async ({ }, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

        return await Currency.find();
    },
    deleteCurrency: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

        try {
            await Currency.findByIdAndDelete(id);
        } catch (err: any) {
            console.log(err.message);
            throw err;
        }

        return { success: true, message: 'Currency deleted successfully.' };
    },
    setDefaultCurrency: async ({ currencyOption }: AdminParentObj, { req }: CtxArgs) => {

        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

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
    createGameRepair: async ({ adminQueryInput }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

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
    deleteGameRepair: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

        try {
            const gameRepair = await GameRepair.findByIdAndDelete(id);
            if (gameRepair && gameRepair.imageUrl) {
                clearImage(gameRepair.imageUrl);
            }

        } catch (err: any) {
            console.log(err.message);
            throw err;
        }

        return { success: true, message: 'Game repair service deleted successfully.' };

    },
    getRefunds: async ({ }, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

        return await Refund.refunds();
    },
    getRefundInfo: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

        try {
            return await Refund.usersRefundInfo(id);
        } catch (err: any) {
            err.statusCode = 404;
            throw err;
        }
    },
    updateRefundProgress: async ({ id, progress }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;
        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
            code: !isAuth ? 401 : 403
        });

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
    createGameSwap: async ({ adminQueryInput }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;

        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Error: Unauthorized request!',
            code: !isAuth ? 401 : 403
        });


        try {

            return await GameSwap.newGameSwap({ ...adminQueryInput } as IGameSwap);


        } catch (err: any) {
            err.data = err;
            throw err;
        }
    },
    deleteGameSwap: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;

        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Error: Unauthorized request!',
            code: !isAuth ? 401 : 403
        });

        return await GameSwap.delGameSwap(id);

    },
    createGameRent: async ({ adminQueryInput }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;

        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Error: Unauthorized request!',
            code: !isAuth ? 401 : 403
        });

        return await GameRent.newGameRent(adminQueryInput);
    },
    deleteGameRent: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
        const { isAuth, role } = req;

        resolverErrorChecker({
            condition: !isAuth || !['admin', 'superuser'].includes(role),
            message: !isAuth ? 'Please login to continue.' : 'Error: Unauthorized request!',
            code: !isAuth ? 401 : 403
        });

        return await GameRent.delGameRent(id);
    }
}