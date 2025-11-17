
import { HydratedDocument } from "mongoose";
import User, { UserData } from "../models/user.js";




export default async (req: any, res: any, next: any) => {
    try {
        if (!req.isAuth) {
            return next();
        }

        const user = req.user as HydratedDocument<UserData>;

        await User.updateUserStats(user);

        next();
    } catch (err: any) {
        console.log(err.message);
        next(err);
    }

}