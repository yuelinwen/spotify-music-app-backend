const express = require('express');
const cors = require("cors");
const jwt = require('jsonwebtoken');
const passport = require("passport");
const passportJWT = require("passport-jwt");
const dotenv = require("dotenv");

dotenv.config();

const userService = require("./user-service.js");

const app = express();

const HTTP_PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(cors());


//***************Config code***************

// JSON Web Token Setup
var ExtractJwt = passportJWT.ExtractJwt;
var JwtStrategy = passportJWT.Strategy;

// Configure its options
var jwtOptions = {};
jwtOptions.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme("jwt");

// IMPORTANT - this secret should be a long, unguessable string
// (ideally stored in a "protected storage" area on the
// web server, a topic that is beyond the scope of this course)
// We suggest that you generate a random 64-character string
// using the following online tool:
// https://lastpass.com/generatepassword.php

jwtOptions.secretOrKey = process.env.JWT_SECRET;

if (!jwtOptions.secretOrKey) {
    // JwtStrategy throws on an undefined secret, which would take down every
    // route including the ones that need no token.
    throw new Error("JWT_SECRET is not set");
}

var strategy = new JwtStrategy(jwtOptions, function (jwt_payload, next) {
    console.log('payload received', jwt_payload);

    if (jwt_payload) {
        // The following will ensure that all routes using 
        // passport.authenticate have a req.user._id, req.user.userName, req.user.fullName & req.user.role values 
        // that matches the request payload data
        next(null, {
            _id: jwt_payload._id,
            userName: jwt_payload.userName
        });
    } else {
        next(null, false);
    }
});

// tell passport to use our "strategy"
passport.use(strategy);

// add passport as application-level middleware
app.use(passport.initialize());

// The database is connected per request rather than before listen(): on a
// serverless host a failed connection at startup kills the whole function, so
// every route 500s, even the ones that never touch Mongo.
function withDatabase(handler) {
    return function (req, res) {
        userService.connect()
            .then(() => handler(req, res))
            .catch((err) => {
                console.log("database unavailable: " + err);
                res.status(503).json({ "message": "Database unavailable" });
            });
    };
}

/* TODO Add Your Routes Here */
app.get("/",(req,res)=>{
    res.status(200).json({
        status: 'ok',
        author: 'Yuelin Wen',
        githubUrl: 'https://github.com/yuelin-wen/spotify-mongodb-api',
        // version,
    });
})

app.post("/api/user/register", withDatabase(function (req, res) {
    return userService.registerUser(req.body)
        .then((msg) => {
            res.status(200).json({ "message": msg });
        }).catch((msg) => {
            res.status(422).json({ "message": msg });
        });
}))

app.post("/api/user/login", withDatabase(function (req, res) {
    return userService.checkUser(req.body)
        .then((user) => {
            var payload = {
                _id: user._id,
                userName: user.userName
            };
            var token = jwt.sign(payload, jwtOptions.secretOrKey, { expiresIn: "7d" });
            res.status(200).json({ "message": "login successful", "token": token });
        }).catch((msg) => {
            res.status(422).json({ "message": msg });
        });
}));

app.get("/api/user/favourites", passport.authenticate('jwt', { session: false }), withDatabase(function (req, res) {
    return userService.getFavourites(req.user._id).then((data) => {
        res.status(200).json(data);
    }).catch((err) => {
        res.status(500).json({ message: err });
    });
}))

app.put("/api/user/favourites/:id", passport.authenticate('jwt', { session: false }), withDatabase(function (req, res) {
    return userService.addFavourite(req.user._id, req.params.id)
        .then((data) => {
            res.status(200).json(data);
        }).catch((err) => {
            res.status(500).json({ message: err });
        })
}))

// 200, not 204: the updated favourites array is the response body, and a 204
// is defined to have none, so the client was receiving null.
app.delete("/api/user/favourites/:id", passport.authenticate('jwt', { session: false }), withDatabase(function (req, res) {
    return userService.removeFavourite(req.user._id, req.params.id)
        .then((data) => {
            res.status(200).json(data);
        }).catch((err) => {
            res.status(500).json({ message: err });
        })
}))

if (require.main === module) {
    app.listen(HTTP_PORT, () => { console.log("API listening on: " + HTTP_PORT) });
}

module.exports = app;
