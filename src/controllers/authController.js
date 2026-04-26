// backend/src/controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Register a new user
const register = async (req, res) => {
  try {
    const { username, email, phoneNumber, password, country, city } = req.body;

    // Validate input
    if (!username || !email || !phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide: username, email, phoneNumber, password'
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ 
      $or: [{ email }, { username }, { phoneNumber }] 
    });
    
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email, username, or phone number'
      });
    }

    // Create user
    const user = new User({
      username,
      email,
      phoneNumber,
      passwordHash: password,  // This will be hashed by the pre-save hook
      country: country || 'Cameroon',
      city: city || ''
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        country: user.country,
        city: user.city
      },
      token: generateToken(user._id)
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, phoneNumber, password } = req.body;

    // Validate input
    if ((!email && !phoneNumber) || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide (email OR phoneNumber) and password'
      });
    }

    // Find user by email OR phone number
    let query = {};
    if (email) query.email = email;
    if (phoneNumber) query.phoneNumber = phoneNumber;
    
    const user = await User.findOne(query);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials - User not found'
      });
    }

    // Check password
    const isPasswordValid = user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials - Wrong password'
      });
    }

    // Update last active
    user.status = 'online';
    user.lastActive = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        status: user.status,
        isAdmin: user.isAdmin
      },
      token: generateToken(user._id)
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get current user profile
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    
    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update profile
const updateProfile = async (req, res) => {
  try {
    const { phoneNumber, username, city, country, avatar } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (phoneNumber) {
      const phoneExists = await User.findOne({ phoneNumber, _id: { $ne: req.user.id } });
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          error: 'Phone number already in use'
        });
      }
      user.phoneNumber = phoneNumber;
    }
    
    if (username) user.username = username;
    if (city) user.city = city;
    if (country) user.country = country;
    if (avatar) user.avatar = avatar;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        country: user.country,
        city: user.city
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = { register, login, getMe, updateProfile };