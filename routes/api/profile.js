// const express = require("express");
// const router = express.Router();
// const auth = require("../../middleware/auth");
// const { check, validationResult } = require("express-validator");
// const normalizeURL = require("normalize-url");
import express, { json } from "express";
const router = express.Router();
import { check, validationResult } from "express-validator";
import normalizeURL from "normalize-url";

// const Profile = require("../../models/Profile");
// const User = require("../../models/User");
import auth from "../../middleware/auth.js";
import Profile from "../../models/Profile.js";
import User from "../../models/User.js";

// @route   GET api/profile/me
// @desc    Get current user's profile
// @access  Private
router.get("/me", auth, async (req, res) => {
  try {
    //get user's profile by user id, and fill it in with user's name and avatar form UserSchema
    const profile = await Profile.findOne({ user: req.user.id }).populate(
      "user",
      ["name", "avatar"]
    );
    if (!profile) {
      return res.status(400).json({ msg: "Profile not found" });
    }

    return res.json(profile);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// @route   POST api/profile/
// @desc    Create or update current user's profile
// @access  Private
router.post(
  "/",
  [
    auth,
    check("status", "Status is required").notEmpty(),
    check("skills", "At least one skill is required").not().isEmpty(),
    check("website", "Invalid URL").optional().isURL(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // deconstruct the request object
    const {
      skills,
      website,
      youtube,
      twitter,
      facebook,
      linkedin,
      instagram,
      ...rest
    } = req.body;

    const profileFields = {
      user: req.user.id,
      website: normalizeURL(website, { forceHttps: true }),
      skills: Array.isArray(skills)
        ? skills
        : skills.split(",").map((skill) => skill.trim()),
      // date: Date.now(),
      ...rest,
    };

    // build the socialFields Object and sanitize them
    const socialFields = {
      youtube,
      twitter,
      facebook,
      linkedin,
      instagram,
    };

    for (const [key, value] of Object.entries(socialFields)) {
      if (value && value.length) {
        socialFields[key] = normalizeURL(value, { forceHttps: true });
      }
    }
    profileFields.social = socialFields;

    try {
      // Using upsert option (creates new doc if no match is found),
      // set the new option to true to return the document after update was applied.
      // set fields to default value if not provided
      let profile = await Profile.findOneAndUpdate(
        { user: req.user.id },
        { $set: profileFields },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      return res.send(profile);
    } catch (err) {
      console.error(err.message);
      return res.status(500).send("server error");
    }
  }
);

// @route   GET api/profile
// @desc    Get all profiles
// @access  Public
router.get("/", async (req, res) => {
  try {
    const profiles = await Profile.find().populate("user", [
      "name",
      "avatar",
    ]);
    return res.json(profiles);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET api/profile/user/:user_id
// @desc    Get profile by user ID
// @access  Public
router.get("/user/:user_id", async (req, res) => {
  try {
    const profile = await Profile.findOne({
      user: req.params.user_id,
    }).populate("user", ["name", "avatar"]);

    if (!profile)
      return res.status(400).json({ msg: "No profile for this user" });

    return res.json(profile);
  } catch (err) {
    console.error(err.message);
    // when user_id param is not a valid ObjectID, we still want to return back this message
    if (err.kind == "ObjectId") {
      return res
        .status(400)
        .json({ msg: "No profile for this user(invalid user_id)" });
    }
    res.status(500).send("Server error");
  }
});

// @route   DELETE api/profile
// @desc    Delete profile, user and posts
// @access  Private
router.delete("/", auth, async (req, res) => {
  try {
    await Promise.all([
      // TODO: remove user posts

      // Remove profile
      await Profile.findOneAndDelete({ user: req.user.id }),
      // Remove user
      await User.findByIdAndDelete(req.user.id),
    ]);

    return res.json({ msg: "User deleted" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT api/profile/experience
// @desc    Add profile experience
// @access  Private
router.put(
  "/experience",
  [
    auth,
    [
      check("title").notEmpty().withMessage("Title is required"),
      check("company").notEmpty().withMessage("Company is required"),
      check("from")
        .notEmpty()
        .custom((value, { req }) =>
          req.body.to ? value < req.body.to : true
        )
        .withMessage(
          "Start Date is required and needs to be from the past"
        ),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const profile = await Profile.findOne({ user: req.user.id });
      profile.experience.unshift(req.body);
      await profile.save();

      return res.json(profile);
    } catch (err) {
      console.log(err.message);
      return res.status(500).json("Server Error");
    }
  }
);

// module.exports = router;
export default router;
