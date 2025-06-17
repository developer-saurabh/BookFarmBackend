const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.post('/webhook', chatController.receiveMessage);

module.exports = router;
