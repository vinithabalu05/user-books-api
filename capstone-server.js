const express = require("express");
const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { Sequelize, DataTypes } = require("sequelize");

dotenv.config();

const app = express();

/* =====================================================
   CONFIGURATION
===================================================== */

const PORT = process.env.PORT || 3000;


/* =====================================================
   FRONTEND
===================================================== */

app.use(
    express.static(
        path.join(__dirname, "frontend")
    )
);


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(express.json());

app.use(
    cors({
        origin:
            process.env.CLIENT_ORIGIN ||
            "http://localhost:3000"
    })
);


/* =====================================================
   DATABASE
===================================================== */

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: "mysql",
        logging: false
    }
);


/* =====================================================
   USER MODEL
===================================================== */

const User = sequelize.define(
    "User",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },

        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,

            validate: {
                isEmail: true
            }
        },

        password: {
            type: DataTypes.STRING,
            allowNull: false
        },

        role: {
            type: DataTypes.ENUM(
                "USER",
                "ADMIN"
            ),

            allowNull: false,

            defaultValue: "USER"
        }
    },

    {
        tableName: "Users"
    }
);


/* =====================================================
   BOOK MODEL
===================================================== */

const Book = sequelize.define(
    "Book",
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },

        title: {
            type: DataTypes.STRING,
            allowNull: false
        },

        userId: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    },

    {
        tableName: "Books"
    }
);


/* =====================================================
   ASSOCIATIONS
===================================================== */

User.hasMany(
    Book,
    {
        foreignKey: "userId",
        onDelete: "CASCADE"
    }
);

Book.belongsTo(
    User,
    {
        foreignKey: "userId"
    }
);


/* =====================================================
   USER DTO
===================================================== */

function toUserDTO(user) {

    return {
        id: user.id,
        email: user.email,
        role: user.role
    };

}


/* =====================================================
   HOME PAGE
===================================================== */

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "frontend",
                "index.html"
            )
        );

    }
);


/* =====================================================
   TEST API
===================================================== */

app.get(
    "/api/test",
    (req, res) => {

        res.status(200).json({

            message:
                "User & Books API is running"

        });

    }
);


/* =====================================================
   REGISTER
===================================================== */

app.post(
    "/api/register",

    [
        body("email")
            .isEmail()
            .withMessage(
                "Valid email is required"
            ),

        body("password")
            .isLength({
                min: 8
            })
            .withMessage(
                "Password must be at least 8 characters"
            )
    ],

    async (req, res, next) => {

        try {

            const errors =
                validationResult(req);


            if (!errors.isEmpty()) {

                return res.status(400).json({

                    errors:
                        errors.array()

                });

            }


            const {
                email,
                password
            } = req.body;


            const existingUser =
                await User.findOne({

                    where: {
                        email
                    }

                });


            if (existingUser) {

                return res.status(409).json({

                    message:
                        "Email already registered"

                });

            }


            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );


            const user =
                await User.create({

                    email,

                    password:
                        hashedPassword,

                    role:
                        "USER"

                });


            res.status(201).json({

                message:
                    "User registered successfully",

                user:
                    toUserDTO(user)

            });

        }

        catch (error) {

            next(error);

        }

    }
);


/* =====================================================
   LOGIN
===================================================== */

