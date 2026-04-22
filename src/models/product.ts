import mongoose, { HydratedDocument, Model, Document, Schema } from "mongoose";

import { ICurrency } from "./currency.js";
import { GraphQLCustomError, calPrice, errorChecker } from "../util/helper.js";


export const VALID_TAGS = ['rent', 'swap', 'sale', 'popular', 'special'];

interface ProductModel extends Model<ProductData> {
    getProducts(currency: ICurrency, byTag?: String): Promise<ProductData[]>;
    getProduct(prodId: string, currency: ICurrency): Promise<ProductData>;
}


const productSchema = new Schema<ProductData, ProductModel>({
    title: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    subcategory: {
        type: String,
        required: true
    },
    imageUrls: Array<String>,
    desc: {
        type: String,
    },
    condition: {
        type: String,
        default: 'Brand New',
        required: true,
        enum: ['Brand New', 'New (Open Box)', 'Foreign Used', 'Pre-owned']
    },
    price: {
        type: Number,
        required: true
    },
    stockQty: {
        type: Number,
        default: 100,
        required: true,
    },
    tags: [{ type: String, enum: { values: VALID_TAGS }, }],
});


export interface ProductData {
    id?: string;
    title: string;
    category: string;
    subcategory: string;
    imageUrls: string[];
    desc?: string | null;
    price: string | number; // string for returning response, number for saving to db
    condition: string;
    stockQty: number;
    tags: string[];
    _doc?: Omit<this, '_doc'>;
}

productSchema.statics.getProducts = async function (currency: ICurrency, byTag?: string): Promise<ProductData[]> {
    const tag = byTag?.toLowerCase();

    errorChecker({ condition: tag != null && !VALID_TAGS.includes(tag!), message: 'Invalid tag!', code: 422 });

    var products: HydratedDocument<ProductData>[];
    if (byTag) {
        products = await this.find({ tags: { $in: tag } }).select('title category subcategory imageUrls desc condition price stockQty tags');
    } else {
        products = await this.find().select('title category subcategory imageUrls desc condition price stockQty tags');
    }

    switch (currency.currency) {
        case 'USD':
            return products.map((obj: any) => {
                return { id: obj.id, ...obj._doc }
            });

        default:
            const res: ProductData[] = products.map((prod: any) => {
                const price = calPrice(+prod.price, currency);
                return { id: prod.id, ...prod._doc, price: price.toString() };
            });
            return res;
    }
};

productSchema.statics.getProduct = async function (prodId: string, currency: ICurrency): Promise<ProductData> {
    const prod: HydratedDocument<ProductData> | null = await this.findById(prodId);
    if (!prod) {
        throw new GraphQLCustomError('Product not found', 404);
    }
    const price = calPrice(+prod._doc!.price, currency);

    return {
        id: prod.id,
        title: prod.title,
        category: prod.category,
        subcategory: prod.subcategory,
        imageUrls: prod.imageUrls,
        desc: prod.desc,
        condition: prod.condition,
        price: price,
        stockQty: prod.stockQty,
        tags: prod.tags
    };
};

productSchema.post('deleteOne', { document: true, query: false }, function (doc, next) {
    const prodId = doc._id;
    if (!prodId) {
        return next();
    }
    const field: { [key: string]: any } = {};
    field[`subcategoryData.${doc.subcategory}`] = doc._id;
    const operations = [
        { name: 'updateMany' as const, namespace: 'gamerDB.users', filter: {}, update: { $pull: { wishlist: prodId } } },
        { name: 'updateOne' as const, namespace: 'gamerDB.categories', filter: { title: doc.category }, update: { $pull: { ...field } } }];


    // remove product from user wishlist and subcategory 
    mongoose.connection.getClient().bulkWrite(operations).then(() => next()).catch((err: any) => {
        console.log('Product post() hook error on `deleteOne`: ', err.message);
        next(new Error('An error occurred processing deletion of related objects'));
    });
});

const Product = mongoose.model<ProductData, ProductModel>('Product', productSchema);

export default Product;
