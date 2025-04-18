import mongoose, { Schema, Types, Model, Document, model } from "mongoose";


const serverMntSchema = new Schema<IServMnt, Model<IServMnt>>({
    startedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: Boolean,
        required: true
    },
    access: {
        type: String,
        required: true
    },
    level: {
        type: Number,
        required: true,
        default: 1
    },
    expireAt: {
        type: Date,
        required: true
    }
});

interface IServMObjProps {
    _doc: Omit<this, '_doc'>;
}

export interface IServMnt extends IServMObjProps, Document {
    startedBy: Types.ObjectId;
    status: boolean;
    access: string;
    level?: number;
    expireAt: Date;
}

serverMntSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
const ServerMnt = model<IServMnt, Model<IServMnt>>('ServerMnt', serverMntSchema); // would use default mongoose.connect to create and store model docs

export default ServerMnt;