app.post(
    "/api/login",

    [
        body("email")
            .isEmail()
            .withMessage(
                "Valid email is required"
            ),

        body("password")
            .notEmpty()
            .withMessage(
                "Password is required"
            )
    ],

    async (req, res, next) => {

        try {

            const errors =
                validationResult(req);


            if (!errors.isEmpty()) {

                return res.status(400).json({

                    errors:
                        errors.array()

                });

            }


            const {
                email,
                password
            } = req.body;


            const user =
                await User.findOne({

                    where: {
                        email
                    }

                });


            if (!user) {

                return res.status(401).json({

                    message:
                        "Invalid email or password"

                });

            }


            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );


            if (!passwordMatch) {

                return res.status(401).json({

                    message:
                        "Invalid email or password"

                });

            }


            /* ACCESS TOKEN */

            const accessToken =
                jwt.sign(

                    {
                        id:
                            user.id,

                        email:
                            user.email,

                        role:
                            user.role
                    },

                    process.env.JWT_SECRET,

                    {
                        expiresIn:
                            "15m"
                    }

                );


            /* REFRESH TOKEN */

            const refreshToken =
                jwt.sign(

                    {
                        id:
                            user.id,

                        email:
                            user.email,

                        role:
                            user.role
                    },

                    process.env.REFRESH_SECRET,

                    {
                        expiresIn:
                            "7d"
                    }

                );


            res.status(200).json({

                message:
                    "Login successful",

                accessToken,

                refreshToken,

                user:
                    toUserDTO(user)

            });

        }

        catch (error) {

            next(error);

        }

    }
);


/* =====================================================
   REFRESH TOKEN
===================================================== */

app.post(
    "/api/refresh",

    async (req, res, next) => {

        try {

            const {
                refreshToken
            } = req.body;


            if (!refreshToken) {

                return res.status(401).json({

                    message:
                        "Refresh token required"

                });

            }


            const decoded =
                jwt.verify(
                    refreshToken,
                    process.env.REFRESH_SECRET
                );


            const accessToken =
                jwt.sign(

                    {
                        id:
                            decoded.id,

                        email:
                            decoded.email,

                        role:
                            decoded.role
                    },

                    process.env.JWT_SECRET,

                    {
                        expiresIn:
                            "15m"
                    }

                );


            res.status(200).json({

                accessToken

            });

        }

        catch (error) {

            return res.status(401).json({

                message:
                    "Invalid or expired refresh token"

            });

        }

    }
);


/* =====================================================
   AUTHENTICATION MIDDLEWARE
===================================================== */

function authenticateToken(
    req,
    res,
    next
) {

    const authHeader =
        req.headers.authorization;


    const token =
        authHeader &&
        authHeader.startsWith("Bearer ")
            ? authHeader.substring(7)
            : null;


    if (!token) {

        return res.status(401).json({

            message:
                "Access token required"

        });

    }


    try {

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );


        req.user =
            decoded;


        next();

    }

    catch (error) {

        return res.status(403).json({

            message:
                "Invalid or expired access token"

        });

    }

}


/* =====================================================
   ROLE AUTHORIZATION
===================================================== */

function authorize(
    ...allowedRoles
) {

    return (
        req,
        res,
        next
    ) => {

        if (
            !req.user ||
            !allowedRoles.includes(
                req.user.role
            )
        ) {

            return res.status(403).json({

                message:
                    "Access denied"

            });

        }


        next();

    };

}


/* =====================================================
   PROFILE
===================================================== */

app.get(
    "/api/profile",

    authenticateToken,

    async (
        req,
        res,
        next
    ) => {

        try {

            const user =
                await User.findByPk(
                    req.user.id
                );


            if (!user) {

                return res.status(404).json({

                    message:
                        "User not found"

                });

            }


            res.status(200).json(
                toUserDTO(user)
            );

        }

        catch (error) {

            next(error);

        }

    }
);


/* =====================================================
   GET ALL USERS
   ADMIN ONLY
===================================================== */

app.get(
    "/api/users",

    authenticateToken,

    authorize("ADMIN"),

    async (
        req,
        res,
        next
    ) => {

        try {

            const users =
                await User.findAll({

                    attributes: [
                        "id",
                        "email",
                        "role",
                        "createdAt",
                        "updatedAt"
                    ],

                    order: [
                        [
                            "id",
                            "ASC"
                        ]
                    ]

                });


            res.status(200).json(
                users
            );

        }

        catch (error) {

            next(error);

        }

    }
);


/* =====================================================
   DELETE USER
   ADMIN ONLY
===================================================== */

