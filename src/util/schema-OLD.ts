import { buildSchema } from "graphql";
import adminSchema from "../graphql/admin/schema/admin-schema";

// register allowed mutation in RootMutation, allowed queries in RootQuery   // [Slide!] the array can be empty but is only able to hold Slide objects and NOT undefined
export default buildSchema(`#graphql
    type Slide {
        id: ID!
        title: String!
        desc: String
        imageUrl: String!
        creator: String!
    }

    ${adminSchema}

    type User {
        id: ID!
        firstName: String!
        lastName: String!
        username: String!
        email: String!
        password: String!
        userstats: UserStats!
        accType: String!
    }

    type UserStats {
        streakPoints: Int!
        xp: Int!
        date: String!
    }

    type Slides {
        slidesDb: [Slide!]
    }

    type AuthData {
        userId: String!
        token: String!
    }

    type CartData {
        cartObjId: ID!
        prodId: ID!
        prodTitle: String!
        qty: Int!
        price: Int!
    }

    type WishlistActionResult {
        addedToWishlist: Boolean!
        actionStatus: String!
    }

    input SlideData {
        title: String!
        desc: String
        imageUrl: String!
    }

    input UserInputData {
        firstName: String!
        lastName: String!
        username: String
        email: String!
        password: String!
        confirmPassword: String!
    }

    type RootQuery {
        slides: Slides!
        getKeysArray: Keywords!
        showCart: [CartData!]!
        getWishlist: [Product!]!
        login(email: String!, password: String!): AuthData!
    }

    type RootMutation {
        createSlide(slideInput: SlideData): Slide!
        createProduct(prodInput: ProdData): Product!
        deleteSlide(id: ID!): Boolean
        createUser(userData: UserInputData): User!
        createAdminAccKeyword(keyword: String!): Keywords!
        deleteAdminAccKeyword(keyword: String!): Boolean
        addToCart(prodId: String!): Boolean
        removeFromCart(cartObjId: String!): Boolean
        editWishlist(prodId: String!): WishlistActionResult
    }

    schema {
        query: RootQuery
        mutation: RootMutation
    }
`);
