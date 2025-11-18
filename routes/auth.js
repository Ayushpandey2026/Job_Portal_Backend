import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import auth from '../middleware/auth.js'

const router = express.Router()

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body

    // Check if user exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      phone: req.body.phone || ''
    })

    await user.save()

    // Create token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    })

    res.status(201).json({ token, user: { id: user._id, name, email, role } })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt for:', req.body.email, req.body.role)
    const { email, password, role } = req.body

    // Find user
    const user = await User.findOne({ email, role })
    console.log('User found:', user ? user._id : 'null')
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    let isMatch = false

    // Check if password is plain text (for migration)
    if (user.password === password) {
      console.log('Plain text password detected, hashing...')
      // Plain text password, hash it and save
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(password, salt)
      user.password = hashedPassword
      await user.save()
      isMatch = true
    } else {
      // Check hashed password
      console.log('Checking hashed password...')
      isMatch = await bcrypt.compare(password, user.password)
      console.log('Password match:', isMatch)
    }

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    // Create token
    console.log('Creating token for user:', user._id)
    console.log('JWT_SECRET available:', !!process.env.JWT_SECRET)
    console.log('JWT_SECRET value:', process.env.JWT_SECRET)
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    })
    console.log('Token created successfully')

    res.json({ token, user: { id: user._id, name: user.name, email, role } })
  } catch (error) {
    console.error('Login error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    console.log('Profile route: req.user =', req.user)
    console.log('Profile route: req.user.id =', req.user.id)
    const user = await User.findById(req.user.id).select('-password')
    console.log('Profile route: user found =', user)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    res.json(user)
  } catch (error) {
    console.error('Profile route error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
