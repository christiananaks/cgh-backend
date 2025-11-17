import mongoose, { Schema, Model, ObjectId } from "mongoose";

const kycSchema = new Schema<IKYC, KYCModel>({
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    fullname: {
        type: String,
        required: true
    },
    dateOfBirth: {
        type: String,
        required: true
    }
    ,
    phone: {
        type: String,
        required: true,
    },
    residenceAddress: {
        type: String,
        required: true
    },
    validId: {
        type: {
            kind: {
                type: String,
                required: true,
                enum: ['National Identity', 'International Passport']
            },
            docUrl: {
                type: String,
                required: true,
            }
        },
        required: true,
    },
    utilityBill: {
        type: {
            kind: {
                type: String,
                required: true,
                enum: ['Electricity Bill', 'PSP']
            },
            docUrl: {
                type: String,
                required: true
            }
        },
        required: true,
    },
    status: {
        type: String,
        required: true,
        default: 'Pending',
        enum: ['Pending', 'Unsuccessful', 'Successful']
    }
});


type KYCModel = Model<IKYC>;

export type TypeValidId = {
    kind: string;
    docUrl: string;
};

export type TypeUtilityBill = {
    kind: string;
    docUrl: string;
};


export interface IKYC {
    id: string;
    userId: ObjectId;
    fullname: string;
    dateOfBirth: string;
    phone: string;
    residenceAddress: string;
    validId: TypeValidId;
    utilityBill: TypeUtilityBill;
    status: string;
    _doc?: Omit<this, '_doc'>;
}

const Kyc = mongoose.model<IKYC, KYCModel>('Kyc', kycSchema);
export default Kyc;