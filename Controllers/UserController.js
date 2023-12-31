import asyncHandler from "express-async-handler";
import User from "../Models/UserModels.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../middlewares/Auth.js";

import * as config from "../config/config.js";
import dateFormat from "dateformat";
import QueryString from "qs";
import crypto from "crypto";
import moment from "moment";

// @desc Register user
// @route POST /api/users/
// @access Public
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, password, image } = req.body;
  try {
    const userExists = await User.findOne({ email });
    // check if user exists
    if (userExists) {
      res.status(400);
      throw new Error("User already exists");
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // create user in DB
    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      image,
    });

    // if user created successfully send user data and token to client
    if (user) {
      res.status(201).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        image: user.image,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
      });
    } else {
      res.status(400);
      throw new Error("Invalid user data");
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc Login user
// @route POST /api/users/login
// @access Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  try {
    // find user in DB
    const user = await User.findOne({ email });
    // if user exists compare password with hashed password then send user data and token to client
    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        image: user.image,
        isAdmin: user.isAdmin,
        token: generateToken(user._id),
      });
      // if user not found or password not match send error message
    } else {
      res.status(401);
      throw new Error("Invalid email or password");
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ********* PRIVATE CONTROLLERS *********

// @desc Update user profile
// @route PUT /api/users/profile
// @access Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const { fullName, email, image } = req.body;
  try {
    // find user in DB
    const user = await User.findById(req.user._id);
    // if user exists update user data and save it in DB
    if (user) {
      user.fullName = fullName || user.fullName;
      user.email = email || user.email;
      user.image = image || user.image;

      const updatedUser = await user.save();
      // send updated user data and token to client
      res.json({
        _id: updatedUser._id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        image: updatedUser.image,
        isAdmin: updatedUser.isAdmin,
        token: generateToken(updatedUser._id),
      });
    }
    // else send error message
    else {
      res.status(404);
      throw new Error("User not found");
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc Delete user profile
// @route DELETE /api/users
// @access Private
const deleteUserProfile = asyncHandler(async (req, res) => {
  try {
    // find user in DB
    const user = await User.findById(req.user._id);
    // if user exists delete user from DB
    if (user) {
      // if user is admin throw error message
      if (user.isAdmin) {
        res.status(400);
        throw new Error("Can't delete admin user");
      }
      // else delete user from DB
      await user.remove();
      res.json({ message: "User deleted successfully" });
    }
    // else send error message
    else {
      res.status(404);
      throw new Error("User not found");
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc Change user password
// @route PUT /api/users/password
// @access Private
const changeUserPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    // find user in DB
    const user = await User.findById(req.user._id);
    // if user exists compare old password with hashed password then update user password and save it in DB
    if (user && (await bcrypt.compare(oldPassword, user.password))) {
      // hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      user.password = hashedPassword;
      await user.save();
      res.json({ message: "Password changed!!" });
    }
    // else send error message
    else {
      res.status(401);
      throw new Error("Invalid old password");
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc Get all liked movies
// @route GET /api/users/favorites
// @access Private
const getLikedMovies = asyncHandler(async (req, res) => {
  try {
    // find user in DB
    const user = await User.findById(req.user._id).populate("likedMovies");
    // if user exists send liked movies to client
    if (user) {
      res.json(user.likedMovies);
    }
    // else send error message
    else {
      res.status(404);
      throw new Error("User not found");
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc Add movie to liked movies
// @route POST /api/users/favorites
// @access Private
const addLikedMovie = asyncHandler(async (req, res) => {
  const { movieId } = req.body;
  try {
    // find user in DB
    const user = await User.findById(req.user._id);
    // if user exists add movie to liked movies and save it in DB
    if (user) {
      // check if movie already liked
      // if movie already liked send error message
      if (user.likedMovies.includes(movieId)) {
        res.status(400);
        throw new Error("Movie already liked");
      }
      // else add movie to liked movies and save it in DB
      user.likedMovies.push(movieId);
      await user.save();
      res.json(user.likedMovies);
    }
    // else send error message
    else {
      res.status(404);
      throw new Error("Movie not found");
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc Delete all liked movies
// @route DELETE /api/users/favorites
// @access Private
const deleteLikedMovies = asyncHandler(async (req, res) => {
  try {
    // find user in DB
    const user = await User.findById(req.user._id);
    // if user exists delete all liked movies and save it in DB
    if (user) {
      user.likedMovies = [];
      await user.save();
      res.json({ message: "Your favorites movies deleted successfully" });
    }
    // else send error message
    else {
      res.status(404);
      throw new Error("User not found");
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//  ************** ADMIN CONTROLLERS **************

// @desc Get all users
// @route GET /api/users
// @access Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  try {
    // find all users in DB
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc Delete user
// @route DELETE /api/users/:id
// @access Private/Admin
const deleteUser = asyncHandler(async (req, res) => {
  try {
    // find user in DB
    const user = await User.findById(req.params.id);
    // if user exists delete user from DB
    if (user) {
      // if user is admin throw error message
      if (user.isAdmin) {
        res.status(400);
        throw new Error("Can't delete admin user");
      }
      // else delete user from DB
      await user.remove();
      res.json({ message: "User deleted successfully" });
    }
    // else send error message
    else {
      res.status(404);
      throw new Error("User not found");
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const vnpayReturn = asyncHandler(async (req, res) => {
  try {
    var vnp_Params = req.query;

    var secureHash = vnp_Params["vnp_SecureHash"];

    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    vnp_Params = sortObject(vnp_Params);

    var tmnCode = config.vnp_TmnCode;
    var secretKey = config.vnp_HashSecret;

    var signData = QueryString.stringify(vnp_Params, { encode: false });
    var hmac = crypto.createHmac("sha512", secretKey);
    var signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");

    if (secureHash === signed) {
      res.redirect(
        "http://localhost:3000/thanks?vnp_Params=" +
          encodeURIComponent(vnp_Params["vnp_ResponseCode"])
      );
    } else {
      res.render("success", { code: "97" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

function sortObject(obj) {
  var sorted = {};
  var str = [];
  var key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}
const vnpayPayment = asyncHandler(async (req, res) => {
  try {
    var ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;

    const bodyData = req.body.data;
    var tmnCode = config.vnp_TmnCode;
    var secretKey = config.vnp_HashSecret;
    var vnpUrl = config.vnp_Url;
    var returnUrl = config.vnp_ReturnUrl;

    // var date = new Date();
    // var createDate = dateFormat(date, "yyyymmddHHmmss");
    // var orderId = dateFormat(date, "HHmmss");

    var createDate = moment().format("YYYYMMDDHHmmss");
    var expireDate = moment().add(15, "minutes").format("YYYYMMDDHHmmss");
    var orderId = moment().format("hmmss");

    var amount = bodyData.amount;
    var bankCode = bodyData.bankCode;
    var orderInfo = bodyData.orderInfo;
    var orderType = "other";
    var locale = "vn";
    if (locale === null || locale === "") {
      locale = "vn";
    }
    var currCode = "VND";
    var vnp_Params = {};
    vnp_Params["vnp_Version"] = "2.1.0";
    vnp_Params["vnp_Command"] = "pay";
    vnp_Params["vnp_TmnCode"] = tmnCode;
    vnp_Params["vnp_Locale"] = locale;
    vnp_Params["vnp_CurrCode"] = currCode;
    vnp_Params["vnp_TxnRef"] = orderId;
    vnp_Params["vnp_OrderInfo"] = orderInfo;
    vnp_Params["vnp_OrderType"] = orderType;
    vnp_Params["vnp_Amount"] = amount * 100;
    vnp_Params["vnp_ReturnUrl"] = returnUrl;
    vnp_Params["vnp_IpAddr"] = ipAddr;
    vnp_Params["vnp_CreateDate"] = createDate;
    vnp_Params["vnp_ExpireDate"] = expireDate;
    console.log(vnp_Params);
    if (bankCode !== null && bankCode !== "") {
      vnp_Params["vnp_BankCode"] = bankCode;
    }
    var sorted = {};
    var str = [];
    var key;
    for (key in vnp_Params) {
      if (vnp_Params.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(vnp_Params[str[key]]).replace(
        /%20/g,
        "+"
      );
    }
    vnp_Params = sorted;
    var signData = QueryString.stringify(vnp_Params, { encode: false });
    var hmac = crypto.createHmac("sha512", secretKey);
    var signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");
    vnp_Params["vnp_SecureHash"] = signed;
    vnpUrl += "?" + QueryString.stringify(vnp_Params, { encode: false });
    res.json({
      url: vnpUrl,
    });
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ message: error.message });
  }
});

export {
  registerUser,
  loginUser,
  updateUserProfile,
  deleteUserProfile,
  changeUserPassword,
  getLikedMovies,
  addLikedMovie,
  deleteLikedMovies,
  getUsers,
  deleteUser,
  vnpayReturn,
  vnpayPayment,
};
