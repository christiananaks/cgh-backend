export default `#graphql
    type AccInfo {
        phone: String
        gamingId: GamingId
        kycStatus: String!
        role: String!
        creator: String!
    }

    type MyGames {
        category: String!
        names: [String!]!
    }
    
    input MyGamesInput {
        category: String!
        names: [String!]!
    }
    
    type UserData {
        id: ID!
        profilePic: String
        firstName: String!
        lastName: String!
        username: String!
        email: String!
        password: String!
        stats: UserStats!
        accInfo: AccInfo!
        myGames: [MyGames!]!
        purchaseHistory: String
    }

    input UserInputData {
        firstName: String!
        lastName: String!
        username: String
        email: String!
        phone: String
        password: String!
        confirmPassword: String!
    }

    type UserStats {
        sp: Int!
        xp: Int!
        maxXp: Int!
        level: Int!
        date: String!
    }

    type AuthData {
        userId: ID!
        profilePic: String
        firstName: String!
        lastName: String!
        username: String!
        email: String!
        stats: UserStats!
        accInfo: AccInfo!
        myGames: [MyGames!]!
        purchaseHistory: String
        accessToken: String!
        refreshToken: String!
    }

    type CatData {
        id: ID!
        title: String!
        subcategories: [String!]!
    }

    type GameDownload {
        id: ID!
        title: String!
        platform: String!
        imageUrl: String
        gameList: [String!]!
        installType: String!
        price: Int!
        installDuration: String
        homeService: String!
    }

    input NewPasswordData {
        userId: ID!
        token: String!
        newPassword: String!
        confirmPassword: String!
    }

    type GameSwap {
        id: ID!
        title: String!
        imageUrl: String!
        platform: String!
        condition: String!
        genre: [String!]!
        desc: String
        yearOfRelease: String!
        swapFee: String!
        acceptedTitles: [String!]
    }

    type Token {
        accessToken: String!
        refreshToken: String!
    }

    type FileUploadStatus {
        success: String!
        message: String!
        filesURLPath: [String!]!
    }

    scalar Upload

    type Query {
        login(email: String!, password: String!): AuthData!
        getUsernames: [String!]!
        getAllProducts: [Product!]!
        getProduct(prodId: String!): Product!
        getCatProducts(catTitle: String!): [Product!]!
        getAllCategories: [CatData!]!
        getPost: Post!
        resetPassword(email: String!): ActionStatus!
        getTrendingGames: [TrendingGame!]!
        getTopRatedGames: [Product!]!
        getTodayDeals: [Product!]!
        getPopularOffers: [Product!]!
        getGameDownloads: [GameDownload!]!
        getGameDownloadPackage(platform: String!, version: String, serialNumber: String): [GameDownload!]!
        getGameRepairs: [GameRepair!]!
        getGameSwap: [GameSwap!]!
        gameSwapInfo(id: ID!): GameSwap!
        getGameRent: [GameRent!]!
        gameRentInfo(id: ID!): GameRent!
        getToken: Token!
        getInAppNotice: InAppNotice
        slides: [Slide!]!
    }

    type Mutation {
        createUser(userQueryInput: UserInputData): ActionStatus!
        postNewPassword(userQueryInput: NewPasswordData): ActionStatus!
        postFilesUpload(uploadPathName: String!, files: [Upload!]!): FileUploadStatus!
    }
`;
