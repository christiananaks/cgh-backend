export default `#graphql
    type Slide {
        id: ID!
        title: String!
        desc: String
        imageUrl: String!
        creator: String!
    }

    type AccessData {
        user: String
        access: String!
    }

    type AccessKeysInfo {
        allAccessKeys: [AccessData!]!
        freeAccessKeys: [AccessData]!
    }

    type Product {
        id: ID!
        title: String!
        category: String!
        subcategory: String!
        imageUrls: [String!]!
        desc: String
        condition: String!
        price: String!
        stockQty: Int!
        swap: Boolean
        rent: Boolean
    }

    input SlideData {
        title: String!
        desc: String
        imageUrl: String!
    }

    input ProdData {
        title: String!
        category: String!
        subcategory: String!
        imageUrls: [String!]
        condition: String!
        desc: String
        price: Float!
        stockQty: Int
    }

    type ProdStatus {
        product: Product!
        isUpdated: Boolean!
        isCreated: Boolean!
    }

    type UserCard {
        id: ID!
        email: String!
        username: String!
    }

    type UserInfo {
        id: ID!
        accessKey: String
        firstName: String!
        lastName: String!
        username: String!
        email: String!
        role: String!
    }

    type ActionStatus {
        success: Boolean!
        message: String!
    }

    type PostData {
        postId: ID!
        postTitle: String!
    }

    type PaymentInfo {
        gateway: String
        transRef: String
        method: String!
        currency: String!
        rate: String!
        amount: String!
    }

    type OrderedProd {
        product: ID!
        title: String!
        category: String!
        imageUrl: String
        condition: String!
        price: String!
        qty: Int!
    }

    type OrderUserInfo {
        name: String!
        email: String!
    }

    type OrderDetails {
        orderId: ID!
        orderNo: String!
        user: OrderUserInfo!
        products: [OrderedProd!]!
        deliveryAddress: String!
        phone: String!
        date: String!
        subTotal: String!
        amountPaid: String!
        status: String!
    }

    type Order {
        orderId: ID!
        email: String!
        date: String!
    }

    type POD {
        status: Boolean!
        totalAmount: String
    }

    type RepairOrder {
        orderId: ID!
        email: String!
        paymentStatus: String!
        repairStatus: String!
        date: String!
    }

    type Game {
        id: ID!
        title: String!
        rating: Int!
    }

    type TrendingGame {
        id: ID!
        title: String!
        imageUrl: String!
        desc: String
        rating: Int!
        platform: String!
        genre: String!
    }

    type KycList {
        id: ID!
        userId: ID!
        fullname: String!
        status: String!
    }

    type KycDoc {
        kind: String!
        file: String!
    }

    type KycData {
        userId: ID!
        fullname: String!
        email: String!
        residence: String!
        phone: String!
        documents: [KycDoc!]!
    }

    type Currency {
        id: ID!
        country: String!
        currency: String!
        rate: Int!
    }

    type GameRepair {
        id: ID!
        title: String!
        imageUrl: String!
        category: String!
        game: String!
        desc: String
        price: String!
        duration: String
    }

    type Refund {
        id: ID!
        username: String!
        amount: String!
        currency: String!
        status: String!
        createdAt: String!
    }

    type RefundInfo {
        id: ID!
        email: String!
        username: String!
        amount: String!
        currency: String!
        orderInfo: String!
        reason: String!
        otherReason: String
        imageUrls: [String!]
        progress: String!
        status: String!
        createdAt: String!
        updatedAt: String!
    }

    type GameRent {
        id: ID!
        title: String!
        imageUrl: String!
        category: String!
        subCategory: String!
        info: String!
        rate: String!
    }

    type OrderProgressOptions {
        shop: [String!]!
        product: [String!]!
    }

    input RepairInput {
        title: String!
        imageUrl: String
        category: String!
        game: [String!]!
        desc: String
        price: Float!
        duration: String
    }

    input CurrencyInput {
        country: String!
        currency: String!
        rate: Int!
    }

    input TrendingGameData {
        title: String!
        imageUrl: String
        desc: String
        rating: Int!
        platform: String
        genre: String!
    }

    input GameDownloadInput {
        title: String!
        desc: String
        platform: String!
        imageUrl: String
        gameList: [String!]!
        installType: String!
        price: Float!
        installDuration: String
        homeService: String
    }

    input GameSwapInput {
        title: String!
        imageUrl: String
        platform: String!
        condition: String!
        genre: [String!]!
        desc: String
        yearOfRelease: String!
        swapFee: Float!
        acceptedTitles: [String!]
    }

    input GameRentInput {
        title: String!
        imageUrl: String
        category: String!
        subCategory: String!
        info: String!
        rate: Float!
    }

    type Query {
        slides: [Slide!]!
        getAccessKeys: AccessKeysInfo!
        getAdminUsers: [UserCard!]!
        getAdminUserInfo(id: ID!): UserInfo!
        generateAccessKey: String!
        findUser(searchBy: String!, value: String!): UserInfo
        fetchPosts: [PostData!]!
        getOrders: [Order!]!
        getOrderProgressOptions: OrderProgressOptions!
        getOrder(orderId: ID!): OrderDetails!
        trendingGamesList: [Game!]!
        getUsersKyc: [KycList!]!
        viewUserKyc(id: ID!): KycData!
        getCurrencyList: [Currency!]!
        getRefunds: [Refund]!
        getRefundInfo(id: ID!): RefundInfo!
    }

    type Mutation {
        createAdminUser(userQueryInput: UserInputData): UserData!
        createSlide(adminQueryInput: SlideData): Slide!
        createOrEditCategory(id: String, categoryTitle: String, subcategoryTitles: [String!]! ): ActionStatus!
        addProductToCategory(id: String!, categoryTitle: String!, subcategoryTitle: String! ): ActionStatus!
        createProduct(adminQueryInput: ProdData, prodId: String): ProdStatus!
        createTrendingGame(trendingGameInput: TrendingGameData!): ActionStatus!
        deleteSlide(id: ID!): Boolean
        deleteProduct(id: ID!): ActionStatus
        deleteCategory(id: ID!): ActionStatus
        createAdminAccKeyword(keyword: String!): [AccessData!]!
        deleteAdminAccKeyword(keyword: String!): Boolean
        deleteUser(searchBy: String!, value: String!): ActionStatus
        clearAccessKeys: [String]!
        createPost(postTitle: String!): ActionStatus!
        deletePost(postId: String!): ActionStatus!
        deleteComment(postId: ID!, commentId: ID!): ActionStatus!
        deleteOrder(orderId: String!): ActionStatus!
        deleteTrendingGame(id: ID!): ActionStatus!
        updateOrderStatus(orderId: String!, orderProgress: String!): ActionStatus!
        deleteKyc(id: String!): ActionStatus!
        confirmKyc(id: ID!, userId: ID!, action: String!): ActionStatus!
        createGameDownload(adminQueryInput: GameDownloadInput!): ActionStatus!
        deleteGameDownload(id: ID!): ActionStatus!
        createOrEditCurrency(id: ID, adminQueryInput: CurrencyInput!): ActionStatus!
        deleteCurrency(id: ID!): ActionStatus!
        setDefaultCurrency(currencyOption: String!): ActionStatus!
        createGameRepair(adminQueryInput: RepairInput): ActionStatus!
        deleteGameRepair(id: ID!): ActionStatus!
        updateRefundProgress(id: ID!, progress: String!): ActionStatus!
        createGameSwap(adminQueryInput: GameSwapInput!): ActionStatus!
        deleteGameSwap(id: ID!): ActionStatus!
        createGameRent(adminQueryInput: GameRentInput!): ActionStatus!
        deleteGameRent(id: ID!): ActionStatus!
    }
`;