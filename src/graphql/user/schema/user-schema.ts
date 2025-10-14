export default `
    type Comment {
        commentId: ID!
        profilePic: String
        username: String!
        comment: String!
    }

    type Post {
        postId: ID!
        postTitle: String!
        comments: [Comment!]!
    }

    type ProdDetails {
        prodId: ID!
        title: String!
        category: String!
        subcategory: String!
        imageUrl: String
        condition: String!
        price: Int!
        qty: Int!
    }

    type ConfirmOrder {
        products: [ProdDetails!]!
        subTotal: Int!
        fullname: String!
        email: String!
        phone: String
        deliveryAddress: String
    }

    type InitPay {
        accessCode: String!
        reference: String!
        phone: String!
        deliveryAddress: String!
    }

    type GamingId {
        gamingIdHandle: String!
        platform: String!
    }

    type AccInfoSettings {
        profilePic: String
        firstname: String!
        lastname: String!
        username: String!
        email: String!
        phone: String
        gamingId: GamingId
        myGames: [MyGames!]!
        kycStatus: String!
    }

    type CartData {
        cartObjId: ID!
        prodId: ID!
        prodTitle: String!
        imageUrl: String
        qty: Int!
        price: Int!
    }

    type WishlistActionResult {
        addedToWishlist: Boolean!
        actionStatus: String!
    }

    type UserOrder {
        orderNo: String!
        date: String!
        status: String!
    }

    type UserOrderProdDets {
        prodId: ID!
        title: String!
        category: String!
        imageUrl: String
        condition: String!
        price: String!
        qty: Int!
    }

    type UserOrderDetails {
        orderNo: String!
        totalAmount: String!
        orderStatus: String!
        products: [UserOrderProdDets!]!
    }

    type GetRefundOrder {
        orderId: String!
        amount: String!
        orderInfo: String!
    }

    type UserOrderRefundInfo {
        amount: String!
        orderInfo: String!
        prodId: String
        reason: String!
        otherReason: String
        imageUrls: [String!]
        progress: String!
        status: String!
        createdAt: String!
        updatedAt: String!
    }

    input ValidId {
        kind: String!
        docUrl: String!
    }

    input UtilityBill {
        kind: String!
        docUrl: String!
    }

    input AccData {
        phone: String
        profilePic: String
        gamingIdHandle: String
        myGames: [MyGamesInput!]
    }

    input PasswordData {
        oldPassword: String!
        newPassword: String!
        confirmPassword: String!
    }

    input KycInput {
        phone: String!
        dateOfBirth: String!
        residenceAddress: String!
        validId: ValidId!
        utilityBill: UtilityBill!
    }

    input RefundRequestInput {
        reason: String!
        otherReason: String
    }

    type RootQuery {
        showCart: [CartData!]!
        getWishlist: [Product!]!
        getCheckout: ConfirmOrder!
        postCheckout(email: String!, amount: Int!, deliveryAddress: String, phone: String): InitPay!
        getAccInfoSettings: AccInfoSettings!
        getUserOrders: [UserOrder!]!
        getUserOrder(orderId: String!): UserOrderDetails!
        getRecommendedProducts: [Product]!
        getOrderRefund(orderId: String!): GetRefundOrder!
        getUserOrderRefundInfo(orderId: String!): UserOrderRefundInfo!
        getAuthUser(id: ID!): AuthData!
    }

    type RootMutation {
        addToCart(prodId: String!): Boolean
        removeFromCart(cartObjId: String!): Boolean
        editWishlist(prodId: String!): WishlistActionResult
        logout: Boolean
        postAddComment(postId: ID!, userComment: String!): ActionStatus!
        postEditComment(postId: ID!, commentId: ID!, userComment: String!): Comment!
        postEditAccInfoSettings(accData: AccData!): ActionStatus!
        userPasswordUpdate(userQueryInput: PasswordData!): ActionStatus!
        deleteMyAcc: ActionStatus!
        createKyc(userQueryInput: KycInput!): ActionStatus!
        postOrderRefund(orderId: String!, prodId: String, imageUrls: [String!], amount: String!, userQueryInput: RefundRequestInput!): ActionStatus!
    }
`;