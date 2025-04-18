import { calPrice } from '../util/helper';
import { ICurrency } from './currency';
import { ProductData } from './product';

import mongoose, { Schema, Types, Model, HydratedDocument } from 'mongoose';

interface CategoryModel extends Model<CategoryData, {}, {}>, CategoryData {
    getCategoryProds(catTitle: string, currency: ICurrency): Promise<ProductData[]>;
    getDbCategories(): Promise<{ id: string, title: string, subcategories: string[] }[]>;
}

export interface CategoryData {
    title: string;
    subcategoryData: Types.Map<Types.ObjectId[]>;
    // items: Types.Array<ProductData>;
    addToCategory: (product: HydratedDocument<ProductData>) => Promise<void>;
    _doc: Omit<this, '_doc'>;
}

const categoriesSchema = new Schema<CategoryData, CategoryModel>({
    title: {
        type: String,
        required: true,
        // unique: true
    },
    subcategoryData: {
        type: Map,
        of: Array<Types.ObjectId>,
        required: true,
        ref: "Product"
    },
},);

// callable on instantiated object of this schema
categoriesSchema.methods.addToCategory = async function (product: HydratedDocument<ProductData>): Promise<void> {
    this.subcategoryData.set(product.subcategory, [...this.subcategoryData.get(product.subcategory), product._id]); // adds the new product id to the existing subcategory empty array
    await this.save();
}

categoriesSchema.statics.getCategoryProds = async function (categoryTitle: string, currency: ICurrency): Promise<ProductData[]> {
    const category = await this.findOne({ title: categoryTitle }).populate('subcategoryData', '_id title category subcategory imageUrls desc condition price stockQty');

    if (!category) {
        const error: { [key: string]: any } = new Error('Category not found.');
        error.statusCode = 404;
        throw error;
    }

    let categoryProducts: unknown[] = Array.from(category.subcategoryData.values()).flatMap((arr) => {
        if (arr.length > 0) {
            arr.forEach((obj: any) => {
                const objIndex = arr.indexOf(obj);

                const price = calPrice(+obj.price, currency);
                arr[objIndex] = { ...obj._doc, id: obj._id.toString(), price: price };
            });
            return arr;
        }
        return [];
    });

    return categoryProducts as ProductData[];
};

categoriesSchema.statics.getDbCategories = async function (): Promise<{ id: string, title: string, subcategories: string[] }[]> {
    const categories = await this.find().select('title subcategoryData');
    const categoriesList = categories.map(doc => {
        const subcategories = Array.from(doc.subcategoryData.keys());
        return { id: doc.id, title: doc.title, subcategories: subcategories };
    });

    return categoriesList;
}

const Categories = mongoose.model<CategoryData, CategoryModel>('Categories', categoriesSchema);
export default Categories;
