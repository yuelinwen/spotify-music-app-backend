const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

let Schema = mongoose.Schema;

let userSchema = new Schema({
    userName: {
        type: String,
        unique: true
    },
    password: String,
    favourites: [String]
});

let User;
let connecting;

// Serverless invocations reuse a warm container, so hand back the in-flight or
// finished connection instead of opening a second one.
module.exports.connect = function () {
    if (!connecting) {
        const mongoDBConnectionString = process.env.MONGO_URL;

        if (!mongoDBConnectionString) {
            return Promise.reject(new Error("MONGO_URL is not set"));
        }

        connecting = mongoose.createConnection(mongoDBConnectionString).asPromise()
            .then(db => {
                User = db.model("users", userSchema);
            })
            .catch(err => {
                connecting = null;
                throw err;
            });
    }

    return connecting;
};

module.exports.registerUser = async function (userData) {
    if (!userData.userName || !userData.password) {
        throw "User name and password are required";
    }

    if (userData.password != userData.password2) {
        throw "Passwords do not match";
    }

    const newUser = new User({
        userName: userData.userName,
        password: await bcrypt.hash(userData.password, 10),
        favourites: []
    });

    try {
        await newUser.save();
    } catch (err) {
        if (err.code == 11000) {
            throw "User Name already taken";
        }
        throw "There was an error creating the user: " + err;
    }

    return "User " + userData.userName + " successfully registered";
};

module.exports.checkUser = async function (userData) {
    const user = await User.findOne({ userName: userData.userName }).exec();

    // Same message either way, so a failed login does not reveal which
    // user names exist.
    if (!user || !await bcrypt.compare(userData.password || "", user.password)) {
        throw "Incorrect user name or password";
    }

    return user;
};

module.exports.getFavourites = async function (id) {
    const user = await User.findById(id).exec();

    if (!user) {
        throw `Unable to get favourites for user with id: ${id}`;
    }

    return user.favourites;
};

module.exports.addFavourite = async function (id, favId) {
    const user = await User.findById(id).exec();

    if (!user || user.favourites.length >= 50) {
        throw `Unable to update favourites for user with id: ${id}`;
    }

    const updated = await User.findByIdAndUpdate(id,
        { $addToSet: { favourites: favId } },
        { new: true }
    ).exec();

    return updated.favourites;
};

module.exports.removeFavourite = async function (id, favId) {
    const updated = await User.findByIdAndUpdate(id,
        { $pull: { favourites: favId } },
        { new: true }
    ).exec();

    if (!updated) {
        throw `Unable to update favourites for user with id: ${id}`;
    }

    return updated.favourites;
};
