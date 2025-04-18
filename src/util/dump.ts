import { resolverErrorChecker } from "./helper";

export const testDelay: (delayMs: number) => Promise<void> = (delayMs: number) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(console.log('ended test delay'));
        }, delayMs);
    });
}

// const removedAdminResolvers = {
//     getRepairOrders: async ({ }: ParentObjectData, { req }: CtxArgs) => {
//         const { isAuth, accType } = req;
//         resolverErrorChecker({
//             condition: !isAuth || accType === 'standard',
//             message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
//             code: !isAuth ? 401 : 403
//         });
    
    
//         const repairOrders = await RepairOrder.find().populate('userInfo', 'email');
//         if (1 > repairOrders.length) {
//             return [];
//         }
    
//         const allRepairOrders = repairOrders.map(doc => {
//             const populatedUserInfo: unknown = doc.userInfo;
//             const userData = populatedUserInfo as UserData;
    
//             return {
//                 orderId: doc.id,
//                 email: userData.email,
//                 paymentStatus: doc.paymentStatus,
//                 repairStatus: doc.repairStatus,
//                 date: doc.createdAt,
//             }
//         });
    
//         return allRepairOrders;
    
//     },
//     getRepairOrderDetails: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
//         const { isAuth, accType } = req;
//         resolverErrorChecker({
//             condition: !isAuth || accType === 'standard',
//             message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
//             code: !isAuth ? 401 : 403
//         });
    
//         const repairOrderDetails = await RepairOrder.findById(id).populate('orderInfo');
//         if (!repairOrderDetails) {
//             throw new Error('Error: Repair Order not found :(');
//         }
    
    
    
//         // for orderInfo, we get the stringified version of id (Uint8Array) with the help of graphQl
//         return {
//             orderNo: repairOrderDetails.id + '-' + repairOrderDetails.paymentInfo?.transRef,
//             orderInfo: { ...repairOrderDetails.orderInfo, id: repairOrderDetails.orderInfo.id.toString() },
//             payOnDelivery: repairOrderDetails.payOnDelivery,
//             address: repairOrderDetails.address,
//             phone: repairOrderDetails.phone,
//             inspectionFee: repairOrderDetails.inspectionFee,
//             reason: repairOrderDetails.reason,
//             paymentInfo: repairOrderDetails.paymentInfo,
//             paymentStatus: repairOrderDetails.paymentStatus,
//             repairStatus: repairOrderDetails.repairStatus,
//             createdAt: repairOrderDetails.createdAt,
//             updatedAt: repairOrderDetails.updatedAt
//         };
//     },
//     deleteRepairOrder: async ({ id }: AdminParentObj, { req }: CtxArgs) => {
//         const { isAuth, accType } = req;
//         resolverErrorChecker({
//             condition: !isAuth || accType === 'standard',
//             message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
//             code: !isAuth ? 401 : 403
//         });
    
//         try {
//             await RepairOrder.findByIdAndDelete(id);
//             return { success: true, message: 'Repair Order deleted successfully' };
//         } catch (err: any) {
//             console.log(err.message);
//             throw err;
//         }
//     },
//     updateRepairOrderStatus: async ({ id, orderProgress }: AdminParentObj, { req }: CtxArgs) => {
//         const { isAuth, accType } = req;
//         resolverErrorChecker({
//             condition: !isAuth || accType === 'standard',
//             message: !isAuth ? 'Please login to continue.' : 'Forbidden request :(',
//             code: !isAuth ? 401 : 403
//         });
    
//         const status = repairStatusEnum.find((status) => status.toLowerCase() === orderProgress.toLowerCase());
//         resolverErrorChecker({ condition: !status, message: 'ERROR: Invalid input! [orderProgress] ', code: 422 });
    
//         const repairOrderId = id;
//         try {
//             await RepairOrder.findByIdAndUpdate(repairOrderId, { repairStatus: status });
//             return { success: true, message: 'Repair Order updated successfully' };
//         } catch (err: any) {
//             console.log(err.message);
//             throw err;
//         }
//     },
// }

// const removedUserResolvers = {
//     getUserRepairOrders: async ({ }: ParentObjectData, { req }: CtxArgs) => {
//         const { userId, isAuth, user } = req;

//         resolverErrorChecker({ condition: !isAuth, message: 'Please login to continue.', code: 401 });

//         return RepairOrder.userRepairOrders(user._id as Types.ObjectId);

//     },

//     confirmGameRepair: async ({ id }: ParentObjectData, { req }: CtxArgs) => {
//         const { userId, isAuth, user, currency } = req;

//         resolverErrorChecker({ condition: !isAuth, message: 'Please login to continue.', code: 401 });

//         const gameRepair = await GameRepair.findById(id);

//         resolverErrorChecker({ condition: !gameRepair, message: 'Game Repair not found :(', code: 404 });

//         const foundKyc = await Kyc.findOne({ userId: new Types.ObjectId(userId) });

//         return {
//             fullname: `${user.firstName} ${user.lastName} (${user.username})`,
//             email: user.email,
//             phone: foundKyc?.phone ?? user.accInfo.phone,
//             deliveryAddress: foundKyc?.residenceAddress,
//             gameRepair: { ...gameRepair!._doc, price: calPrice(gameRepair!.price, currency), id: gameRepair!.id }
//         };
//     },
//     confirmGameDownload: async ({ id }: ParentObjectData, { req }: CtxArgs) => {

//         const { userId, isAuth, user, currency } = req;
//         resolverErrorChecker({ condition: !isAuth, message: 'Please login to continue.', code: 401 });

//         let gameDownload = await GameDownload.findById(id);
//         resolverErrorChecker({ condition: !gameDownload, message: 'Game Download not found :(', code: 404 });
//         gameDownload = gameDownload!;

//         const foundKyc = await Kyc.findOne({ userId: new Types.ObjectId(userId) });

//         return {
//             fullname: `${user.firstName} ${user.lastName} (${user.username})`,
//             email: user.email,
//             phone: foundKyc?.phone ?? user.accInfo.phone,
//             deliveryAddress: foundKyc?.residenceAddress,
//             title: gameDownload.title,
//             desc: gameDownload.desc,
//             imageUrl: gameDownload.imageUrl,
//             platform: gameDownload.platform,
//             gameList: gameDownload.gameList,
//             installType: gameDownload.installType,
//             price: calPrice(gameDownload.price, currency),
//             installDuration: gameDownload.installDuration
//         }
//     }
// }
