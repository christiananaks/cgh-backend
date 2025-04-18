export default `
    type AccInfo {
        phone: String
        gamingId: GamingId
        kycStatus: String!
        accType: String!
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
        userstats: UserStats!
        accInfo: AccInfo!
        myGames: [MyGames!]!
        purchaseHistory: String
    }

    input UserInputData {
        firstName: String!
        lastName: String!
        username: String
        profilePic: String
        email: String!
        phone: String!
        gamingIdHandle: String
        platform: String
        myGames: [MyGamesInput!]
        password: String!
        confirmPassword: String!
    }

    type UserStats {
        streakPoints: Int!
        xp: Int!
        date: String!
    }

    type AuthData {
        userId: String!
        accessToken: String!
        refreshToken: String!
        userstats: UserStats!
        accType: String!
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

    type RootQuery {
        login(email: String!, password: String!): AuthData!
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
    }

    type RootMutation {
        createUser(userQueryInput: UserInputData): UserData!
        postNewPassword(userQueryInput: NewPasswordData): ActionStatus!
    }
`;