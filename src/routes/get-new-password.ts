import { Router } from "express";
import ResetPassword from "../models/reset-password";


const router = Router();


router.get('/get-new-password/:token', (req, res, next) => {
    const token = req.params.token;
    ResetPassword.findOne({ token: token }).then((doc) => {
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Reset password link expired :(' });
        }
        const data = { userId: doc.userId, token: token } as const;
        return res.status(200).json({ success: true, data: data, deepLink: null });
    }).catch((err) => {
        console.log(err.message);
        return res.status(500).json({ success: false, message: 'An error occurred :(' });
    });
});

export default router;