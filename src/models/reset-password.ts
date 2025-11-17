import mongoose, { Schema, Model } from "mongoose";


const resetPasswordSchema = new Schema<IResetPassword, Model<IResetPassword>>({
    userId: {
        type: String,
        required: true
    },
    token: {
        type: String,
        required: true,
    },
    created: {
        type: Date,
        default: Date.now(),
        expires: '10m'
    }
});


export interface IResetPassword {
    userId: string,
    token: string,
    created?: Date
}


const ResetPassword = mongoose.model<IResetPassword, Model<IResetPassword>>('ResetPassword', resetPasswordSchema);
export default ResetPassword;