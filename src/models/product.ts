import mongoose, { HydratedDocument, Model, Document, Schema } from "mongoose";
import { ICurrency } from "./currency";
import { calPrice } from "../util/helper";


interface ProductModel extends Model<ProductData> {
    getProducts(): Promise<ProductData[]>;
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
        default: 1000,
        required: true,
    },
    rent: Boolean,
    swap: Boolean
});


export interface ProductData {
    id?: string;
    title: string;
    category: string;
    subcategory: string;
    imageUrls: string[];
    desc?: string | null;
    price: string | number; // string for returning response, number for creating and saving to db
    condition: string | null;
    stockQty: number;
    rent?: boolean;
    swap?: boolean;
    _doc?: Omit<this, '_doc'>;
}

productSchema.statics.getProducts = async function (): Promise<ProductData[]> {
    let getProdList: Document[] = await this.find().select('title category subcategory imageUrls desc condition price stockQty');

    const prodList: ProductData[] = getProdList.map((obj: any) => {
        return { id: obj.id, ...obj._doc }
    });

    return prodList as ProductData[];
};

productSchema.statics.getProduct = async function (prodId: string, currency: ICurrency): Promise<ProductData> {
    const prod: HydratedDocument<ProductData> | null = await this.findById(prodId);
    if (!prod) {
        const error: { [key: string]: any } = new Error('Product not found');
        error.statusCode = 404;
        throw error;
    }
    const price = calPrice(+prod._doc!.price, currency);
    return {
        id: prod.id,
        title: prod._doc!.title,
        category: prod._doc!.category,
        subcategory: prod._doc!.subcategory,
        imageUrls: prod._doc!.imageUrls,
        desc: prod._doc!.desc,
        condition: prod.condition,
        price: price,
        stockQty: prod._doc!.stockQty
    };
};


const Product = mongoose.model<ProductData, ProductModel>('Product', productSchema);
export default Product;