app.delete(
    "/api/users/:id",

    authenticateToken,

    authorize("ADMIN"),

    async (
        req,
        res,
        next
    ) => {

        try {

            const userId =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(
                    userId
                )
            ) {

                return res.status(400).json({

                    message:
                        "Invalid user ID"

                });

            }


            /* Prevent admin deleting own account */

            if (
                userId ===
                Number(req.user.id)
            ) {

                return res.status(400).json({

                    message:
                        "Admin cannot delete their own account"

                });

            }


            const user =
                await User.findByPk(
                    userId
                );


            if (!user) {

                return res.status(404).json({

                    message:
                        "User not found"

                });

            }


            await user.destroy();


            res.status(200).json({

                message:
                    "User deleted successfully"

            });

        }

        catch (error) {

            next(error);

        }

    }
);


/* =====================================================
   CREATE BOOK
===================================================== */

app.post(
    "/api/books",

    authenticateToken,

    async (
        req,
        res,
        next
    ) => {

        try {

            const {
                title
            } = req.body;


            if (
                !title ||
                typeof title !== "string" ||
                title.trim() === ""
            ) {

                return res.status(400).json({

                    message:
                        "Book title is required"

                });

            }


            const book =
                await Book.create({

                    title:
                        title.trim(),

                    userId:
                        req.user.id

                });


            res.status(201).json(
                book
            );

        }

        catch (error) {

            next(error);

        }

    }
);


/* =====================================================
   GET BOOKS
===================================================== */

app.get(
    "/api/books",

    authenticateToken,

    async (
        req,
        res,
        next
    ) => {

        try {

            let books;


            /*
             * ADMIN
             * Can see all books
             */

            if (
                req.user.role ===
                "ADMIN"
            ) {

                books =
                    await Book.findAll({

                        order: [
                            [
                                "id",
                                "ASC"
                            ]
                        ]

                    });

            }


            /*
             * USER
             * Can see only own books
             */

            else {

                books =
                    await Book.findAll({

                        where: {

                            userId:
                                req.user.id

                        },

                        order: [
                            [
                                "id",
                                "ASC"
                            ]
                        ]

                    });

            }


            res.status(200).json(
                books
            );

        }

        catch (error) {

            next(error);

        }

    }
);


/* =====================================================
   ADMIN - GET ALL BOOKS
===================================================== */

app.get(
    "/api/admin/books",

    authenticateToken,

    authorize("ADMIN"),

    async (
        req,
        res,
        next
    ) => {

        try {

            const books =
                await Book.findAll({

                    order: [
                        [
                            "id",
                            "ASC"
                        ]
                    ]

                });


            res.status(200).json(
                books
            );

        }

        catch (error) {

            next(error);

        }

    }
);


/* =====================================================
   LOGOUT
===================================================== */

app.post(
    "/api/logout",

    authenticateToken,

    (
        req,
        res
    ) => {

        res.status(200).json({

            message:
                "Logout successful"

        });

    }
);


/* =====================================================
   API 404 HANDLER
   IMPORTANT
===================================================== */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            message:
                `API endpoint not found: ${req.method} ${req.originalUrl}`

        });

    }
);


/* =====================================================
   CENTRALIZED ERROR HANDLER
===================================================== */

app.use(
    (
        err,
        req,
        res,
        next
    ) => {

        console.error(
            err.stack
        );


        res.status(
            err.status || 500
        ).json({

            message:
                err.message ||
                "Internal Server Error"

        });

    }
);


/* =====================================================
   START SERVER
===================================================== */

async function startServer() {

    try {

        await sequelize.authenticate();


        console.log(
            "MySQL database connected successfully"
        );


        await sequelize.sync();


        console.log(
            "Database tables synchronized successfully"
        );


        app.listen(
            PORT,
            () => {

                console.log(
                    `Server running on port ${PORT}`
                );

            }
        );

    }

    catch (error) {

        console.error(
            "Unable to start server:",
            error.message
        );

    }

}


/* =====================================================
   START ONLY WHEN RUN DIRECTLY
===================================================== */

if (
    require.main === module
) {

    startServer();

}


/* =====================================================
   EXPORT APP FOR JEST
===================================================== */

module.exports = app;