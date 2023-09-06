const express = require('express');
const mongoose = require('mongoose');
const Joi = require('joi');

const app = express();
app.use(express.json());

mongoose.connect('mongodb://localhost/myapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

const userSchema = new mongoose.Schema({
    userName: String,
    email: { type: String, unique: true },
    password: String,
    age: Number,
    gender: String,
    phone: String,
});

const User = mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
});

const Post = mongoose.model('Post', postSchema);

const userValidationSchema = Joi.object({
    userName: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    age: Joi.number().integer().min(0).required(),
    gender: Joi.string().required(),
    phone: Joi.string().required(),
});

const postValidationSchema = Joi.object({
    title: Joi.string().required(),
    content: Joi.string().required(),
    userID: Joi.string().required(),
});

app.post('/api/users/signup', async (req, res) => {
    try {
        const { error } = userValidationSchema.validate(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) return res.status(400).send('Email already exists');

        const user = new User(req.body);
        await user.save();

        res.send(user);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    try {
        const { error } = userValidationSchema.validate(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!user) return res.status(404).send('User not found');

        res.send(user);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).send('User not found');

        res.send(user);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Search for users
app.get('/api/users/search', async (req, res) => {
    const { nameStartsWith, maxAge } = req.query;

    try {
        const users = await User.find({
            userName: { $regex: new RegExp(`^${nameStartsWith}`, 'i') },
            age: { $lt: maxAge }
        });

        res.send(users);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Search for users with age
app.get('/api/users/search/age', async (req, res) => {
    const { minAge, maxAge } = req.query;

    try {
        const users = await User.find({
            age: { $gte: minAge, $lte: maxAge }
        });

        res.send(users);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find();
        res.send(users);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Get user profile with user posts
app.get('/api/users/:id/profile', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('User not found');

        const userProfile = await User.findById(req.params.id).populate('posts');
        res.send(userProfile);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Post APIs

// Add post 
app.post('/api/posts', async (req, res) => {
    try {
        const { error } = postValidationSchema.validate(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const user = await User.findById(req.body.userID);
        if (!user) return res.status(404).send('User not found');

        const post = new Post(req.body);
        await post.save();

        res.send(post);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Delete post
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).send('Post not found');

        if (post.userID.toString() !== req.body.userID) {
            return res.status(403).send('You are not authorized to delete this post');
        }

        await post.remove();
        res.send(post);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Update post 
app.put('/api/posts/:id', async (req, res) => {
    try {
        const { error } = postValidationSchema.validate(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).send('Post not found');

        if (post.userID.toString() !== req.body.userID) {
            return res.status(403).send('You are not authorized to update this post');
        }

        post.set(req.body);
        await post.save();

        res.send(post);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Get all posts
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find();
        res.send(posts);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Get all posts with their owners' information
app.get('/api/posts/withUsers', async (req, res) => {
    try {
        const postsWithUsers = await Post.find().populate('userID');
        res.send(postsWithUsers);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Sort posts descending
app.get('/api/posts/sort', async (req, res) => {
    try {
        const sortedPosts = await Post.find().sort({ date: -1 });
        res.send(sortedPosts);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});